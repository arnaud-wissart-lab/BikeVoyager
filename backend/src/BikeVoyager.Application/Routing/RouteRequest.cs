namespace BikeVoyager.Application.Routing;

public sealed record RouteRequest(
    RoutePoint From,
    RoutePoint To,
    IReadOnlyList<RoutePoint>? Waypoints,
    string Mode,
    RouteOptions? Options,
    double SpeedKmh,
    bool OptimizeWaypoints = true,
    string? EbikeAssist = null);

public sealed record RoutePoint(
    double Lat,
    double Lon,
    string Label);

public sealed record RouteOptions(
    bool PreferCycleways,
    bool AvoidHills);
