using System.Globalization;
using System.Text;

namespace BikeVoyager.Infrastructure.Pois;

internal static class PoiDeduplicator
{
    public static IReadOnlyList<PoiMatch> MergeSemanticDuplicates(IEnumerable<PoiMatch> matches)
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
                bucket = [match];
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

                var distanceBetweenPois = OverpassGeometryHelper.HaversineDistanceMeters(
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
        if (normalizedName.Length == 0 || OverpassPoiCatalog.GenericPoiNamesForDeduplication.Contains(normalizedName))
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
}
