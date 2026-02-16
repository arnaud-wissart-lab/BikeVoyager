using System.Text.Json.Serialization;

namespace BikeVoyager.Infrastructure.Routing;

internal sealed record ValhallaRouteRequest(
    [property: JsonPropertyName("locations")] IReadOnlyList<ValhallaLocation> Locations,
    [property: JsonPropertyName("costing")] string Costing,
    [property: JsonPropertyName("directions_options")] ValhallaDirectionsOptions DirectionsOptions,
    [property: JsonPropertyName("costing_options")] Dictionary<string, object>? CostingOptions);

internal sealed record ValhallaLocation(
    [property: JsonPropertyName("lat")] double Lat,
    [property: JsonPropertyName("lon")] double Lon,
    [property: JsonPropertyName("type")] string? Type = null);

internal sealed record ValhallaDirectionsOptions(
    [property: JsonPropertyName("units")] string Units,
    [property: JsonPropertyName("language")] string Language);

internal sealed record ValhallaBicycleCostingOptions(
    [property: JsonPropertyName("use_roads")] double UseRoads,
    [property: JsonPropertyName("use_hills")] double UseHills);

internal sealed record ValhallaPedestrianCostingOptions(
    [property: JsonPropertyName("use_hills")] double UseHills);

internal sealed record ValhallaRouteResponse(
    [property: JsonPropertyName("trip")] ValhallaTrip? Trip);

internal sealed record ValhallaTrip(
    [property: JsonPropertyName("legs")] List<ValhallaLeg> Legs);

internal sealed record ValhallaLeg(
    [property: JsonPropertyName("shape")] string? Shape,
    [property: JsonPropertyName("summary")] ValhallaSummary? Summary);

internal sealed record ValhallaSummary(
    [property: JsonPropertyName("length")] double Length,
    [property: JsonPropertyName("time")] double Time);
