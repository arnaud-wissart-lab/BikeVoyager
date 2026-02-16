using BikeVoyager.Application.Routing;
using BikeVoyager.Infrastructure.Routing;
using System.Globalization;

namespace BikeVoyager.UnitTests;

public class WaypointOptimizerTests
{
    [Fact]
    public void OrderForRoute_OptimiseLOrdreDesWaypointsVersLaDestination()
    {
        var start = new RoutePoint(48.8566, 2.3522, "Start");
        var end = new RoutePoint(48.8666, 2.4522, "End");
        var waypoints = new[]
        {
            new RoutePoint(48.8650, 2.4400, "Near end"),
            new RoutePoint(48.8575, 2.3600, "Near start"),
        };

        var ordered = WaypointOptimizer.OrderForRoute(start, end, waypoints);

        Assert.Equal(2, ordered.Count);
        Assert.Equal("Near start", ordered[0].Label);
        Assert.Equal("Near end", ordered[1].Label);
    }

    [Fact]
    public void OrderForLoop_IgnoreLesPointsDupliquesOuTropProchesDuDepart()
    {
        var start = new RoutePoint(48.8566, 2.3522, "Start");
        var waypoints = new[]
        {
            new RoutePoint(48.8566, 2.3522, "Same as start"),
            new RoutePoint(48.8570, 2.3530, "A"),
            new RoutePoint(48.8570, 2.3530, "A duplicate"),
            new RoutePoint(48.8600, 2.3600, "B"),
        };

        var ordered = WaypointOptimizer.OrderForLoop(start, waypoints);

        Assert.Equal(2, ordered.Count);
        Assert.Contains(ordered, p => p.Label == "A");
        Assert.Contains(ordered, p => p.Label == "B");
    }

    [Fact]
    public void OrderForRoute_FiltreLesPointsInvalidesEtNormaliseLesLibelles()
    {
        var start = new RoutePoint(48.8566, 2.3522, "Start");
        var end = new RoutePoint(48.8966, 2.4522, "End");
        var waypoints = new[]
        {
            new RoutePoint(double.NaN, 2.3600, "Invalid NaN"),
            new RoutePoint(91.0000, 2.3600, "Invalid latitude"),
            new RoutePoint(48.8570, 2.3530, "   "),
            new RoutePoint(48.8700, 2.3900, " Scenic stop "),
            new RoutePoint(48.8700, 2.3900, "Scenic stop duplicate"),
        };

        var ordered = WaypointOptimizer.OrderForRoute(start, end, waypoints);
        var expectedAutoLabel = string.Format(
            CultureInfo.CurrentCulture,
            "{0:F5},{1:F5}",
            48.8570,
            2.3530);

        Assert.Equal(2, ordered.Count);
        Assert.Contains(ordered, p => p.Label == expectedAutoLabel);
        Assert.Contains(ordered, p => p.Label == "Scenic stop");
    }

    [Fact]
    public void PreserveOrder_ConserveLOrdreDeSaisie_ApresNormalisation()
    {
        var start = new RoutePoint(48.8566, 2.3522, "Start");
        var waypoints = new[]
        {
            new RoutePoint(48.8610, 2.3600, "W1"),
            new RoutePoint(48.8610, 2.3600, "W1 duplicate"),
            new RoutePoint(48.8720, 2.3900, "W2"),
            new RoutePoint(48.8820, 2.4200, "W3"),
        };

        var preserved = WaypointOptimizer.PreserveOrder(start, waypoints);

        Assert.Equal(3, preserved.Count);
        Assert.Equal("W1", preserved[0].Label);
        Assert.Equal("W2", preserved[1].Label);
        Assert.Equal("W3", preserved[2].Label);
    }

    [Fact]
    public void OrderForRoute_TrouveLeMeilleurOrdreGlobal_SansRespecterLOrdreSaisi()
    {
        var start = new RoutePoint(48.0000, 2.0000, "A");
        var end = new RoutePoint(48.0000, 2.1000, "B");
        var waypoints = new[]
        {
            new RoutePoint(48.041273, 2.105107, "W1"),
            new RoutePoint(47.961427, 2.037291, "W2"),
            new RoutePoint(47.984789, 2.051804, "W3"),
        };

        var ordered = WaypointOptimizer.OrderForRoute(start, end, waypoints);

        var optimizedDistance = ComputePathDistanceMeters(start, end, ordered);
        var bruteForceBestDistance = ComputeBestPathDistanceMeters(start, end, waypoints);

        Assert.InRange(
            optimizedDistance,
            bruteForceBestDistance - 0.1,
            bruteForceBestDistance + 0.1);
    }

    private static double ComputeBestPathDistanceMeters(
        RoutePoint start,
        RoutePoint end,
        IReadOnlyList<RoutePoint> waypoints)
    {
        if (waypoints.Count == 0)
        {
            return ComputePathDistanceMeters(start, end, Array.Empty<RoutePoint>());
        }

        var used = new bool[waypoints.Count];
        var current = new List<RoutePoint>(waypoints.Count);
        var best = double.PositiveInfinity;

        void Explore()
        {
            if (current.Count == waypoints.Count)
            {
                var distance = ComputePathDistanceMeters(start, end, current);
                if (distance < best)
                {
                    best = distance;
                }

                return;
            }

            for (var i = 0; i < waypoints.Count; i += 1)
            {
                if (used[i])
                {
                    continue;
                }

                used[i] = true;
                current.Add(waypoints[i]);
                Explore();
                current.RemoveAt(current.Count - 1);
                used[i] = false;
            }
        }

        Explore();
        return best;
    }

    private static double ComputePathDistanceMeters(
        RoutePoint start,
        RoutePoint end,
        IReadOnlyList<RoutePoint> order)
    {
        var total = 0d;
        var previous = start;

        foreach (var waypoint in order)
        {
            total += HaversineMeters(previous.Lat, previous.Lon, waypoint.Lat, waypoint.Lon);
            previous = waypoint;
        }

        total += HaversineMeters(previous.Lat, previous.Lon, end.Lat, end.Lon);
        return total;
    }

    private static double HaversineMeters(double latA, double lonA, double latB, double lonB)
    {
        const double earthRadiusMeters = 6371000d;

        var dLat = DegreesToRadians(latB - latA);
        var dLon = DegreesToRadians(lonB - lonA);
        var radLatA = DegreesToRadians(latA);
        var radLatB = DegreesToRadians(latB);

        var a = Math.Pow(Math.Sin(dLat / 2), 2) +
                Math.Cos(radLatA) * Math.Cos(radLatB) *
                Math.Pow(Math.Sin(dLon / 2), 2);
        var c = 2 * Math.Asin(Math.Min(1, Math.Sqrt(a)));
        return earthRadiusMeters * c;
    }

    private static double DegreesToRadians(double degrees) => degrees * Math.PI / 180d;
}
