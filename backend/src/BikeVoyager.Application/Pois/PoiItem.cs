using System.Text.Json.Serialization;

namespace BikeVoyager.Application.Pois;

public sealed record PoiItem(
    [property: JsonPropertyName("id")] string Id,
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("lat")] double Lat,
    [property: JsonPropertyName("lon")] double Lon,
    [property: JsonPropertyName("category")] string Category,
    [property: JsonPropertyName("kind")] string? Kind,
    [property: JsonPropertyName("distance_m")] double DistanceMeters,
    [property: JsonPropertyName("distance_to_route_m")] double? DistanceToRouteMeters = null,
    [property: JsonPropertyName("osm_type")] string? OsmType = null,
    [property: JsonPropertyName("osm_id")] long? OsmId = null,
    [property: JsonPropertyName("tags")] IReadOnlyDictionary<string, string>? Tags = null);
