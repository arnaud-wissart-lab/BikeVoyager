using BikeVoyager.Application.Routing;

namespace BikeVoyager.Infrastructure.Routing;

internal static class WaypointOptimizer
{
    private const double EarthRadiusMeters = 6371000d;
    private const double MinDistinctDistanceMeters = 15d;
    private const int MaxExactOptimizationWaypoints = 12;

    public static IReadOnlyList<RoutePoint> OrderForRoute(
        RoutePoint start,
        RoutePoint end,
        IReadOnlyList<RoutePoint>? waypoints)
    {
        return OrderCore(start, end, waypoints, fallbackEndWeight: 0.35);
    }

    public static IReadOnlyList<RoutePoint> OrderForLoop(
        RoutePoint start,
        IReadOnlyList<RoutePoint>? waypoints)
    {
        return OrderCore(start, start, waypoints, fallbackEndWeight: 0.18);
    }

    public static IReadOnlyList<RoutePoint> PreserveOrder(
        RoutePoint start,
        IReadOnlyList<RoutePoint>? waypoints)
    {
        return NormalizeWaypoints(start, waypoints);
    }

    private static IReadOnlyList<RoutePoint> OrderCore(
        RoutePoint start,
        RoutePoint endReference,
        IReadOnlyList<RoutePoint>? waypoints,
        double fallbackEndWeight)
    {
        var normalized = NormalizeWaypoints(start, waypoints).ToList();
        if (normalized.Count <= 1)
        {
            return normalized;
        }

        if (normalized.Count <= MaxExactOptimizationWaypoints)
        {
            return OrderExact(start, endReference, normalized, fallbackEndWeight);
        }

        return OrderGreedy(start, endReference, normalized, fallbackEndWeight);
    }

    private static IReadOnlyList<RoutePoint> OrderExact(
        RoutePoint start,
        RoutePoint endReference,
        IReadOnlyList<RoutePoint> waypoints,
        double fallbackEndWeight)
    {
        var count = waypoints.Count;
        var fullMask = (1 << count) - 1;
        var startDistances = new double[count];
        var endDistances = new double[count];
        var betweenDistances = new double[count, count];

        for (var i = 0; i < count; i += 1)
        {
            startDistances[i] = HaversineMeters(start.Lat, start.Lon, waypoints[i].Lat, waypoints[i].Lon);
            endDistances[i] = HaversineMeters(waypoints[i].Lat, waypoints[i].Lon, endReference.Lat, endReference.Lon);

            for (var j = 0; j < count; j += 1)
            {
                betweenDistances[i, j] = i == j
                    ? 0d
                    : HaversineMeters(waypoints[i].Lat, waypoints[i].Lon, waypoints[j].Lat, waypoints[j].Lon);
            }
        }

        var dp = new double[fullMask + 1, count];
        var previous = new int[fullMask + 1, count];

        for (var mask = 0; mask <= fullMask; mask += 1)
        {
            for (var i = 0; i < count; i += 1)
            {
                dp[mask, i] = double.PositiveInfinity;
                previous[mask, i] = -1;
            }
        }

        for (var i = 0; i < count; i += 1)
        {
            var mask = 1 << i;
            dp[mask, i] = startDistances[i];
        }

        for (var mask = 1; mask <= fullMask; mask += 1)
        {
            for (var last = 0; last < count; last += 1)
            {
                if ((mask & (1 << last)) == 0)
                {
                    continue;
                }

                var current = dp[mask, last];
                if (double.IsPositiveInfinity(current))
                {
                    continue;
                }

                for (var next = 0; next < count; next += 1)
                {
                    if ((mask & (1 << next)) != 0)
                    {
                        continue;
                    }

                    var nextMask = mask | (1 << next);
                    var candidate = current + betweenDistances[last, next];
                    if (candidate < dp[nextMask, next])
                    {
                        dp[nextMask, next] = candidate;
                        previous[nextMask, next] = last;
                    }
                }
            }
        }

        var bestLast = -1;
        var bestTotal = double.PositiveInfinity;
        for (var last = 0; last < count; last += 1)
        {
            var current = dp[fullMask, last];
            if (double.IsPositiveInfinity(current))
            {
                continue;
            }

            var candidate = current + endDistances[last];
            if (candidate < bestTotal)
            {
                bestTotal = candidate;
                bestLast = last;
            }
        }

        if (bestLast < 0)
        {
            return OrderGreedy(start, endReference, waypoints, fallbackEndWeight);
        }

        var ordered = new List<RoutePoint>(count);
        var traversalMask = fullMask;
        var traversalIndex = bestLast;
        while (traversalIndex >= 0)
        {
            ordered.Add(waypoints[traversalIndex]);
            var previousIndex = previous[traversalMask, traversalIndex];
            traversalMask &= ~(1 << traversalIndex);
            traversalIndex = previousIndex;
        }

        ordered.Reverse();
        return ordered;
    }

