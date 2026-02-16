using BikeVoyager.Application.Pois;
using BikeVoyager.Application.Routing;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using System.Globalization;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace BikeVoyager.Infrastructure.Pois;

internal sealed class OverpassPoiService : IPoiService
{
    private const double EarthRadiusMeters = 6371000d;
    private const int MaxPoiItems = 5000;
    private static readonly JsonSerializerOptions SerializerOptions = new(JsonSerializerDefaults.Web);
    private static readonly JsonSerializerOptions CacheSerializerOptions = new(JsonSerializerDefaults.Web);
    private static readonly IReadOnlyList<string> DefaultCategories = new[]
    {
        "monuments",
        "paysages",
        "commerces",
        "services",
    };

    private static readonly IReadOnlyDictionary<string, PoiCategoryDefinition> CategoryDefinitions =
        new Dictionary<string, PoiCategoryDefinition>(StringComparer.OrdinalIgnoreCase)
        {
            ["monuments"] = new PoiCategoryDefinition(
                "monuments",
                new[]
                {
                    new TagFilter("historic", new[] { "monument", "memorial", "castle", "ruins", "archaeological_site", "fort" }),
                    new TagFilter("tourism", new[] { "attraction", "museum" }),
                    new TagFilter("amenity", new[] { "place_of_worship" }),
                }),
            ["paysages"] = new PoiCategoryDefinition(
                "paysages",
                new[]
                {
                    new TagFilter("tourism", new[] { "viewpoint" }),
                    new TagFilter("natural", new[] { "peak", "waterfall", "beach", "bay", "spring", "wood", "cave", "cliff" }),
                    new TagFilter("waterway", new[] { "waterfall" }),
                }),
            ["commerces"] = new PoiCategoryDefinition(
                "commerces",
                new[]
                {
                    new TagFilter("shop", new[] { "bicycle", "supermarket", "bakery", "convenience", "farm", "outdoor", "sports" }),
                    new TagFilter("amenity", new[] { "marketplace" }),
                }),
            ["services"] = new PoiCategoryDefinition(
                "services",
                new[]
                {
                    new TagFilter("amenity", new[]
                    {
                        "cafe",
                        "restaurant",
                        "fast_food",
                        "toilets",
                        "pharmacy",
                        "drinking_water",
                        "bicycle_repair_station",
                        "shelter",
                        "fuel",
                        "bank",
                        "atm",
                        "parking",
                    }),
                    new TagFilter("tourism", new[] { "information" }),
                }),
        };

    private static readonly string[] KindPriorityKeys =
    {
        "historic",
        "tourism",
        "natural",
        "amenity",
        "shop",
    };
    private static readonly HashSet<string> GenericPoiNamesForDeduplication =
        new(StringComparer.Ordinal)
        {
            "point d'interet",
            "point dinteret",
            "point of interest",
        };

    private readonly HttpClient _httpClient;
    private readonly IMemoryCache _cache;
    private readonly IDistributedCache? _distributedCache;
    private readonly OverpassOptions _options;
    private readonly ILogger<OverpassPoiService> _logger;

