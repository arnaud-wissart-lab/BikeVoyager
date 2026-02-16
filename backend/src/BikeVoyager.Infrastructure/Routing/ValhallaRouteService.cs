using BikeVoyager.Application.Routing;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace BikeVoyager.Infrastructure.Routing;

internal sealed class ValhallaRouteService : IRouteService
{
    private static readonly JsonSerializerOptions SerializerOptions = new(JsonSerializerDefaults.Web)
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    private readonly HttpClient _httpClient;
    private readonly ValhallaOptions _options;
    private readonly ILogger<ValhallaRouteService> _logger;

    public ValhallaRouteService(
        HttpClient httpClient,
        IOptions<ValhallaOptions> options,
        ILogger<ValhallaRouteService> logger)
    {
        _httpClient = httpClient;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<RouteResponse> ComputeAsync(RouteRequest request, CancellationToken cancellationToken)
    {
        var costing = ResolveCosting(request.Mode);
        var locations = BuildLocations(request);
        var valhallaRequest = new ValhallaRouteRequest(
            locations,
            costing,
            new ValhallaDirectionsOptions("kilometers", _options.Language),
            BuildCostingOptions(request.Mode, costing, request.Options, request.EbikeAssist, request.SpeedKmh));

        using var response = await _httpClient.PostAsJsonAsync(
            "route",
            valhallaRequest,
            SerializerOptions,
            cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            var payload = await response.Content.ReadAsStringAsync(cancellationToken);
            _logger.LogWarning(
                "Valhalla a répondu {StatusCode} : {Payload}",
                (int)response.StatusCode,
                payload);
            response.EnsureSuccessStatusCode();
        }

        var payloadModel = await response.Content.ReadFromJsonAsync<ValhallaRouteResponse>(
            SerializerOptions,
            cancellationToken);

        if (payloadModel?.Trip?.Legs is null || payloadModel.Trip.Legs.Count == 0)
        {
            throw new InvalidOperationException("Réponse Valhalla invalide.");
        }

        var responseModel = MapResponse(payloadModel.Trip, request.SpeedKmh);
        var elevationProfile = await ValhallaElevationProfileService.TryBuildAsync(
            _httpClient,
            SerializerOptions,
            responseModel.Geometry.Coordinates,
            _logger,
            cancellationToken);

        return responseModel with
        {
            ElevationProfile = elevationProfile,
        };
    }

    private static string ResolveCosting(string mode) => mode.ToLowerInvariant() switch
    {
        "walking" => "pedestrian",
        "bicycle" => "bicycle",
        "ebike" => "bicycle",
        _ => "bicycle",
    };

    private static Dictionary<string, object>? BuildCostingOptions(
        string mode,
        string costing,
        RouteOptions? options,
        string? ebikeAssist,
        double speedKmh)
    {
        if (costing is not ("bicycle" or "pedestrian"))
        {
            return null;
        }

        var normalizedMode = mode.Trim().ToLowerInvariant();
        var avoidHills = options?.AvoidHills ?? false;
        var useHills = ResolveBaseUseHills(normalizedMode, avoidHills);

        if (!avoidHills)
        {
            useHills += ResolveSpeedHillsBias(normalizedMode, speedKmh);
        }

        if (normalizedMode == "ebike")
        {
            useHills += ResolveEbikeAssistHillsBias(ebikeAssist);
        }

        useHills = Math.Clamp(useHills, 0.05, 0.95);

        if (costing == "bicycle")
        {
            var preferCycleways = options?.PreferCycleways ?? false;
            var useRoads = preferCycleways ? 0.2 : 0.6;
            return new Dictionary<string, object>
            {
                [costing] = new ValhallaBicycleCostingOptions(useRoads, useHills),
            };
        }

        return new Dictionary<string, object>
        {
            [costing] = new ValhallaPedestrianCostingOptions(useHills),
        };
    }

    private static double ResolveEbikeAssistHillsBias(string? assistLevel) =>
        assistLevel?.Trim().ToLowerInvariant() switch
        {
            "low" => -0.25,
            "high" => 0.2,
            _ => 0d,
        };

    private static double ResolveBaseUseHills(string mode, bool avoidHills) =>
        mode switch
        {
            "walking" => avoidHills ? 0.15 : 0.45,
            _ => avoidHills ? 0.2 : 0.7,
        };

    private static double ResolveSpeedHillsBias(string mode, double speedKmh) =>
        mode switch
        {
            "walking" => ResolveBiasFromDefault(speedKmh, 3d, 5d, 7d, 0.1, 0.1),
            "bicycle" => ResolveBiasFromDefault(speedKmh, 10d, 15d, 30d, 0.1, 0.12),
            "ebike" => ResolveBiasFromDefault(speedKmh, 15d, 25d, 25d, 0.1, 0d),
            _ => 0d,
        };

    private static double ResolveBiasFromDefault(
        double speedKmh,
        double minSpeed,
        double baselineSpeed,
        double maxSpeed,
        double downBias,
        double upBias)
    {
        var clampedSpeed = Math.Clamp(speedKmh, minSpeed, maxSpeed);

        if (clampedSpeed < baselineSpeed)
        {
            var range = baselineSpeed - minSpeed;
            if (range <= 0 || downBias <= 0)
            {
                return 0d;
            }

            var ratio = (baselineSpeed - clampedSpeed) / range;
            return -downBias * ratio;
        }

        var upRange = maxSpeed - baselineSpeed;
        if (upRange <= 0 || upBias <= 0)
        {
            return 0d;
        }

        var upRatio = (clampedSpeed - baselineSpeed) / upRange;
        return upBias * upRatio;
    }

    private static RouteResponse MapResponse(ValhallaTrip trip, double speedKmh)
    {
        var coordinates = new List<double[]>();

        foreach (var leg in trip.Legs)
        {
            if (string.IsNullOrWhiteSpace(leg.Shape))
            {
                continue;
            }

            var decoded = PolylineDecoder.DecodeToCoordinates(leg.Shape);
            if (decoded.Count == 0)
            {
                continue;
            }

            if (coordinates.Count > 0)
            {
                decoded = decoded.Skip(1).ToList();
            }

            coordinates.AddRange(decoded);
        }

        var distanceMeters = trip.Legs.Sum(leg => (leg.Summary?.Length ?? 0) * 1000d);
        var durationSeconds = trip.Legs.Sum(leg => leg.Summary?.Time ?? 0);
        var etaSeconds = ComputeEtaSeconds(distanceMeters, speedKmh, durationSeconds);
        var maneuvers = trip.Legs
            .SelectMany(leg => leg.Maneuvers ?? Enumerable.Empty<ValhallaManeuver>())
            .Select(maneuver => new RouteInstruction(
                maneuver.Instruction ?? string.Empty,
                maneuver.Length * 1000d,
                maneuver.Time,
                maneuver.Type))
            .ToList();

        return new RouteResponse(
            new GeoJsonLineString("LineString", coordinates),
            distanceMeters,
            durationSeconds,
            etaSeconds,
            maneuvers,
            Array.Empty<RouteElevationPoint>());
    }

    private static double ComputeEtaSeconds(double distanceMeters, double speedKmh, double fallbackSeconds)
    {
        if (distanceMeters <= 0 || speedKmh <= 0)
        {
            return fallbackSeconds;
        }

        var speedMetersPerSecond = speedKmh * 1000d / 3600d;
        if (speedMetersPerSecond <= 0)
        {
            return fallbackSeconds;
        }

        return distanceMeters / speedMetersPerSecond;
    }

    private sealed record ValhallaRouteRequest(
        [property: JsonPropertyName("locations")] IReadOnlyList<ValhallaLocation> Locations,
        [property: JsonPropertyName("costing")] string Costing,
        [property: JsonPropertyName("directions_options")] ValhallaDirectionsOptions DirectionsOptions,
        [property: JsonPropertyName("costing_options")] Dictionary<string, object>? CostingOptions);

    private sealed record ValhallaLocation(
        [property: JsonPropertyName("lat")] double Lat,
        [property: JsonPropertyName("lon")] double Lon,
        [property: JsonPropertyName("type")] string? Type = null);

    private sealed record ValhallaDirectionsOptions(
        [property: JsonPropertyName("units")] string Units,
        [property: JsonPropertyName("language")] string Language);

    private sealed record ValhallaBicycleCostingOptions(
        [property: JsonPropertyName("use_roads")] double UseRoads,
        [property: JsonPropertyName("use_hills")] double UseHills);

    private sealed record ValhallaPedestrianCostingOptions(
        [property: JsonPropertyName("use_hills")] double UseHills);

    private sealed record ValhallaRouteResponse(
        [property: JsonPropertyName("trip")] ValhallaTrip? Trip);

    private sealed record ValhallaTrip(
        [property: JsonPropertyName("legs")] List<ValhallaLeg> Legs);

    private sealed record ValhallaLeg(
        [property: JsonPropertyName("shape")] string? Shape,
        [property: JsonPropertyName("summary")] ValhallaSummary? Summary,
        [property: JsonPropertyName("maneuvers")] List<ValhallaManeuver>? Maneuvers);

    private sealed record ValhallaSummary(
        [property: JsonPropertyName("length")] double Length,
        [property: JsonPropertyName("time")] double Time);

    private sealed record ValhallaManeuver(
        [property: JsonPropertyName("instruction")] string? Instruction,
        [property: JsonPropertyName("length")] double Length,
        [property: JsonPropertyName("time")] double Time,
        [property: JsonPropertyName("type")] int Type);

    private static class PolylineDecoder
    {
        public static List<double[]> DecodeToCoordinates(string encoded, int precision = 6)
        {
            var decoded = Decode(encoded, precision);
            var coordinates = new List<double[]>(decoded.Count);
            foreach (var (lat, lon) in decoded)
            {
                coordinates.Add(new[] { lon, lat });
            }

            return coordinates;
        }

        private static List<(double Lat, double Lon)> Decode(string encoded, int precision)
        {
            var coordinates = new List<(double, double)>();
            var factor = Math.Pow(10, precision);
            var index = 0;
            long lat = 0;
            long lon = 0;

            while (index < encoded.Length)
            {
                lat += DecodeNext(encoded, ref index);
                lon += DecodeNext(encoded, ref index);
                coordinates.Add((lat / factor, lon / factor));
            }

            return coordinates;
        }

        private static long DecodeNext(string encoded, ref int index)
        {
            long result = 0;
            var shift = 0;
            int b;

            do
            {
                b = encoded[index++] - 63;
                result |= (long)(b & 0x1F) << shift;
                shift += 5;
            } while (b >= 0x20 && index < encoded.Length);

            return (result & 1) != 0 ? ~(result >> 1) : result >> 1;
        }
    }

    private static List<ValhallaLocation> BuildLocations(RouteRequest request)
    {
        var locations = new List<ValhallaLocation>
        {
            new(request.From.Lat, request.From.Lon),
        };

        var orderedWaypoints = request.OptimizeWaypoints
            ? WaypointOptimizer.OrderForRoute(request.From, request.To, request.Waypoints)
            : WaypointOptimizer.PreserveOrder(request.From, request.Waypoints);
        foreach (var waypoint in orderedWaypoints)
        {
            locations.Add(new ValhallaLocation(waypoint.Lat, waypoint.Lon, "break"));
        }

        locations.Add(new ValhallaLocation(request.To.Lat, request.To.Lon));
        return locations;
    }
}
