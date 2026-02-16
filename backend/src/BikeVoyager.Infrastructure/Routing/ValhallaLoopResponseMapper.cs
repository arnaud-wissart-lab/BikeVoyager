using BikeVoyager.Application.Routing;

namespace BikeVoyager.Infrastructure.Routing;

internal static class ValhallaLoopResponseMapper
{
    public static LoopRouteSnapshot Map(ValhallaTrip trip, double speedKmh)
    {
        var coordinates = new List<double[]>();

        foreach (var leg in trip.Legs)
        {
            if (string.IsNullOrWhiteSpace(leg.Shape))
            {
                continue;
            }

            var decoded = ValhallaPolylineDecoder.DecodeToCoordinates(leg.Shape);
            if (decoded.Count == 0)
            {
                continue;
            }

            if (coordinates.Count > 0)
            {
                decoded = decoded.Skip(1).ToList();
            }

            coordinates.AddRange(decoded);
        }

        var closedCoordinates = EnsureClosed(coordinates);
        var distanceMeters = trip.Legs.Sum(leg => (leg.Summary?.Length ?? 0) * 1000d);
        var durationSeconds = trip.Legs.Sum(leg => leg.Summary?.Time ?? 0);
        var etaSeconds = ComputeEtaSeconds(distanceMeters, speedKmh, durationSeconds);

        return new LoopRouteSnapshot(
            new GeoJsonLineString("LineString", closedCoordinates),
            distanceMeters,
            etaSeconds);
    }

    private static IReadOnlyList<double[]> EnsureClosed(IReadOnlyList<double[]> coordinates)
    {
        if (coordinates.Count == 0)
        {
            return coordinates;
        }

        var first = coordinates[0];
        var last = coordinates[^1];

        if (CoordinatesMatch(first, last))
        {
            return coordinates;
        }

        var closed = coordinates.ToList();
        closed.Add(new[] { first[0], first[1] });
        return closed;
    }

    private static bool CoordinatesMatch(double[] first, double[] last)
    {
        if (first.Length < 2 || last.Length < 2)
        {
            return false;
        }

        return Math.Abs(first[0] - last[0]) < 0.00001 && Math.Abs(first[1] - last[1]) < 0.00001;
    }

    private static double ComputeEtaSeconds(double distanceMeters, double speedKmh, double fallbackSeconds)
    {
        if (distanceMeters <= 0 || speedKmh <= 0)
        {
            return fallbackSeconds;
        }

        var speedMetersPerSecond = speedKmh * 1000d / 3600d;
        if (speedMetersPerSecond <= 0)
        {
            return fallbackSeconds;
        }

        return distanceMeters / speedMetersPerSecond;
    }
}
