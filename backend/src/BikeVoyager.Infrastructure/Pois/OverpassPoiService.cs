using BikeVoyager.Application.Pois;
using BikeVoyager.Application.Routing;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace BikeVoyager.Infrastructure.Pois;

internal sealed class OverpassPoiService : IPoiService
{
    private const int MaxPoiItems = 5000;
    private static readonly JsonSerializerOptions CacheSerializerOptions = new(JsonSerializerDefaults.Web);

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

        var categories = OverpassQueryBuilder.NormalizeCategories(request.Categories);
        if (categories.Count == 0)
        {
            return Array.Empty<PoiItem>();
        }

        var preferredLanguage = PoiNormalizer.NormalizeLanguage(request.Language);
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

        if (_cache.TryGetValue(cacheKey, out IReadOnlyList<PoiItem>? cached) &&
            cached is not null)
        {
            return cached;
        }

        var bounds = OverpassGeometryHelper.ComputeBounds(request.Geometry.Coordinates);
        var expandedBounds = OverpassGeometryHelper.ExpandBounds(bounds, corridorMeters);
        var query = OverpassQueryBuilder.BuildQuery(categories, expandedBounds);

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

        OverpassResponse payloadModel;
        try
        {
            payloadModel = await OverpassResponseParser.ParseAsync(response.Content, cancellationToken);
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

        var items = PoiNormalizer.MapElements(
            payloadModel.Elements ?? [],
            request.Geometry.Coordinates,
            categories,
            corridorMeters,
            safeLimit,
            preferredLanguage);

        _cache.Set(cacheKey, items, TimeSpan.FromSeconds(_options.Cache.AroundRouteTtlSeconds));
        await TrySetDistributedAsync(cacheKey, items, _options.Cache.AroundRouteTtlSeconds, cancellationToken);

        return items;
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
        if (coordinates.Count == 0)
        {
            return "empty";
        }

        var builder = new StringBuilder();
        foreach (var coord in coordinates)
        {
            if (coord.Length < 2)
            {
                continue;
            }

            builder
                .Append(coord[0].ToString("F6", System.Globalization.CultureInfo.InvariantCulture))
                .Append(',')
                .Append(coord[1].ToString("F6", System.Globalization.CultureInfo.InvariantCulture))
                .Append(';');
        }

        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(builder.ToString()));
        return Convert.ToHexString(bytes);
    }

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
}
