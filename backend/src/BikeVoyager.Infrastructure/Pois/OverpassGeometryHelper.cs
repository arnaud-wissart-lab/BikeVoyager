namespace BikeVoyager.Infrastructure.Pois;

internal static class OverpassGeometryHelper
{
    private const double EarthRadiusMeters = 6371000d;

    public static OverpassBounds ComputeBounds(IReadOnlyList<double[]> coordinates)
    {
        var minLat = double.PositiveInfinity;
        var minLon = double.PositiveInfinity;
        var maxLat = double.NegativeInfinity;
        var maxLon = double.NegativeInfinity;

        foreach (var coord in coordinates)
        {
            if (coord.Length < 2)
            {
                continue;
            }

            var lon = coord[0];
            var lat = coord[1];

            if (!double.IsFinite(lat) || !double.IsFinite(lon))
            {
                continue;
            }

            minLat = Math.Min(minLat, lat);
            minLon = Math.Min(minLon, lon);
            maxLat = Math.Max(maxLat, lat);
            maxLon = Math.Max(maxLon, lon);
        }

        return new OverpassBounds(minLat, minLon, maxLat, maxLon);
    }

    public static OverpassBounds ExpandBounds(OverpassBounds bounds, double corridorMeters)
    {
        var latPadding = corridorMeters / 111_320d;
        var midLat = (bounds.MinLat + bounds.MaxLat) / 2d;
        var lonPadding = corridorMeters / (111_320d * Math.Cos(DegreesToRadians(Math.Max(-89, Math.Min(89, midLat)))));

        return new OverpassBounds(
            Math.Max(-90, bounds.MinLat - latPadding),
            Math.Max(-180, bounds.MinLon - lonPadding),
            Math.Min(90, bounds.MaxLat + latPadding),
            Math.Min(180, bounds.MaxLon + lonPadding));
    }

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
            var segmentLengthMeters = HaversineDistanceMeters(routeALat, routeALon, routeBLat, routeBLon);

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

