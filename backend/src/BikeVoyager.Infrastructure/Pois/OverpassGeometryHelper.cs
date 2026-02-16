namespace BikeVoyager.Infrastructure.Pois;

internal static class OverpassGeometryHelper
{
    public static OverpassBounds ComputeBounds(IReadOnlyList<double[]> coordinates)
        => OverpassCorridorMath.ComputeBounds(coordinates);

    public static OverpassBounds ExpandBounds(OverpassBounds bounds, double corridorMeters)
        => OverpassCorridorMath.ExpandBounds(bounds, corridorMeters);

    public static RouteProjection ComputeRouteProjection(
        IReadOnlyList<double[]> routeCoordinates,
        double fallbackLat,
        double fallbackLon,
        IReadOnlyList<OverpassGeometryPoint>? geometry)
        => OverpassRouteProjection.ComputeRouteProjection(routeCoordinates, fallbackLat, fallbackLon, geometry);

    public static double HaversineDistanceMeters(double latA, double lonA, double latB, double lonB)
        => OverpassCorridorMath.HaversineDistanceMeters(latA, lonA, latB, lonB);
}
