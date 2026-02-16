namespace BikeVoyager.Application.Routing;

public sealed record LoopRequest(
    RoutePoint Start,
    double TargetDistanceKm,
    string Mode,
    double SpeedKmh,
    int Variation = 0,
    IReadOnlyList<RoutePoint>? Waypoints = null,
    string? EbikeAssist = null);