                var projection = ProjectSegmentToSegmentMeters(
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

    public static double HaversineDistanceMeters(double latA, double lonA, double latB, double lonB)
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

            var segmentLengthMeters = HaversineDistanceMeters(a[1], a[0], b[1], b[0]);
            var projection = ProjectPointToSegmentMeters(
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

    private static SegmentPairProjection ProjectSegmentToSegmentMeters(
        double routeALat,
        double routeALon,
        double routeBLat,
        double routeBLon,
        double featureALat,
        double featureALon,
        double featureBLat,
        double featureBLon)
    {
        const double epsilon = 1e-9;

        var referenceLat = (routeALat + routeBLat + featureALat + featureBLat) / 4d;
        var (ax, ay) = ToMeters(routeALat, routeALon, referenceLat);
        var (bx, by) = ToMeters(routeBLat, routeBLon, referenceLat);
        var (cx, cy) = ToMeters(featureALat, featureALon, referenceLat);
        var (dx, dy) = ToMeters(featureBLat, featureBLon, referenceLat);

        var ux = bx - ax;
        var uy = by - ay;
        var vx = dx - cx;
        var vy = dy - cy;
        var wx = ax - cx;
        var wy = ay - cy;

        var a = (ux * ux) + (uy * uy);
        var b = (ux * vx) + (uy * vy);
        var c = (vx * vx) + (vy * vy);
        var d = (ux * wx) + (uy * wy);
        var e = (vx * wx) + (vy * wy);
        var denominator = (a * c) - (b * b);

        if (a <= epsilon && c <= epsilon)
        {
            return new SegmentPairProjection(Math.Sqrt((wx * wx) + (wy * wy)), 0d, 0d);
        }

        if (a <= epsilon)
        {
            var projection = ProjectPointToSegmentMeters(
                routeALat,
                routeALon,
                featureALat,
                featureALon,
                featureBLat,
                featureBLon);
            return new SegmentPairProjection(projection.DistanceMeters, 0d, projection.T);
        }

        if (c <= epsilon)
        {
            var projection = ProjectPointToSegmentMeters(
                featureALat,
                featureALon,
                routeALat,
                routeALon,
                routeBLat,
                routeBLon);
            return new SegmentPairProjection(projection.DistanceMeters, projection.T, 0d);
        }

        double routeNumerator;
        double routeDenominator = denominator;
        double featureNumerator;
        double featureDenominator = denominator;

        if (Math.Abs(denominator) < epsilon)
        {
            routeNumerator = 0d;
            routeDenominator = 1d;
            featureNumerator = e;
            featureDenominator = c;
        }
        else
        {
            routeNumerator = (b * e) - (c * d);
            featureNumerator = (a * e) - (b * d);

            if (routeNumerator < 0d)
            {
                routeNumerator = 0d;
                featureNumerator = e;
                featureDenominator = c;
            }
            else if (routeNumerator > routeDenominator)
            {
                routeNumerator = routeDenominator;
                featureNumerator = e + b;
                featureDenominator = c;
            }
        }

        if (featureNumerator < 0d)
        {
            featureNumerator = 0d;
            if (-d < 0d)
            {
                routeNumerator = 0d;
            }
            else if (-d > a)
            {
                routeNumerator = routeDenominator;
            }
            else
            {
                routeNumerator = -d;
                routeDenominator = a;
            }
        }
        else if (featureNumerator > featureDenominator)
        {
            featureNumerator = featureDenominator;
            if ((-d + b) < 0d)
            {
                routeNumerator = 0d;
            }
            else if ((-d + b) > a)
            {
                routeNumerator = routeDenominator;
            }
            else
            {
                routeNumerator = -d + b;
                routeDenominator = a;
            }
        }

        var routeT = Math.Abs(routeNumerator) < epsilon ? 0d : routeNumerator / routeDenominator;
        var featureT = Math.Abs(featureNumerator) < epsilon ? 0d : featureNumerator / featureDenominator;

        var diffX = wx + (routeT * ux) - (featureT * vx);
        var diffY = wy + (routeT * uy) - (featureT * vy);
        var distance = Math.Sqrt((diffX * diffX) + (diffY * diffY));

        return new SegmentPairProjection(distance, routeT, featureT);
    }

    private static SegmentProjection ProjectPointToSegmentMeters(
        double lat,
        double lon,
        double latA,
        double lonA,
        double latB,
        double lonB)
    {
        var referenceLat = (latA + latB) / 2d;
        var (ax, ay) = ToMeters(latA, lonA, referenceLat);
        var (bx, by) = ToMeters(latB, lonB, referenceLat);
        var (px, py) = ToMeters(lat, lon, referenceLat);

        var dx = bx - ax;
        var dy = by - ay;
        if (Math.Abs(dx) < 0.000001 && Math.Abs(dy) < 0.000001)
        {
            return new SegmentProjection(
                Math.Sqrt(Math.Pow(px - ax, 2) + Math.Pow(py - ay, 2)),
                0);
        }

        var t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy);
        t = Math.Max(0, Math.Min(1, t));

        var projX = ax + (t * dx);
        var projY = ay + (t * dy);

        return new SegmentProjection(
            Math.Sqrt(Math.Pow(px - projX, 2) + Math.Pow(py - projY, 2)),
            t);
    }

    private static (double X, double Y) ToMeters(double lat, double lon, double referenceLat)
    {
        var latRad = DegreesToRadians(lat);
        var lonRad = DegreesToRadians(lon);
        var refLatRad = DegreesToRadians(referenceLat);

        var x = lonRad * Math.Cos(refLatRad) * EarthRadiusMeters;
        var y = latRad * EarthRadiusMeters;
        return (x, y);
    }

    private static double DegreesToRadians(double degrees) => degrees * Math.PI / 180d;
}