    public OverpassPoiService(
        HttpClient httpClient,
        IMemoryCache cache,
        IDistributedCache? distributedCache,
        IOptions<OverpassOptions> options,
        ILogger<OverpassPoiService> logger)
    {
        _httpClient = httpClient;
        _cache = cache;
        _distributedCache = distributedCache;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<IReadOnlyList<PoiItem>> AroundRouteAsync(
        PoiAroundRouteRequest request,
        CancellationToken cancellationToken)
    {
        if (request.Geometry.Coordinates.Count < 2)
        {
            return Array.Empty<PoiItem>();
        }

        var categories = NormalizeCategories(request.Categories);
        if (categories.Count == 0)
        {
            return Array.Empty<PoiItem>();
        }

        var preferredLanguage = NormalizeLanguage(request.Language);
        var corridorMeters = Math.Clamp(request.CorridorMeters, 50, 5000);
        var safeLimit = Math.Clamp(request.Limit, 1, MaxPoiItems);

        var cacheKey = BuildCacheKey(
            request.Geometry.Coordinates,
            categories,
            corridorMeters,
            safeLimit,
            preferredLanguage);
        var distributed = await TryGetDistributedAsync<List<PoiItem>>(cacheKey, cancellationToken);
        if (distributed is not null)
        {
            _cache.Set(cacheKey, distributed, TimeSpan.FromSeconds(_options.Cache.AroundRouteTtlSeconds));
            return distributed;
        }

        if (_cache.TryGetValue(cacheKey, out IReadOnlyList<PoiItem>? cached))
        {
            return cached;
        }

        var bounds = ComputeBounds(request.Geometry.Coordinates);
        var expandedBounds = ExpandBounds(bounds, corridorMeters);
        var query = BuildOverpassQuery(categories, expandedBounds);

        using var response = await _httpClient.PostAsync(
            "interpreter",
            new StringContent($"data={Uri.EscapeDataString(query)}", Encoding.UTF8, "application/x-www-form-urlencoded"),
            cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            var payload = await response.Content.ReadAsStringAsync(cancellationToken);
            _logger.LogWarning(
                "Overpass a répondu {StatusCode} : {Payload}",
                (int)response.StatusCode,
                payload);
            response.EnsureSuccessStatusCode();
        }

        var mediaType = response.Content.Headers.ContentType?.MediaType;
        if (string.IsNullOrWhiteSpace(mediaType) ||
            !mediaType.Contains("json", StringComparison.OrdinalIgnoreCase))
        {
            var payload = await response.Content.ReadAsStringAsync(cancellationToken);
            var snippet = payload.Length > 512 ? payload[..512] : payload;
            _logger.LogWarning(
                "Overpass format inattendu {MediaType} : {Payload}",
                mediaType ?? "inconnu",
                snippet);
            throw new InvalidOperationException("Réponse Overpass non JSON.");
        }

        OverpassResponse? payloadModel;
        try
        {
            payloadModel = await response.Content.ReadFromJsonAsync<OverpassResponse>(
                SerializerOptions,
                cancellationToken);
        }
        catch (JsonException ex)
        {
            _logger.LogWarning(ex, "Reponse Overpass JSON invalide.");
            throw new InvalidOperationException("Reponse Overpass JSON invalide.");
        }
        catch (NotSupportedException ex)
        {
            _logger.LogWarning(ex, "Reponse Overpass non deserialisable.");
            throw new InvalidOperationException("Reponse Overpass non deserialisable.");
        }

        var items = MapElements(
            payloadModel?.Elements ?? new List<OverpassElement>(),
            request.Geometry.Coordinates,
            categories,
            corridorMeters,
            safeLimit,
            preferredLanguage);

        _cache.Set(cacheKey, items, TimeSpan.FromSeconds(_options.Cache.AroundRouteTtlSeconds));
        await TrySetDistributedAsync(cacheKey, items, _options.Cache.AroundRouteTtlSeconds, cancellationToken);

        return items;
    }

    private static IReadOnlyList<string> NormalizeCategories(IReadOnlyList<string> categories)
    {
        if (categories.Count == 0)
        {
            return DefaultCategories.ToArray();
        }

        var normalized = new List<string>();
        foreach (var category in categories)
        {
            if (string.IsNullOrWhiteSpace(category))
            {
                continue;
            }

            if (!CategoryDefinitions.ContainsKey(category.Trim()))
            {
                continue;
            }

            normalized.Add(category.Trim().ToLowerInvariant());
        }

        if (normalized.Count == 0)
        {
            return DefaultCategories.ToArray();
        }

        return normalized.Distinct(StringComparer.OrdinalIgnoreCase).ToList();
    }

    private static string BuildCacheKey(
        IReadOnlyList<double[]> coordinates,
        IReadOnlyList<string> categories,
        double corridorMeters,
        int limit,
        string? language)
    {
        var hash = ComputeGeometryHash(coordinates);
        var categoriesKey = string.Join(',', categories.OrderBy(c => c, StringComparer.OrdinalIgnoreCase));
        var languageKey = language ?? "auto";
        return $"poi:around-route:v5:{hash}:{categoriesKey}:{corridorMeters:F0}:{limit}:{languageKey}";
    }

    private static string ComputeGeometryHash(IReadOnlyList<double[]> coordinates)
    {
        using var sha = SHA256.Create();
        var builder = new StringBuilder();
        foreach (var coord in coordinates)
        {
            if (coord.Length < 2)
            {
                continue;
            }

            builder.Append(coord[0].ToString("F5", CultureInfo.InvariantCulture))
                .Append(',')
                .Append(coord[1].ToString("F5", CultureInfo.InvariantCulture))
                .Append(';');
        }

        var bytes = Encoding.UTF8.GetBytes(builder.ToString());
        var hash = sha.ComputeHash(bytes);
        return Convert.ToHexString(hash).ToLowerInvariant();
    }

    private static string BuildOverpassQuery(IReadOnlyList<string> categories, Bounds bounds)
    {
        var culture = CultureInfo.InvariantCulture;
        var bbox = string.Join(
            ",",
            bounds.MinLat.ToString("F6", culture),
            bounds.MinLon.ToString("F6", culture),
            bounds.MaxLat.ToString("F6", culture),
            bounds.MaxLon.ToString("F6", culture));

        var filters = new List<string>();
        foreach (var category in categories)
        {
            if (!CategoryDefinitions.TryGetValue(category, out var definition))
            {
                continue;
            }

            foreach (var filter in definition.Filters)
            {
                filters.Add(BuildFilter(filter));
            }
        }

        var builder = new StringBuilder();
        builder.AppendLine("[out:json][timeout:25];");
        builder.AppendLine("(");
        foreach (var filter in filters)
        {
            builder.Append("  nwr");
            builder.Append(filter);
            builder.Append('(');
            builder.Append(bbox);
            builder.AppendLine(");");
        }
        builder.AppendLine(");");
        builder.AppendLine("out body center geom;");
        return builder.ToString();
    }

    private static string BuildFilter(TagFilter filter)
    {
        if (filter.Values is null || filter.Values.Length == 0)
        {
            return $"[\"{filter.Key}\"]";
        }

        if (filter.Values.Length == 1)
        {
            return $"[\"{filter.Key}\"=\"{filter.Values[0]}\"]";
        }

        var joined = string.Join("|", filter.Values);
        return $"[\"{filter.Key}\"~\"{joined}\"]";
    }

    private static Bounds ComputeBounds(IReadOnlyList<double[]> coordinates)
    {
        var minLat = double.PositiveInfinity;
        var minLon = double.PositiveInfinity;
        var maxLat = double.NegativeInfinity;
        var maxLon = double.NegativeInfinity;

        foreach (var coord in coordinates)
        {
            if (coord.Length < 2)
            {
                continue;
            }

            var lon = coord[0];
            var lat = coord[1];

            if (!double.IsFinite(lat) || !double.IsFinite(lon))
            {
                continue;
            }

            minLat = Math.Min(minLat, lat);
            minLon = Math.Min(minLon, lon);
            maxLat = Math.Max(maxLat, lat);
            maxLon = Math.Max(maxLon, lon);
        }

        return new Bounds(minLat, minLon, maxLat, maxLon);
    }

    private static Bounds ExpandBounds(Bounds bounds, double corridorMeters)
    {
        var latPadding = corridorMeters / 111_320d;
        var midLat = (bounds.MinLat + bounds.MaxLat) / 2d;
        var lonPadding = corridorMeters / (111_320d * Math.Cos(DegreesToRadians(Math.Max(-89, Math.Min(89, midLat)))));

        return new Bounds(
            Math.Max(-90, bounds.MinLat - latPadding),
            Math.Max(-180, bounds.MinLon - lonPadding),
            Math.Min(90, bounds.MaxLat + latPadding),
            Math.Min(180, bounds.MaxLon + lonPadding));
    }

    private static IReadOnlyList<PoiItem> MapElements(
        IReadOnlyList<OverpassElement> elements,
        IReadOnlyList<double[]> routeCoordinates,
        IReadOnlyList<string> categories,
        double corridorMeters,
        int limit,
        string? preferredLanguage)
    {
        var results = new Dictionary<string, PoiMatch>();

        foreach (var element in elements)
        {
            var hasPrimaryCoordinate = TryGetElementCoordinate(element, out var primaryLat, out var primaryLon);
            if (!hasPrimaryCoordinate &&
                !TryGetGeometryCoordinate(element.Geometry, out primaryLat, out primaryLon))
            {
                continue;
            }

            var tags = element.Tags;
            if (tags is null || tags.Count == 0)
            {
                continue;
            }

            var category = ResolveCategory(categories, tags);
            if (string.IsNullOrWhiteSpace(category))
            {
                continue;
            }

            var projection = ComputeRouteProjection(
                routeCoordinates,
                primaryLat,
                primaryLon,
                element.Geometry);
            if (!double.IsFinite(projection.DistanceToRouteMeters) ||
                projection.DistanceToRouteMeters > corridorMeters)
            {
                continue;
            }

            var id = $"{element.Type}/{element.Id}";
            var name = ResolveName(tags, preferredLanguage);
            var kind = ResolveKind(tags);
            var detailTags = BuildTagDetails(tags);

            if (results.TryGetValue(id, out var existing))
            {
                if (projection.DistanceToRouteMeters < existing.DistanceToRouteMeters)
                {
                    results[id] = existing with
                    {
                        DistanceToRouteMeters = projection.DistanceToRouteMeters,
                        DistanceAlongRouteMeters = projection.DistanceAlongRouteMeters,
                    };
                }
                continue;
            }

            results[id] = new PoiMatch(
                id,
                name,
                projection.PoiLat,
                projection.PoiLon,
                category,
                kind,
                element.Type,
                element.Id,
                detailTags,
                projection.DistanceToRouteMeters,
                projection.DistanceAlongRouteMeters);
        }

        var deduplicated = MergeSemanticDuplicates(results.Values);

        return deduplicated
            .OrderBy(item => item.DistanceAlongRouteMeters)
            .ThenBy(item => item.DistanceToRouteMeters)
            .Take(limit)
            .Select(item => new PoiItem(
                item.Id,
                item.Name,
                item.Lat,
                item.Lon,
                item.Category,
                item.Kind,
                item.DistanceAlongRouteMeters,
                item.DistanceToRouteMeters,
                item.OsmType,
                item.OsmId,
                item.Tags))
            .ToList();
    }

    private static IReadOnlyList<PoiMatch> MergeSemanticDuplicates(IEnumerable<PoiMatch> matches)
    {
        const double maxSpatialDistanceMeters = 35d;
        const double maxDistanceAlongDeltaMeters = 80d;

        var bucketsBySemanticKey = new Dictionary<string, List<PoiMatch>>(StringComparer.Ordinal);
        var passthrough = new List<PoiMatch>();

        foreach (var match in matches)
        {
            var semanticKey = BuildSemanticDuplicateKey(match);
            if (semanticKey is null)
            {
                passthrough.Add(match);
                continue;
            }

            if (!bucketsBySemanticKey.TryGetValue(semanticKey, out var bucket))
            {
                bucket = new List<PoiMatch> { match };
                bucketsBySemanticKey[semanticKey] = bucket;
                continue;
            }

            var duplicateIndex = -1;
            for (var index = 0; index < bucket.Count; index += 1)
            {
                var existing = bucket[index];
                if (Math.Abs(existing.DistanceAlongRouteMeters - match.DistanceAlongRouteMeters) >
                    maxDistanceAlongDeltaMeters)
                {
                    continue;
                }

                var distanceBetweenPois = HaversineDistanceMeters(
                    existing.Lat,
                    existing.Lon,
                    match.Lat,
                    match.Lon);
                if (distanceBetweenPois > maxSpatialDistanceMeters)
                {
                    continue;
                }

                duplicateIndex = index;
                break;
            }

            if (duplicateIndex < 0)
            {
                bucket.Add(match);
                continue;
            }

            bucket[duplicateIndex] = SelectPreferredDuplicate(bucket[duplicateIndex], match);
        }

        var merged = new List<PoiMatch>(passthrough.Count + bucketsBySemanticKey.Sum(group => group.Value.Count));
        merged.AddRange(passthrough);
        foreach (var bucket in bucketsBySemanticKey.Values)
        {
            merged.AddRange(bucket);
        }

        return merged;
    }

    private static PoiMatch SelectPreferredDuplicate(PoiMatch current, PoiMatch candidate)
    {
        if (candidate.DistanceToRouteMeters + 1d < current.DistanceToRouteMeters)
        {
            return candidate;
        }

        if (current.DistanceToRouteMeters + 1d < candidate.DistanceToRouteMeters)
        {
            return current;
        }

        var currentTagsCount = current.Tags?.Count ?? 0;
        var candidateTagsCount = candidate.Tags?.Count ?? 0;
        if (candidateTagsCount > currentTagsCount)
        {
            return candidate;
        }

        if (currentTagsCount > candidateTagsCount)
        {
            return current;
        }

        var currentOsmTypeRank = GetOsmTypeRank(current.OsmType);
        var candidateOsmTypeRank = GetOsmTypeRank(candidate.OsmType);
        if (candidateOsmTypeRank > currentOsmTypeRank)
        {
            return candidate;
        }

        if (currentOsmTypeRank > candidateOsmTypeRank)
        {
            return current;
        }

        return string.CompareOrdinal(candidate.Id, current.Id) < 0
            ? candidate
            : current;
    }

    private static int GetOsmTypeRank(string? osmType) => osmType?.ToLowerInvariant() switch
    {
        "relation" => 3,
        "way" => 2,
        "node" => 1,
        _ => 0,
    };

    private static string? BuildSemanticDuplicateKey(PoiMatch match)
    {
        if (!TryResolveCanonicalNameForDeduplication(match.Tags, out var canonicalName))
        {
            return null;
        }

        var normalizedName = NormalizeTextForDeduplication(canonicalName);
        if (normalizedName.Length == 0 || GenericPoiNamesForDeduplication.Contains(normalizedName))
        {
            return null;
        }

        var normalizedKind = NormalizeTextForDeduplication(match.Kind ?? string.Empty);
        return $"{match.Category}|{normalizedKind}|{normalizedName}";
    }

    private static bool TryResolveCanonicalNameForDeduplication(
        IReadOnlyDictionary<string, string>? tags,
        out string name)
    {
        name = string.Empty;
        if (tags is null || tags.Count == 0)
        {
            return false;
        }

        var candidateKeys = new[]
        {
            "name",
            "name:fr",
            "name:en",
            "int_name",
            "official_name",
        };

        foreach (var key in candidateKeys)
        {
            if (!TryGetTagValue(tags, key, out var value))
            {
                continue;
            }

            name = value;
            return true;
        }

        return false;
    }

    private static string NormalizeTextForDeduplication(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return string.Empty;
        }

        var normalized = value.Trim().Normalize(NormalizationForm.FormD);
        var builder = new StringBuilder(normalized.Length);
        var previousWhitespace = false;

        foreach (var current in normalized)
        {
            var category = CharUnicodeInfo.GetUnicodeCategory(current);
            if (category == UnicodeCategory.NonSpacingMark)
            {
                continue;
            }

            if (char.IsWhiteSpace(current))
            {
                if (previousWhitespace || builder.Length == 0)
                {
                    continue;
                }

                builder.Append(' ');
                previousWhitespace = true;
                continue;
            }

            builder.Append(char.ToLowerInvariant(current));
            previousWhitespace = false;
        }

        return builder.ToString().Trim();
    }