    private static IReadOnlyList<RoutePoint> OrderGreedy(
        RoutePoint start,
        RoutePoint endReference,
        IReadOnlyList<RoutePoint> waypoints,
        double endWeight)
    {
        var remaining = waypoints.ToList();
        var ordered = new List<RoutePoint>(remaining.Count);
        var current = start;

        while (remaining.Count > 0)
        {
            var bestIndex = 0;
            var bestScore = double.PositiveInfinity;

            for (var i = 0; i < remaining.Count; i += 1)
            {
                var candidate = remaining[i];
                var distanceFromCurrent = HaversineMeters(current.Lat, current.Lon, candidate.Lat, candidate.Lon);
                var distanceToEnd = HaversineMeters(candidate.Lat, candidate.Lon, endReference.Lat, endReference.Lon);
                var score = distanceFromCurrent + (distanceToEnd * endWeight);

                if (score < bestScore)
                {
                    bestScore = score;
                    bestIndex = i;
                }
            }

            var selected = remaining[bestIndex];
            ordered.Add(selected);
            remaining.RemoveAt(bestIndex);
            current = selected;
        }

        return ordered;
    }

    private static IReadOnlyList<RoutePoint> NormalizeWaypoints(
        RoutePoint start,
        IReadOnlyList<RoutePoint>? waypoints)
    {
        if (waypoints is null || waypoints.Count == 0)
        {
            return Array.Empty<RoutePoint>();
        }

        var normalized = new List<RoutePoint>(waypoints.Count);
        foreach (var waypoint in waypoints)
        {
            if (!double.IsFinite(waypoint.Lat) || !double.IsFinite(waypoint.Lon))
            {
                continue;
            }

            if (waypoint.Lat is < -90 or > 90 || waypoint.Lon is < -180 or > 180)
            {
                continue;
            }

            var distanceFromStart = HaversineMeters(start.Lat, start.Lon, waypoint.Lat, waypoint.Lon);
            if (distanceFromStart < MinDistinctDistanceMeters)
            {
                continue;
            }

            if (normalized.Any(existing =>
                HaversineMeters(existing.Lat, existing.Lon, waypoint.Lat, waypoint.Lon) < MinDistinctDistanceMeters))
            {
                continue;
            }

            var label = string.IsNullOrWhiteSpace(waypoint.Label)
                ? $"{waypoint.Lat:F5},{waypoint.Lon:F5}"
                : waypoint.Label.Trim();

            normalized.Add(new RoutePoint(waypoint.Lat, waypoint.Lon, label));
        }

        return normalized;
    }

    private static double HaversineMeters(double latA, double lonA, double latB, double lonB)
    {
        var dLat = DegreesToRadians(latB - latA);
        var dLon = DegreesToRadians(lonB - lonA);
        var radLatA = DegreesToRadians(latA);
        var radLatB = DegreesToRadians(latB);

        var a = Math.Pow(Math.Sin(dLat / 2), 2) +
            Math.Cos(radLatA) * Math.Cos(radLatB) *
            Math.Pow(Math.Sin(dLon / 2), 2);
        var c = 2 * Math.Asin(Math.Min(1, Math.Sqrt(a)));
        return EarthRadiusMeters * c;
    }

    private static double DegreesToRadians(double degrees) => degrees * Math.PI / 180d;
}
