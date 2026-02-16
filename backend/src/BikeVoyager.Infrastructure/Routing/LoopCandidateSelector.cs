using BikeVoyager.Application.Routing;

namespace BikeVoyager.Infrastructure.Routing;

internal static class LoopCandidateSelector
{
    private const int MaxCandidates = 14;

    private static readonly double[] AngleCandidates = { 70d, 90d, 110d, 130d };
    private static readonly double[] RadiusFactors = { 0.85, 1d, 1.15 };

    public static IEnumerable<LoopCandidate> BuildCandidates(RoutePoint start, double targetKm, int seed)
    {
        var baseRadius = Math.Max(0.8, targetKm / 3.4);
        var random = new Random(seed);
        var bearingStep = 360d / MaxCandidates;

        for (var i = 0; i < MaxCandidates; i++)
        {
            var angle = AngleCandidates[i % AngleCandidates.Length];
            var radiusFactor = RadiusFactors[(i / AngleCandidates.Length) % RadiusFactors.Length];
            var radiusKm = baseRadius * radiusFactor;
            var bearing = (bearingStep * i) + (random.NextDouble() - 0.5) * bearingStep * 0.4;
            var radiusB = radiusKm * (0.9 + random.NextDouble() * 0.2);

            var pointA = LoopGeoMath.Offset(start, radiusKm, bearing);
            var pointB = LoopGeoMath.Offset(start, radiusB, bearing + angle);

            yield return new LoopCandidate(pointA, pointB);
        }
    }

    public static double EstimateLoopDistanceKm(
        RoutePoint start,
        IReadOnlyList<RoutePoint>? waypoints,
        LoopPoint a,
        LoopPoint b)
    {
        var orderedIntermediates = BuildOrderedLoopIntermediates(start, waypoints, a, b);
        if (orderedIntermediates.Count == 0)
        {
            return 0;
        }

        var distanceKm = 0d;
        var previous = start;
        foreach (var point in orderedIntermediates)
        {
            distanceKm += LoopGeoMath.HaversineKm(previous.Lat, previous.Lon, point.Lat, point.Lon);
            previous = point;
        }

        distanceKm += LoopGeoMath.HaversineKm(previous.Lat, previous.Lon, start.Lat, start.Lon);
        return distanceKm;
    }

    public static List<RoutePoint> BuildOrderedLoopIntermediates(
        RoutePoint start,
        IReadOnlyList<RoutePoint>? userWaypoints,
        LoopPoint a,
        LoopPoint b)
    {
        var rawPoints = new List<RoutePoint>();
        if (userWaypoints is { Count: > 0 })
        {
            rawPoints.AddRange(userWaypoints);
        }

        rawPoints.Add(new RoutePoint(a.Lat, a.Lon, "loop-candidate-a"));
        rawPoints.Add(new RoutePoint(b.Lat, b.Lon, "loop-candidate-b"));

        return WaypointOptimizer.OrderForLoop(start, rawPoints).ToList();
    }
}