    private static bool TryGetElementCoordinate(OverpassElement element, out double lat, out double lon)
    {
        lat = 0;
        lon = 0;

        if (element.Lat is not null && element.Lon is not null)
        {
            lat = element.Lat.Value;
            lon = element.Lon.Value;
            return true;
        }

        if (element.Center?.Lat is not null && element.Center?.Lon is not null)
        {
            lat = element.Center.Lat.Value;
            lon = element.Center.Lon.Value;
            return true;
        }

        return false;
    }

    private static bool TryGetGeometryCoordinate(
        IReadOnlyList<OverpassGeometryPoint>? geometry,
        out double lat,
        out double lon)
    {
        lat = 0;
        lon = 0;

        if (geometry is null || geometry.Count == 0)
        {
            return false;
        }

        foreach (var point in geometry)
        {
            if (!double.IsFinite(point.Lat) || !double.IsFinite(point.Lon))
            {
                continue;
            }

            lat = point.Lat;
            lon = point.Lon;
            return true;
        }

        return false;
    }

    private static string ResolveCategory(IReadOnlyList<string> orderedCategories, IDictionary<string, string> tags)
    {
        foreach (var category in orderedCategories)
        {
            if (!CategoryDefinitions.TryGetValue(category, out var definition))
            {
                continue;
            }

            if (definition.Filters.Any(filter => TagsMatch(filter, tags)))
            {
                return definition.Key;
            }
        }

        return string.Empty;
    }

