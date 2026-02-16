namespace BikeVoyager.Infrastructure.Pois;

internal static class OverpassRouteProjection
{
    public static RouteProjection ComputeRouteProjection(
        IReadOnlyList<double[]> routeCoordinates,
        double fallbackLat,
        double fallbackLon,
        IReadOnlyList<OverpassGeometryPoint>? geometry)
    {
        if (geometry is null || geometry.Count == 0)
        {
            return ComputeRouteProjectionForPoint(routeCoordinates, fallbackLat, fallbackLon);
        }

        var minDistance = double.PositiveInfinity;
        var distanceAlongRoute = double.PositiveInfinity;
        var poiLat = fallbackLat;
        var poiLon = fallbackLon;
        var traversedMeters = 0d;
        var hadAnyRouteSegment = false;
        var hasFeatureSegments = false;

        for (var i = 1; i < routeCoordinates.Count; i++)
        {
            var routeA = routeCoordinates[i - 1];
            var routeB = routeCoordinates[i];
            if (routeA.Length < 2 || routeB.Length < 2)
            {
                continue;
            }

            var routeALat = routeA[1];
            var routeALon = routeA[0];
            var routeBLat = routeB[1];
            var routeBLon = routeB[0];
            if (!double.IsFinite(routeALat) ||
                !double.IsFinite(routeALon) ||
                !double.IsFinite(routeBLat) ||
                !double.IsFinite(routeBLon))
            {
                continue;
            }

            hadAnyRouteSegment = true;
            var segmentLengthMeters = OverpassCorridorMath.HaversineDistanceMeters(routeALat, routeALon, routeBLat, routeBLon);

            for (var j = 1; j < geometry.Count; j++)
            {
                var featureA = geometry[j - 1];
                var featureB = geometry[j];
                if (!double.IsFinite(featureA.Lat) ||
                    !double.IsFinite(featureA.Lon) ||
                    !double.IsFinite(featureB.Lat) ||
                    !double.IsFinite(featureB.Lon))
                {
                    continue;
                }

                hasFeatureSegments = true;

                var projection = OverpassCorridorMath.ProjectSegmentToSegmentMeters(
                    routeALat,
                    routeALon,
                    routeBLat,
                    routeBLon,
                    featureA.Lat,
                    featureA.Lon,
                    featureB.Lat,
                    featureB.Lon);

                if (projection.DistanceMeters >= minDistance)
                {
                    continue;
                }

                minDistance = projection.DistanceMeters;
                distanceAlongRoute = traversedMeters + (projection.RouteT * segmentLengthMeters);
                poiLat = featureA.Lat + ((featureB.Lat - featureA.Lat) * projection.FeatureT);
                poiLon = featureA.Lon + ((featureB.Lon - featureA.Lon) * projection.FeatureT);
            }

            traversedMeters += segmentLengthMeters;
        }

        if (!hadAnyRouteSegment)
        {
            return new RouteProjection(double.PositiveInfinity, double.PositiveInfinity, fallbackLat, fallbackLon);
        }

        if (!hasFeatureSegments)
        {
            var bestPointProjection = ComputeRouteProjectionForPoint(routeCoordinates, fallbackLat, fallbackLon);
            foreach (var point in geometry)
            {
                if (!double.IsFinite(point.Lat) || !double.IsFinite(point.Lon))
                {
                    continue;
                }

                var pointProjection = ComputeRouteProjectionForPoint(routeCoordinates, point.Lat, point.Lon);
                if (pointProjection.DistanceToRouteMeters < bestPointProjection.DistanceToRouteMeters)
                {
                    bestPointProjection = pointProjection;
                }
            }

            return bestPointProjection;
        }

        if (!double.IsFinite(distanceAlongRoute))
        {
            distanceAlongRoute = traversedMeters;
        }

        return new RouteProjection(minDistance, distanceAlongRoute, poiLat, poiLon);
    }

    private static RouteProjection ComputeRouteProjectionForPoint(
        IReadOnlyList<double[]> routeCoordinates,
        double lat,
        double lon)
    {
        var minDistance = double.PositiveInfinity;
        var distanceAlongRoute = double.PositiveInfinity;
        var traversedMeters = 0d;

        for (var i = 1; i < routeCoordinates.Count; i++)
        {
            var a = routeCoordinates[i - 1];
            var b = routeCoordinates[i];
            if (a.Length < 2 || b.Length < 2)
            {
                continue;
            }

            var segmentLengthMeters = OverpassCorridorMath.HaversineDistanceMeters(a[1], a[0], b[1], b[0]);
            var projection = OverpassCorridorMath.ProjectPointToSegmentMeters(
                lat,
                lon,
                a[1],
                a[0],
                b[1],
                b[0]);

            if (projection.DistanceMeters < minDistance)
            {
                minDistance = projection.DistanceMeters;
                distanceAlongRoute = traversedMeters + (projection.T * segmentLengthMeters);
            }

            traversedMeters += segmentLengthMeters;
        }

        if (!double.IsFinite(distanceAlongRoute))
        {
            distanceAlongRoute = traversedMeters;
        }

        return new RouteProjection(minDistance, distanceAlongRoute, lat, lon);
    }
}
