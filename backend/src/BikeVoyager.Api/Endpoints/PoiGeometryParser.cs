using BikeVoyager.Application.Routing;
using System.Text.Json;

namespace BikeVoyager.Api.Endpoints;

internal static class PoiGeometryParser
{
    public static bool TryParseGeometry(
        string? raw,
        out GeoJsonLineString? geometry,
        out string error)
    {
        geometry = null;
        error = "Le paramètre 'geometry' est obligatoire.";

        if (string.IsNullOrWhiteSpace(raw))
        {
            return false;
        }

        var trimmed = raw.Trim();

        if (trimmed.StartsWith("{", StringComparison.Ordinal) || trimmed.StartsWith("[", StringComparison.Ordinal))
        {
            if (!TryParseGeoJsonGeometry(trimmed, out geometry))
            {
                error = "Le paramètre 'geometry' est invalide.";
                return false;
            }

            return true;
        }

        try
        {
            var decoded = PolylineDecoder.DecodeToCoordinates(trimmed);
            if (decoded.Count < 2)
            {
                error = "Le paramètre 'geometry' est invalide.";
                return false;
            }

            geometry = new GeoJsonLineString("LineString", decoded);
            return true;
        }
        catch
        {
            error = "Le paramètre 'geometry' est invalide.";
            return false;
        }
    }

    private static bool TryParseGeoJsonGeometry(string raw, out GeoJsonLineString? geometry)
    {
        geometry = null;

        try
        {
            using var document = JsonDocument.Parse(raw);
            var root = document.RootElement;
            var coordinatesElement = root;

            if (root.ValueKind == JsonValueKind.Object &&
                root.TryGetProperty("coordinates", out var coords))
            {
                coordinatesElement = coords;
            }

            if (coordinatesElement.ValueKind != JsonValueKind.Array)
            {
                return false;
            }

            var coordinates = new List<double[]>();

            foreach (var coordinate in coordinatesElement.EnumerateArray())
            {
                if (coordinate.ValueKind != JsonValueKind.Array)
                {
                    continue;
                }

                var items = coordinate.EnumerateArray().ToArray();
                if (items.Length < 2)
                {
                    continue;
                }

                if (!items[0].TryGetDouble(out var lon) || !items[1].TryGetDouble(out var lat))
                {
                    continue;
                }

                coordinates.Add(new[] { lon, lat });
            }

            if (coordinates.Count < 2)
            {
                return false;
            }

            geometry = new GeoJsonLineString("LineString", coordinates);
            return true;
        }
        catch
        {
            return false;
        }
    }

    private static class PolylineDecoder
    {
        public static List<double[]> DecodeToCoordinates(string encoded, int precision = 6)
        {
            var decoded = Decode(encoded, precision);
            var coordinates = new List<double[]>(decoded.Count);
            foreach (var (lat, lon) in decoded)
            {
                coordinates.Add(new[] { lon, lat });
            }

            return coordinates;
        }

        private static List<(double Lat, double Lon)> Decode(string encoded, int precision)
        {
            var coordinates = new List<(double, double)>();
            var factor = Math.Pow(10, precision);
            var index = 0;
            long lat = 0;
            long lon = 0;

            while (index < encoded.Length)
            {
                lat += DecodeNext(encoded, ref index);
                lon += DecodeNext(encoded, ref index);
                coordinates.Add((lat / factor, lon / factor));
            }

            return coordinates;
        }

        private static long DecodeNext(string encoded, ref int index)
        {
            long result = 0;
            var shift = 0;
            int b;

            do
            {
                b = encoded[index++] - 63;
                result |= (long)(b & 0x1F) << shift;
                shift += 5;
            } while (b >= 0x20 && index < encoded.Length);

            return (result & 1) != 0 ? ~(result >> 1) : result >> 1;
        }
    }
}