    private static bool TagsMatch(TagFilter filter, IDictionary<string, string> tags)
    {
        if (!tags.TryGetValue(filter.Key, out var value))
        {
            return false;
        }

        if (filter.Values is null || filter.Values.Length == 0)
        {
            return true;
        }

        return filter.Values.Contains(value, StringComparer.OrdinalIgnoreCase);
    }

    private static string ResolveName(IDictionary<string, string> tags, string? preferredLanguage)
    {
        var normalizedLanguage = NormalizeLanguage(preferredLanguage);

        if (TryResolveLocalizedName(tags, normalizedLanguage, out var localizedName))
        {
            return localizedName;
        }

        if (TryGetTagValue(tags, "name", out var name))
        {
            return name;
        }

        if (TryGetTagValue(tags, "int_name", out var internationalName))
        {
            return internationalName;
        }

        if (TryGetTagValue(tags, "official_name", out var officialName))
        {
            return officialName;
        }

        if (TryGetTagValue(tags, "brand", out var brand))
        {
            return brand;
        }

        if (TryGetTagValue(tags, "operator", out var @operator))
        {
            return @operator;
        }

        foreach (var key in KindPriorityKeys)
        {
            if (TryGetTagValue(tags, key, out var value))
            {
                var culture = CultureInfo.GetCultureInfo("fr-FR");
                return culture.TextInfo.ToTitleCase(value.Replace('_', ' '));
            }
        }

        return normalizedLanguage == "en" ? "Point of interest" : "Point d'interet";
    }

