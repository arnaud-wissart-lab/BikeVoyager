using System.Text.Json.Serialization;

namespace BikeVoyager.Infrastructure.Pois;

internal sealed record TagFilter(string Key, string[]? Values);

internal sealed record PoiCategoryDefinition(string Key, IReadOnlyList<TagFilter> Filters);

internal sealed record OverpassBounds(double MinLat, double MinLon, double MaxLat, double MaxLon);

internal sealed record SegmentProjection(double DistanceMeters, double T);

internal sealed record SegmentPairProjection(double DistanceMeters, double RouteT, double FeatureT);

internal sealed record RouteProjection(
    double DistanceToRouteMeters,
    double DistanceAlongRouteMeters,
    double PoiLat,
    double PoiLon);

internal sealed record PoiMatch(
    string Id,
    string Name,
    double Lat,
    double Lon,
    string Category,
    string? Kind,
    string OsmType,
    long OsmId,
    IReadOnlyDictionary<string, string>? Tags,
    double DistanceToRouteMeters,
    double DistanceAlongRouteMeters);

internal sealed record OverpassResponse(
    [property: JsonPropertyName("elements")] List<OverpassElement>? Elements);

internal sealed record OverpassElement(
    [property: JsonPropertyName("type")] string Type,
    [property: JsonPropertyName("id")] long Id,
    [property: JsonPropertyName("lat")] double? Lat,
    [property: JsonPropertyName("lon")] double? Lon,
    [property: JsonPropertyName("center")] OverpassCenter? Center,
    [property: JsonPropertyName("geometry")] List<OverpassGeometryPoint>? Geometry,
    [property: JsonPropertyName("tags")] Dictionary<string, string>? Tags);

internal sealed record OverpassCenter(
    [property: JsonPropertyName("lat")] double? Lat,
    [property: JsonPropertyName("lon")] double? Lon);

internal sealed record OverpassGeometryPoint(
    [property: JsonPropertyName("lat")] double Lat,
    [property: JsonPropertyName("lon")] double Lon);
