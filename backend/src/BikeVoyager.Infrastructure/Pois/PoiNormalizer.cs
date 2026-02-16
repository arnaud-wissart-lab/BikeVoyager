using BikeVoyager.Application.Pois;
using System.Globalization;

namespace BikeVoyager.Infrastructure.Pois;

internal static class PoiNormalizer
{
    public static string? NormalizeLanguage(string? language)
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

    public static IReadOnlyList<PoiItem> MapElements(
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

            var projection = OverpassGeometryHelper.ComputeRouteProjection(
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

        var deduplicated = PoiDeduplicator.MergeSemanticDuplicates(results.Values);

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
            if (!OverpassPoiCatalog.CategoryDefinitions.TryGetValue(category, out var definition))
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

        foreach (var key in OverpassPoiCatalog.KindPriorityKeys)
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
        foreach (var key in OverpassPoiCatalog.KindPriorityKeys)
        {
            if (TryGetTagValue(tags, key, out var value))
            {
                return $"{key}:{value}";
            }
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
}