    private static string? ResolveKind(IDictionary<string, string> tags)
    {
        foreach (var key in KindPriorityKeys)
        {
            if (TryGetTagValue(tags, key, out var value))
            {
                return $"{key}:{value}";
            }
        }

        return null;
    }

    private static string? NormalizeLanguage(string? language)
    {
        if (string.IsNullOrWhiteSpace(language))
        {
            return null;
        }

        var trimmed = language.Trim();
        if (trimmed.StartsWith("fr", StringComparison.OrdinalIgnoreCase))
        {
            return "fr";
        }

        if (trimmed.StartsWith("en", StringComparison.OrdinalIgnoreCase))
        {
            return "en";
        }

        return null;
    }

    private static bool TryResolveLocalizedName(
        IDictionary<string, string> tags,
        string? preferredLanguage,
        out string name)
    {
        name = string.Empty;
        if (preferredLanguage is null)
        {
            return false;
        }

        var keys = preferredLanguage == "fr"
            ? new[] { "name:fr", "name:fr-fr", "name:fr_fr" }
            : new[] { "name:en", "name:en-gb", "name:en-us", "name:en_gb", "name:en_us" };

        foreach (var key in keys)
        {
            if (TryGetTagValue(tags, key, out var value))
            {
                name = value;
                return true;
            }
        }

        return false;
    }

