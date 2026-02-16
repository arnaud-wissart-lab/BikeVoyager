namespace BikeVoyager.Infrastructure.Routing;

internal static class ValhallaPolylineDecoder
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
