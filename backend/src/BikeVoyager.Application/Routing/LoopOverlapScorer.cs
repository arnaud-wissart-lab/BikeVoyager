using System.Globalization;

namespace BikeVoyager.Application.Routing;

public static class LoopOverlapScorer
{
    public static LoopOverlapResult Compute(IReadOnlyList<double[]> coordinates, int precision = 5)
    {
        if (coordinates is null || coordinates.Count < 2)
        {
            return new LoopOverlapResult("faible", 0, 0, 0);
        }

        var factor = Math.Pow(10, precision);
        var segments = new Dictionary<string, int>(StringComparer.Ordinal);
        var totalSegments = 0;

        for (var i = 0; i < coordinates.Count - 1; i++)
        {
            var key = BuildSegmentKey(coordinates[i], coordinates[i + 1], factor);
            if (key is null)
            {
                continue;
            }

            totalSegments++;
            segments[key] = segments.TryGetValue(key, out var count) ? count + 1 : 1;
        }

        if (totalSegments == 0)
        {
            return new LoopOverlapResult("faible", 0, 0, 0);
        }

        var overlapSegments = segments.Values
            .Where(value => value > 1)
            .Sum(value => value - 1);

        var ratio = overlapSegments / (double)totalSegments;
        var score = ratio switch
        {
            < 0.08 => "faible",
            < 0.18 => "moyen",
            _ => "élevé"
        };

        return new LoopOverlapResult(score, ratio, totalSegments, overlapSegments);
    }

    private static string? BuildSegmentKey(double[] start, double[] end, double factor)
    {
        if (start.Length < 2 || end.Length < 2)
        {
            return null;
        }

        var startLon = Quantize(start[0], factor);
        var startLat = Quantize(start[1], factor);
        var endLon = Quantize(end[0], factor);
        var endLat = Quantize(end[1], factor);

        if (startLon is null || startLat is null || endLon is null || endLat is null)
        {
            return null;
        }

        var startLonValue = startLon.Value;
        var startLatValue = startLat.Value;
        var endLonValue = endLon.Value;
        var endLatValue = endLat.Value;

        var (aLon, aLat, bLon, bLat) = startLonValue > endLonValue ||
            (startLonValue == endLonValue && startLatValue > endLatValue)
            ? (endLonValue, endLatValue, startLonValue, startLatValue)
            : (startLonValue, startLatValue, endLonValue, endLatValue);

        return string.Create(
            CultureInfo.InvariantCulture,
            $"{aLon}:{aLat}:{bLon}:{bLat}");
    }

    private static long? Quantize(double value, double factor)
    {
        if (!double.IsFinite(value))
        {
            return null;
        }

        return (long)Math.Round(value * factor, MidpointRounding.AwayFromZero);
    }
}

public sealed record LoopOverlapResult(
    string Score,
    double Ratio,
    int SegmentsCount,
    int OverlapSegmentsCount);
