using BikeVoyager.Application.Routing;
using System.IO;
using System.Text.Json.Serialization;

namespace BikeVoyager.Api.Exports;

public sealed record ExportRouteRequest(
    [property: JsonPropertyName("geometry")] GeoJsonLineString Geometry,
    [property: JsonPropertyName("elevation_profile")]
    IReadOnlyList<RouteElevationPoint>? ElevationProfile,
    [property: JsonPropertyName("name")] string? Name);

public sealed record RouteExportData(
    string Name,
    IReadOnlyList<RouteExportPoint> Points);

public readonly record struct RouteExportPoint(
    double Lon,
    double Lat,
    double? Altitude,
    double DistanceMeters);

public static class RouteExportDataBuilder
{
    public static bool TryBuild(
        ExportRouteRequest request,
        out RouteExportData? data,
        out string? error)
    {
        data = null;
        error = null;

        if (request?.Geometry is null || request.Geometry.Coordinates is null)
        {
            error = "La géométrie est obligatoire.";
            return false;
        }

        if (!string.Equals(request.Geometry.Type, "LineString", StringComparison.OrdinalIgnoreCase))
        {
            error = "La géométrie doit être de type LineString.";
            return false;
        }

        var sourcePoints = ExtractPoints(request.Geometry.Coordinates);
        if (sourcePoints.Count < 2)
        {
            error = "La géométrie doit contenir au moins 2 points valides.";
            return false;
        }

        var distances = BuildCumulativeDistances(sourcePoints);
        var elevations = BuildElevations(distances, request.ElevationProfile);
        var points = sourcePoints
            .Select((point, index) => new RouteExportPoint(
                point.Lon,
                point.Lat,
                elevations?[index] ?? point.Altitude,
                distances[index]))
            .ToList();
        var routeName = string.IsNullOrWhiteSpace(request.Name)
            ? "BikeVoyager"
            : request.Name.Trim();

        data = new RouteExportData(routeName, points);
        return true;
    }

    public static string BuildFileName(string? name, string extension)
    {
        var normalizedExtension = extension.Trim().TrimStart('.');
        var baseName = string.IsNullOrWhiteSpace(name) ? "bikevoyager" : name.Trim();
        var cleaned = new string(
            baseName
                .Where(ch => !Path.GetInvalidFileNameChars().Contains(ch))
                .ToArray());
        cleaned = string.IsNullOrWhiteSpace(cleaned) ? "bikevoyager" : cleaned;
        var suffix = $".{normalizedExtension}";
        if (!cleaned.EndsWith(suffix, StringComparison.OrdinalIgnoreCase))
        {
            cleaned += suffix;
        }

        return cleaned;
    }

    private static List<SourcePoint> ExtractPoints(IReadOnlyList<double[]> coordinates)
    {
        var points = new List<SourcePoint>(coordinates.Count);

        foreach (var coordinate in coordinates)
        {
            if (coordinate.Length < 2)
            {
                continue;
            }

            var lon = coordinate[0];
            var lat = coordinate[1];
            if (!double.IsFinite(lon) || !double.IsFinite(lat))
            {
                continue;
            }

            double? altitude = null;
            if (coordinate.Length >= 3 && double.IsFinite(coordinate[2]))
            {
                altitude = coordinate[2];
            }

            points.Add(new SourcePoint(lon, lat, altitude));
        }

        return points;
    }

    private static List<double>? BuildElevations(
        IReadOnlyList<double> distances,
        IReadOnlyList<RouteElevationPoint>? profile)
    {
        if (profile is null || profile.Count < 2)
        {
            return null;
        }

        var cleanedProfile = profile
            .Where(item => double.IsFinite(item.DistanceMeters) && double.IsFinite(item.ElevationMeters))
            .OrderBy(item => item.DistanceMeters)
            .ToList();

        if (cleanedProfile.Count < 2)
        {
            return null;
        }

        return distances
            .Select(distance => InterpolateElevation(cleanedProfile, distance))
            .ToList();
    }

    private static List<double> BuildCumulativeDistances(IReadOnlyList<SourcePoint> points)
    {
        var distances = new List<double>(points.Count) { 0 };
        for (var index = 1; index < points.Count; index += 1)
        {
            var segment = HaversineDistanceMeters(points[index - 1], points[index]);
            distances.Add(distances[index - 1] + segment);
        }

        return distances;
    }

    private static double HaversineDistanceMeters(SourcePoint a, SourcePoint b)
    {
        const double earthRadius = 6371000;
        var dLat = ToRadians(b.Lat - a.Lat);
        var dLon = ToRadians(b.Lon - a.Lon);
        var lat1 = ToRadians(a.Lat);
        var lat2 = ToRadians(b.Lat);

        var sinLat = Math.Sin(dLat / 2);
        var sinLon = Math.Sin(dLon / 2);
        var h = sinLat * sinLat + Math.Cos(lat1) * Math.Cos(lat2) * sinLon * sinLon;
        return 2 * earthRadius * Math.Asin(Math.Min(1, Math.Sqrt(h)));
    }

    private static double ToRadians(double value) => value * Math.PI / 180;

    private static double InterpolateElevation(
        IReadOnlyList<RouteElevationPoint> profile,
        double distance)
    {
        if (distance <= profile[0].DistanceMeters)
        {
            return profile[0].ElevationMeters;
        }

        for (var index = 1; index < profile.Count; index += 1)
        {
            var previous = profile[index - 1];
            var current = profile[index];
            if (distance > current.DistanceMeters)
            {
                continue;
            }

            var span = current.DistanceMeters - previous.DistanceMeters;
            if (span <= 0)
            {
                return current.ElevationMeters;
            }

            var ratio = (distance - previous.DistanceMeters) / span;
            return previous.ElevationMeters +
                ratio * (current.ElevationMeters - previous.ElevationMeters);
        }

        return profile[^1].ElevationMeters;
    }

    private readonly record struct SourcePoint(double Lon, double Lat, double? Altitude);
}
