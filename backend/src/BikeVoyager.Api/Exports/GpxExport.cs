using BikeVoyager.Application.Routing;
using System.Globalization;
using System.IO;
using System.Text.Json.Serialization;
using System.Xml.Linq;

namespace BikeVoyager.Api.Exports;

public sealed record ExportGpxRequest(
    [property: JsonPropertyName("geometry")] GeoJsonLineString Geometry,
    [property: JsonPropertyName("elevation_profile")]
    IReadOnlyList<RouteElevationPoint>? ElevationProfile,
    [property: JsonPropertyName("name")] string? Name);

public static class GpxExportBuilder
{
    private static readonly XNamespace GpxNamespace = "http://www.topografix.com/GPX/1/1";
    private static readonly XNamespace XsiNamespace = "http://www.w3.org/2001/XMLSchema-instance";
    private const string SchemaLocation =
        "http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd";

    public static bool TryBuild(ExportGpxRequest request, out string gpx, out string? error)
    {
        gpx = string.Empty;
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

        var points = ExtractPoints(request.Geometry.Coordinates);
        if (points.Count < 2)
        {
            error = "La géométrie doit contenir au moins 2 points valides.";
            return false;
        }

        var elevations = BuildElevations(points, request.ElevationProfile);
        var trackName = string.IsNullOrWhiteSpace(request.Name)
            ? "BikeVoyager"
            : request.Name.Trim();

        var trackSegment = new XElement(GpxNamespace + "trkseg");
        for (var index = 0; index < points.Count; index += 1)
        {
            var pointData = points[index];
            var point = new XElement(
                GpxNamespace + "trkpt",
                new XAttribute("lat", FormatCoordinate(pointData.Lat)),
                new XAttribute("lon", FormatCoordinate(pointData.Lon)));

            if (elevations is not null)
            {
                point.Add(new XElement(GpxNamespace + "ele", FormatElevation(elevations[index])));
            }
            else if (pointData.Altitude is not null)
            {
                point.Add(new XElement(GpxNamespace + "ele", FormatElevation(pointData.Altitude.Value)));
            }

            trackSegment.Add(point);
        }

        var document = new XDocument(
            new XDeclaration("1.0", "utf-8", "yes"),
            new XElement(
                GpxNamespace + "gpx",
                new XAttribute("version", "1.1"),
                new XAttribute("creator", "BikeVoyager"),
                new XAttribute(XNamespace.Xmlns + "xsi", XsiNamespace),
                new XAttribute(XsiNamespace + "schemaLocation", SchemaLocation),
                new XElement(
                    GpxNamespace + "trk",
                    new XElement(GpxNamespace + "name", trackName),
                    trackSegment)));

        gpx = document.ToString(SaveOptions.DisableFormatting);
        return true;
    }

    public static string BuildFileName(string? name)
    {
        var baseName = string.IsNullOrWhiteSpace(name) ? "bikevoyager" : name.Trim();
        var cleaned = new string(
            baseName
                .Where(ch => !Path.GetInvalidFileNameChars().Contains(ch))
                .ToArray());
        cleaned = string.IsNullOrWhiteSpace(cleaned) ? "bikevoyager" : cleaned;
        if (!cleaned.EndsWith(".gpx", StringComparison.OrdinalIgnoreCase))
        {
            cleaned += ".gpx";
        }

        return cleaned;
    }

    private static List<GpxPoint> ExtractPoints(
        IReadOnlyList<double[]> coordinates)
    {
        var points = new List<GpxPoint>(coordinates.Count);

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

            points.Add(new GpxPoint(lon, lat, altitude));
        }

        return points;
    }

    private static List<double>? BuildElevations(
        IReadOnlyList<GpxPoint> points,
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

        var distances = BuildCumulativeDistances(points);
        return distances
            .Select(distance => InterpolateElevation(cleanedProfile, distance))
            .ToList();
    }

    private static List<double> BuildCumulativeDistances(
        IReadOnlyList<GpxPoint> points)
    {
        var distances = new List<double>(points.Count);
        if (points.Count == 0)
        {
            return distances;
        }

        distances.Add(0);
        for (var i = 1; i < points.Count; i += 1)
        {
            var segment = HaversineDistanceMeters(points[i - 1], points[i]);
            distances.Add(distances[i - 1] + segment);
        }

        return distances;
    }

    private static double HaversineDistanceMeters(GpxPoint a, GpxPoint b)
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
        if (profile.Count == 0)
        {
            return 0;
        }

        if (distance <= profile[0].DistanceMeters)
        {
            return profile[0].ElevationMeters;
        }

        for (var i = 1; i < profile.Count; i += 1)
        {
            var previous = profile[i - 1];
            var current = profile[i];
            if (distance <= current.DistanceMeters)
            {
                var span = current.DistanceMeters - previous.DistanceMeters;
                if (span <= 0)
                {
                    return current.ElevationMeters;
                }

                var ratio = (distance - previous.DistanceMeters) / span;
                return previous.ElevationMeters +
                    ratio * (current.ElevationMeters - previous.ElevationMeters);
            }
        }

        return profile[^1].ElevationMeters;
    }

    private static string FormatCoordinate(double value) =>
        value.ToString("0.######", CultureInfo.InvariantCulture);

    private static string FormatElevation(double value) =>
        value.ToString("0.##", CultureInfo.InvariantCulture);

    private readonly record struct GpxPoint(double Lon, double Lat, double? Altitude);
}
