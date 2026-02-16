using System.Text.Json.Serialization;

namespace BikeVoyager.Application.Routing;

public sealed record RouteResponse(
    [property: JsonPropertyName("geometry")] GeoJsonLineString Geometry,
    [property: JsonPropertyName("distance_m")] double DistanceMeters,
    [property: JsonPropertyName("duration_s_engine")] double DurationSecondsEngine,
    [property: JsonPropertyName("eta_s")] double EtaSeconds,
    [property: JsonPropertyName("turn_by_turn")] IReadOnlyList<RouteInstruction> TurnByTurn,
    [property: JsonPropertyName("elevation_profile")] IReadOnlyList<RouteElevationPoint> ElevationProfile);

public sealed record GeoJsonLineString(
    [property: JsonPropertyName("type")] string Type,
    [property: JsonPropertyName("coordinates")] IReadOnlyList<double[]> Coordinates);

public sealed record RouteInstruction(
    [property: JsonPropertyName("instruction")] string Instruction,
    [property: JsonPropertyName("distance_m")] double DistanceMeters,
    [property: JsonPropertyName("duration_s")] double DurationSeconds,
    [property: JsonPropertyName("type")] int Type);

public sealed record RouteElevationPoint(
    [property: JsonPropertyName("distance_m")] double DistanceMeters,
    [property: JsonPropertyName("elevation_m")] double ElevationMeters);
