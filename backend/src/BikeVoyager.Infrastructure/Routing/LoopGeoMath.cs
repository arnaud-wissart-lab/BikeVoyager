using BikeVoyager.Application.Routing;

namespace BikeVoyager.Infrastructure.Routing;

internal static class LoopGeoMath
{
    private const double EarthRadiusKm = 6371d;

    public static LoopPoint Offset(RoutePoint start, double distanceKm, double bearingDegrees)
    {
        var bearing = DegreesToRadians(bearingDegrees);
        var distance = distanceKm / EarthRadiusKm;
        var lat1 = DegreesToRadians(start.Lat);
        var lon1 = DegreesToRadians(start.Lon);

        var lat2 = Math.Asin(
            Math.Sin(lat1) * Math.Cos(distance) +
            Math.Cos(lat1) * Math.Sin(distance) * Math.Cos(bearing));

        var lon2 = lon1 + Math.Atan2(
            Math.Sin(bearing) * Math.Sin(distance) * Math.Cos(lat1),
            Math.Cos(distance) - Math.Sin(lat1) * Math.Sin(lat2));

        return new LoopPoint(RadiansToDegrees(lat2), NormalizeLongitude(RadiansToDegrees(lon2)));
    }

    public static double HaversineKm(double lat1, double lon1, double lat2, double lon2)
    {
        var dLat = DegreesToRadians(lat2 - lat1);
        var dLon = DegreesToRadians(lon2 - lon1);
        var radLat1 = DegreesToRadians(lat1);
        var radLat2 = DegreesToRadians(lat2);

        var a = Math.Pow(Math.Sin(dLat / 2), 2) +
            Math.Cos(radLat1) * Math.Cos(radLat2) *
            Math.Pow(Math.Sin(dLon / 2), 2);
        var c = 2 * Math.Asin(Math.Min(1, Math.Sqrt(a)));
        return EarthRadiusKm * c;
    }

    private static double DegreesToRadians(double degrees) => degrees * Math.PI / 180d;

    private static double RadiansToDegrees(double radians) => radians * 180d / Math.PI;

    private static double NormalizeLongitude(double longitude)
    {
        if (longitude is >= -180 and <= 180)
        {
            return longitude;
        }

        var normalized = longitude % 360;
        if (normalized > 180)
        {
            normalized -= 360;
        }
        else if (normalized < -180)
        {
            normalized += 360;
        }

        return normalized;
    }
}
