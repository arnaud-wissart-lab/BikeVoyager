using System.Text.Json.Serialization;

namespace BikeVoyager.Application.Routing;

public sealed record LoopResponse(
    [property: JsonPropertyName("geometry")] GeoJsonLineString Geometry,
    [property: JsonPropertyName("distance_m")] double DistanceMeters,
    [property: JsonPropertyName("eta_s")] double EtaSeconds,
    [property: JsonPropertyName("overlapScore")] string OverlapScore,
    [property: JsonPropertyName("segmentsCount")] int SegmentsCount,
    [property: JsonPropertyName("elevation_profile")] IReadOnlyList<RouteElevationPoint> ElevationProfile);
