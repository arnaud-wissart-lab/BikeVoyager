using System.Globalization;
using System.Text;

namespace BikeVoyager.Infrastructure.Pois;

internal static class OverpassQueryBuilder
{
    public static IReadOnlyList<string> NormalizeCategories(IReadOnlyList<string> categories)
    {
        if (categories.Count == 0)
        {
            return OverpassPoiCatalog.DefaultCategories.ToArray();
        }

        var normalized = new List<string>();
        foreach (var category in categories)
        {
            if (string.IsNullOrWhiteSpace(category))
            {
                continue;
            }

            if (!OverpassPoiCatalog.CategoryDefinitions.ContainsKey(category.Trim()))
            {
                continue;
            }

            normalized.Add(category.Trim().ToLowerInvariant());
        }

        if (normalized.Count == 0)
        {
            return OverpassPoiCatalog.DefaultCategories.ToArray();
        }

        return normalized.Distinct(StringComparer.OrdinalIgnoreCase).ToList();
    }

    public static string BuildQuery(IReadOnlyList<string> categories, OverpassBounds bounds)
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
            if (!OverpassPoiCatalog.CategoryDefinitions.TryGetValue(category, out var definition))
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
}
