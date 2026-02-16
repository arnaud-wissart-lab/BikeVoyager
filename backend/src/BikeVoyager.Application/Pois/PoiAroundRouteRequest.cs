using BikeVoyager.Application.Routing;

namespace BikeVoyager.Application.Pois;

public sealed record PoiAroundRouteRequest(
    GeoJsonLineString Geometry,
    IReadOnlyList<string> Categories,
    double CorridorMeters,
    int Limit,
    string? Language = null);