    private static bool TryGetTagValue(
        IDictionary<string, string> tags,
        string key,
        out string value)
    {
        value = string.Empty;

        if (tags.TryGetValue(key, out var directValue) && !string.IsNullOrWhiteSpace(directValue))
        {
            value = directValue.Trim();
            return true;
        }

        foreach (var entry in tags)
        {
            if (!string.Equals(entry.Key, key, StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            if (string.IsNullOrWhiteSpace(entry.Value))
            {
                continue;
            }

            value = entry.Value.Trim();
            return true;
        }

        return false;
    }

    private static bool TryGetTagValue(
        IReadOnlyDictionary<string, string> tags,
        string key,
        out string value)
    {
        value = string.Empty;

        if (tags.TryGetValue(key, out var directValue) && !string.IsNullOrWhiteSpace(directValue))
        {
            value = directValue.Trim();
            return true;
        }

        foreach (var entry in tags)
        {
            if (!string.Equals(entry.Key, key, StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            if (string.IsNullOrWhiteSpace(entry.Value))
            {
                continue;
            }

            value = entry.Value.Trim();
            return true;
        }

        return false;
    }

    private static IReadOnlyDictionary<string, string>? BuildTagDetails(IDictionary<string, string> tags)
    {
        if (tags.Count == 0)
        {
            return null;
        }

        var details = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var entry in tags)
        {
            if (string.IsNullOrWhiteSpace(entry.Key) || string.IsNullOrWhiteSpace(entry.Value))
            {
                continue;
            }

            details[entry.Key.Trim()] = entry.Value.Trim();
        }

        return details.Count == 0 ? null : details;
    }

    private static RouteProjection ComputeRouteProjection(
        IReadOnlyList<double[]> routeCoordinates,
        double fallbackLat,
        double fallbackLon,
        IReadOnlyList<OverpassGeometryPoint>? geometry)
    {
        if (geometry is null || geometry.Count == 0)
        {
            return ComputeRouteProjectionForPoint(routeCoordinates, fallbackLat, fallbackLon);
        }

        var minDistance = double.PositiveInfinity;
        var distanceAlongRoute = double.PositiveInfinity;
        var poiLat = fallbackLat;
        var poiLon = fallbackLon;
        var traversedMeters = 0d;
        var hadAnyRouteSegment = false;
        var hasFeatureSegments = false;

        for (var i = 1; i < routeCoordinates.Count; i++)
        {
            var routeA = routeCoordinates[i - 1];
            var routeB = routeCoordinates[i];
            if (routeA.Length < 2 || routeB.Length < 2)
            {
                continue;
            }

            var routeALat = routeA[1];
            var routeALon = routeA[0];
            var routeBLat = routeB[1];
            var routeBLon = routeB[0];
            if (!double.IsFinite(routeALat) ||
                !double.IsFinite(routeALon) ||
                !double.IsFinite(routeBLat) ||
                !double.IsFinite(routeBLon))
            {
                continue;
            }

            hadAnyRouteSegment = true;
            var segmentLengthMeters = HaversineDistanceMeters(routeALat, routeALon, routeBLat, routeBLon);

            for (var j = 1; j < geometry.Count; j++)
            {
                var featureA = geometry[j - 1];
                var featureB = geometry[j];
                if (!double.IsFinite(featureA.Lat) ||
                    !double.IsFinite(featureA.Lon) ||
                    !double.IsFinite(featureB.Lat) ||
                    !double.IsFinite(featureB.Lon))
                {
                    continue;
                }

                hasFeatureSegments = true;

                var projection = ProjectSegmentToSegmentMeters(
                    routeALat,
                    routeALon,
                    routeBLat,
                    routeBLon,
                    featureA.Lat,
                    featureA.Lon,
                    featureB.Lat,
                    featureB.Lon);

                if (projection.DistanceMeters >= minDistance)
                {
                    continue;
                }

                minDistance = projection.DistanceMeters;
                distanceAlongRoute = traversedMeters + (projection.RouteT * segmentLengthMeters);
                poiLat = featureA.Lat + ((featureB.Lat - featureA.Lat) * projection.FeatureT);
                poiLon = featureA.Lon + ((featureB.Lon - featureA.Lon) * projection.FeatureT);
            }

            traversedMeters += segmentLengthMeters;
        }

        if (!hadAnyRouteSegment)
        {
            return new RouteProjection(double.PositiveInfinity, double.PositiveInfinity, fallbackLat, fallbackLon);
        }

        if (!hasFeatureSegments)
        {
            var bestPointProjection = ComputeRouteProjectionForPoint(routeCoordinates, fallbackLat, fallbackLon);
            foreach (var point in geometry)
            {
                if (!double.IsFinite(point.Lat) || !double.IsFinite(point.Lon))
                {
                    continue;
                }

                var pointProjection = ComputeRouteProjectionForPoint(routeCoordinates, point.Lat, point.Lon);
                if (pointProjection.DistanceToRouteMeters < bestPointProjection.DistanceToRouteMeters)
                {
                    bestPointProjection = pointProjection;
                }
            }

            return bestPointProjection;
        }

        if (!double.IsFinite(distanceAlongRoute))
        {
            distanceAlongRoute = traversedMeters;
        }

        return new RouteProjection(minDistance, distanceAlongRoute, poiLat, poiLon);
    }

    private static RouteProjection ComputeRouteProjectionForPoint(
        IReadOnlyList<double[]> routeCoordinates,
        double lat,
        double lon)
    {
        var minDistance = double.PositiveInfinity;
        var distanceAlongRoute = double.PositiveInfinity;
        var traversedMeters = 0d;

        for (var i = 1; i < routeCoordinates.Count; i++)
        {
            var a = routeCoordinates[i - 1];
            var b = routeCoordinates[i];
            if (a.Length < 2 || b.Length < 2)
            {
                continue;
            }

            var segmentLengthMeters = HaversineDistanceMeters(a[1], a[0], b[1], b[0]);
            var projection = ProjectPointToSegmentMeters(
                lat,
                lon,
                a[1],
                a[0],
                b[1],
                b[0]);

            if (projection.DistanceMeters < minDistance)
            {
                minDistance = projection.DistanceMeters;
                distanceAlongRoute = traversedMeters + (projection.T * segmentLengthMeters);
            }

            traversedMeters += segmentLengthMeters;
        }

        if (!double.IsFinite(distanceAlongRoute))
        {
            distanceAlongRoute = traversedMeters;
        }

        return new RouteProjection(minDistance, distanceAlongRoute, lat, lon);
    }

    private static SegmentPairProjection ProjectSegmentToSegmentMeters(
        double routeALat,
        double routeALon,
        double routeBLat,
        double routeBLon,
        double featureALat,
        double featureALon,
        double featureBLat,
        double featureBLon)
    {
        const double epsilon = 1e-9;

        var referenceLat = (routeALat + routeBLat + featureALat + featureBLat) / 4d;
        var (ax, ay) = ToMeters(routeALat, routeALon, referenceLat);
        var (bx, by) = ToMeters(routeBLat, routeBLon, referenceLat);
        var (cx, cy) = ToMeters(featureALat, featureALon, referenceLat);
        var (dx, dy) = ToMeters(featureBLat, featureBLon, referenceLat);

        var ux = bx - ax;
        var uy = by - ay;
        var vx = dx - cx;
        var vy = dy - cy;
        var wx = ax - cx;
        var wy = ay - cy;

        var a = (ux * ux) + (uy * uy);
        var b = (ux * vx) + (uy * vy);
        var c = (vx * vx) + (vy * vy);
        var d = (ux * wx) + (uy * wy);
        var e = (vx * wx) + (vy * wy);
        var denominator = (a * c) - (b * b);

        if (a <= epsilon && c <= epsilon)
        {
            return new SegmentPairProjection(Math.Sqrt((wx * wx) + (wy * wy)), 0d, 0d);
        }

        if (a <= epsilon)
        {
            var projection = ProjectPointToSegmentMeters(
                routeALat,
                routeALon,
                featureALat,
                featureALon,
                featureBLat,
                featureBLon);
            return new SegmentPairProjection(projection.DistanceMeters, 0d, projection.T);
        }

        if (c <= epsilon)
        {
            var projection = ProjectPointToSegmentMeters(
                featureALat,
                featureALon,
                routeALat,
                routeALon,
                routeBLat,
                routeBLon);
            return new SegmentPairProjection(projection.DistanceMeters, projection.T, 0d);
        }

        double routeNumerator;
        double routeDenominator = denominator;
        double featureNumerator;
        double featureDenominator = denominator;

        if (Math.Abs(denominator) < epsilon)
        {
            routeNumerator = 0d;
            routeDenominator = 1d;
            featureNumerator = e;
            featureDenominator = c;
        }
        else
        {
            routeNumerator = (b * e) - (c * d);
            featureNumerator = (a * e) - (b * d);

            if (routeNumerator < 0d)
            {
                routeNumerator = 0d;
                featureNumerator = e;
                featureDenominator = c;
            }
            else if (routeNumerator > routeDenominator)
            {
                routeNumerator = routeDenominator;
                featureNumerator = e + b;
                featureDenominator = c;
            }
        }

        if (featureNumerator < 0d)
        {
            featureNumerator = 0d;
            if (-d < 0d)
            {
                routeNumerator = 0d;
            }
            else if (-d > a)
            {
                routeNumerator = routeDenominator;
            }
            else
            {
                routeNumerator = -d;
                routeDenominator = a;
            }
        }
        else if (featureNumerator > featureDenominator)
        {
            featureNumerator = featureDenominator;
            if ((-d + b) < 0d)
            {
                routeNumerator = 0d;
            }
            else if ((-d + b) > a)
            {
                routeNumerator = routeDenominator;
            }
            else
            {
                routeNumerator = -d + b;
                routeDenominator = a;
            }
        }

        var routeT = Math.Abs(routeNumerator) < epsilon ? 0d : routeNumerator / routeDenominator;
        var featureT = Math.Abs(featureNumerator) < epsilon ? 0d : featureNumerator / featureDenominator;

        var diffX = wx + (routeT * ux) - (featureT * vx);
        var diffY = wy + (routeT * uy) - (featureT * vy);
        var distance = Math.Sqrt((diffX * diffX) + (diffY * diffY));

        return new SegmentPairProjection(distance, routeT, featureT);
    }

    private static SegmentProjection ProjectPointToSegmentMeters(
        double lat,
        double lon,
        double latA,
        double lonA,
        double latB,
        double lonB)
    {
        var referenceLat = (latA + latB) / 2d;
        var (ax, ay) = ToMeters(latA, lonA, referenceLat);
        var (bx, by) = ToMeters(latB, lonB, referenceLat);
        var (px, py) = ToMeters(lat, lon, referenceLat);

        var dx = bx - ax;
        var dy = by - ay;
        if (Math.Abs(dx) < 0.000001 && Math.Abs(dy) < 0.000001)
        {
            return new SegmentProjection(
                Math.Sqrt(Math.Pow(px - ax, 2) + Math.Pow(py - ay, 2)),
                0);
        }

        var t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy);
        t = Math.Max(0, Math.Min(1, t));

        var projX = ax + (t * dx);
        var projY = ay + (t * dy);

        return new SegmentProjection(
            Math.Sqrt(Math.Pow(px - projX, 2) + Math.Pow(py - projY, 2)),
            t);
    }

    private static (double X, double Y) ToMeters(double lat, double lon, double referenceLat)
    {
        var latRad = DegreesToRadians(lat);
        var lonRad = DegreesToRadians(lon);
        var refLatRad = DegreesToRadians(referenceLat);

        var x = lonRad * Math.Cos(refLatRad) * EarthRadiusMeters;
        var y = latRad * EarthRadiusMeters;
        return (x, y);
    }

    private static double HaversineDistanceMeters(double latA, double lonA, double latB, double lonB)
    {
        var dLat = DegreesToRadians(latB - latA);
        var dLon = DegreesToRadians(lonB - lonA);
        var radLatA = DegreesToRadians(latA);
        var radLatB = DegreesToRadians(latB);

        var a = Math.Pow(Math.Sin(dLat / 2), 2) +
            Math.Cos(radLatA) * Math.Cos(radLatB) *
            Math.Pow(Math.Sin(dLon / 2), 2);
        var c = 2 * Math.Asin(Math.Min(1, Math.Sqrt(a)));
        return EarthRadiusMeters * c;
    }

    private static double DegreesToRadians(double degrees) => degrees * Math.PI / 180d;

    private async Task<T?> TryGetDistributedAsync<T>(string cacheKey, CancellationToken cancellationToken)
    {
        if (_distributedCache is null)
        {
            return default;
        }

        byte[]? payload;
        try
        {
            payload = await _distributedCache.GetAsync(cacheKey, cancellationToken);
            if (payload is null || payload.Length == 0)
            {
                return default;
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Cache distribué POI indisponible (lecture).");
            return default;
        }

        try
        {
            return JsonSerializer.Deserialize<T>(payload, CacheSerializerOptions);
        }
        catch (JsonException)
        {
            return default;
        }
    }

    private async Task TrySetDistributedAsync<T>(
        string cacheKey,
        T value,
        int ttlSeconds,
        CancellationToken cancellationToken)
    {
        if (_distributedCache is null)
        {
            return;
        }

        try
        {
            var payload = JsonSerializer.SerializeToUtf8Bytes(value, CacheSerializerOptions);
            await _distributedCache.SetAsync(
                cacheKey,
                payload,
                new DistributedCacheEntryOptions
                {
                    AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(ttlSeconds),
                },
                cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Cache distribué POI indisponible (écriture).");
        }
    }

    private sealed record TagFilter(string Key, string[]? Values);

    private sealed record PoiCategoryDefinition(string Key, IReadOnlyList<TagFilter> Filters);

    private sealed record Bounds(double MinLat, double MinLon, double MaxLat, double MaxLon);

    private sealed record SegmentProjection(double DistanceMeters, double T);

    private sealed record SegmentPairProjection(double DistanceMeters, double RouteT, double FeatureT);

    private sealed record RouteProjection(
        double DistanceToRouteMeters,
        double DistanceAlongRouteMeters,
        double PoiLat,
        double PoiLon);

    private sealed record PoiMatch(
        string Id,
        string Name,
        double Lat,
        double Lon,
        string Category,
        string? Kind,
        string OsmType,
        long OsmId,
        IReadOnlyDictionary<string, string>? Tags,
        double DistanceToRouteMeters,
        double DistanceAlongRouteMeters);

    private sealed record OverpassResponse(
        [property: JsonPropertyName("elements")] List<OverpassElement> Elements);

    private sealed record OverpassElement(
        [property: JsonPropertyName("type")] string Type,
        [property: JsonPropertyName("id")] long Id,
        [property: JsonPropertyName("lat")] double? Lat,
        [property: JsonPropertyName("lon")] double? Lon,
        [property: JsonPropertyName("center")] OverpassCenter? Center,
        [property: JsonPropertyName("geometry")] List<OverpassGeometryPoint>? Geometry,
        [property: JsonPropertyName("tags")] Dictionary<string, string>? Tags);

    private sealed record OverpassCenter(
        [property: JsonPropertyName("lat")] double? Lat,
        [property: JsonPropertyName("lon")] double? Lon);

    private sealed record OverpassGeometryPoint(
        [property: JsonPropertyName("lat")] double Lat,
        [property: JsonPropertyName("lon")] double Lon);
}
