using BikeVoyager.Application.Routing;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using System.Diagnostics;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace BikeVoyager.Infrastructure.Routing;

internal sealed class ValhallaLoopService : ILoopService
{
    private const double EarthRadiusKm = 6371d;
    private const double TolerancePct = 0.15;
    private const int MaxCandidates = 14;
    private static readonly TimeSpan MaxComputeDuration = TimeSpan.FromSeconds(12);

    private static readonly double[] AngleCandidates = { 70d, 90d, 110d, 130d };
    private static readonly double[] RadiusFactors = { 0.85, 1d, 1.15 };

    private static readonly JsonSerializerOptions SerializerOptions = new(JsonSerializerDefaults.Web)
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    private readonly HttpClient _httpClient;
    private readonly ValhallaOptions _options;
    private readonly ILogger<ValhallaLoopService> _logger;

    public ValhallaLoopService(
        HttpClient httpClient,
        IOptions<ValhallaOptions> options,
        ILogger<ValhallaLoopService> logger)
    {
        _httpClient = httpClient;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<LoopResponse> ComputeAsync(LoopRequest request, CancellationToken cancellationToken)
    {
        var targetKm = request.TargetDistanceKm;
        var toleranceKm = targetKm * TolerancePct;
        var minDistanceKm = targetKm - toleranceKm;
        var maxDistanceKm = targetKm + toleranceKm;
        var stopwatch = Stopwatch.StartNew();

        var bestCandidate = (LoopCandidateResult?)null;
        var seed = HashCode.Combine(request.Start.Lat, request.Start.Lon, targetKm, request.Variation);

        foreach (var candidate in BuildCandidates(request.Start, targetKm, seed))
        {
            if (stopwatch.Elapsed >= MaxComputeDuration)
            {
                break;
            }

            var estimateKm = EstimateLoopDistanceKm(
                request.Start,
                request.Waypoints,
                candidate.PointA,
                candidate.PointB);
            if (estimateKm < targetKm * 0.6 || estimateKm > targetKm * 1.4)
            {
                continue;
            }

            var remaining = MaxComputeDuration - stopwatch.Elapsed;
            if (remaining <= TimeSpan.Zero)
            {
                break;
            }

            using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            cts.CancelAfter(remaining);

            LoopRouteSnapshot loopSnapshot;
            try
            {
                loopSnapshot = await ComputeLoopRouteAsync(
                    request,
                    candidate,
                    cts.Token);
            }
            catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
            {
                // Un candidat peut depasser le budget temps restant: on tente le suivant.
                continue;
            }
            catch (HttpRequestException)
            {
                // Certains candidats sont invalides localement (pas de route): on tente le suivant.
                continue;
            }
            catch (InvalidOperationException)
            {
                // Reponse ponctuelle invalide de Valhalla sur un candidat.
                continue;
            }

            var distanceKm = loopSnapshot.DistanceMeters / 1000d;
            if (distanceKm < minDistanceKm || distanceKm > maxDistanceKm)
            {
                continue;
            }

            var overlap = LoopOverlapScorer.Compute(loopSnapshot.Geometry.Coordinates);
            var candidateResult = new LoopCandidateResult(
                loopSnapshot.Geometry,
                loopSnapshot.DistanceMeters,
                loopSnapshot.EtaSeconds,
                overlap.Score,
                overlap.SegmentsCount,
                overlap.Ratio,
                Math.Abs(distanceKm - targetKm));

            if (bestCandidate is null ||
                candidateResult.OverlapRatio < bestCandidate.OverlapRatio - 0.0001 ||
                (Math.Abs(candidateResult.OverlapRatio - bestCandidate.OverlapRatio) < 0.0001 &&
                 candidateResult.DistanceErrorKm < bestCandidate.DistanceErrorKm))
            {
                bestCandidate = candidateResult;
            }
        }

        if (bestCandidate is null)
        {
            throw new LoopNotFoundException("Impossible de générer une boucle satisfaisante.");
        }

        _logger.LogDebug(
            "Boucle retenue {DistanceMeters}m recouvrement={OverlapScore} ratio={OverlapRatio} variation={Variation}",
            bestCandidate.DistanceMeters,
            bestCandidate.OverlapScore,
            bestCandidate.OverlapRatio,
            request.Variation);

        var elevationProfile = await ValhallaElevationProfileService.TryBuildAsync(
            _httpClient,
            SerializerOptions,
            bestCandidate.Geometry.Coordinates,
            _logger,
            cancellationToken);

        return new LoopResponse(
            bestCandidate.Geometry,
            bestCandidate.DistanceMeters,
            bestCandidate.EtaSeconds,
            bestCandidate.OverlapScore,
            bestCandidate.SegmentsCount,
            elevationProfile);
    }

    private async Task<LoopRouteSnapshot> ComputeLoopRouteAsync(
        LoopRequest request,
        LoopCandidate candidate,
        CancellationToken cancellationToken)
    {
        var costing = ResolveCosting(request.Mode);
        var locations = new List<ValhallaLocation>
        {
            new(request.Start.Lat, request.Start.Lon),
        };

        var orderedIntermediates = BuildOrderedLoopIntermediates(
            request.Start,
            request.Waypoints,
            candidate.PointA,
            candidate.PointB);
        foreach (var waypoint in orderedIntermediates)
        {
            var locationType = waypoint.Label.StartsWith("loop-candidate-", StringComparison.Ordinal)
                ? "through"
                : "break";
            locations.Add(new ValhallaLocation(waypoint.Lat, waypoint.Lon, locationType));
        }

        locations.Add(new ValhallaLocation(request.Start.Lat, request.Start.Lon));

        var valhallaRequest = new ValhallaRouteRequest(
            locations,
            costing,
            new ValhallaDirectionsOptions("kilometers", _options.Language),
            BuildCostingOptions(request.Mode, costing, request.EbikeAssist, request.SpeedKmh));

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

        return MapResponse(payloadModel.Trip, request.SpeedKmh);
    }

    private static IEnumerable<LoopCandidate> BuildCandidates(RoutePoint start, double targetKm, int seed)
    {
        var baseRadius = Math.Max(0.8, targetKm / 3.4);
        var random = new Random(seed);
        var bearingStep = 360d / MaxCandidates;

        for (var i = 0; i < MaxCandidates; i++)
        {
            var angle = AngleCandidates[i % AngleCandidates.Length];
            var radiusFactor = RadiusFactors[(i / AngleCandidates.Length) % RadiusFactors.Length];
            var radiusKm = baseRadius * radiusFactor;
            var bearing = (bearingStep * i) + (random.NextDouble() - 0.5) * bearingStep * 0.4;
            var radiusB = radiusKm * (0.9 + random.NextDouble() * 0.2);

            var pointA = Offset(start, radiusKm, bearing);
            var pointB = Offset(start, radiusB, bearing + angle);

            yield return new LoopCandidate(pointA, pointB);
        }
    }

    private static double EstimateLoopDistanceKm(
        RoutePoint start,
        IReadOnlyList<RoutePoint>? waypoints,
        LoopPoint a,
        LoopPoint b)
    {
        var orderedIntermediates = BuildOrderedLoopIntermediates(start, waypoints, a, b);
        if (orderedIntermediates.Count == 0)
        {
            return 0;
        }

        var distanceKm = 0d;
        var previous = start;
        foreach (var point in orderedIntermediates)
        {
            distanceKm += HaversineKm(previous.Lat, previous.Lon, point.Lat, point.Lon);
            previous = point;
        }

        distanceKm += HaversineKm(previous.Lat, previous.Lon, start.Lat, start.Lon);
        return distanceKm;
    }

    private static List<RoutePoint> BuildOrderedLoopIntermediates(
        RoutePoint start,
        IReadOnlyList<RoutePoint>? userWaypoints,
        LoopPoint a,
        LoopPoint b)
    {
        var rawPoints = new List<RoutePoint>();
        if (userWaypoints is { Count: > 0 })
        {
            rawPoints.AddRange(userWaypoints);
        }

        rawPoints.Add(new RoutePoint(a.Lat, a.Lon, "loop-candidate-a"));
        rawPoints.Add(new RoutePoint(b.Lat, b.Lon, "loop-candidate-b"));

        return WaypointOptimizer.OrderForLoop(start, rawPoints).ToList();
    }

    private static LoopPoint Offset(RoutePoint start, double distanceKm, double bearingDegrees)
    {
        var bearing = DegreesToRadians(bearingDegrees);
        var distance = distanceKm / EarthRadiusKm;
        var lat1 = DegreesToRadians(start.Lat);
        var lon1 = DegreesToRadians(start.Lon);

        var lat2 = Math.Asin(
            Math.Sin(lat1) * Math.Cos(distance) +
            Math.Cos(lat1) * Math.Sin(distance) * Math.Cos(bearing));

        var lon2 = lon1 + Math.Atan2(
            Math.Sin(bearing) * Math.Sin(distance) * Math.Cos(lat1),
            Math.Cos(distance) - Math.Sin(lat1) * Math.Sin(lat2));

        return new LoopPoint(RadiansToDegrees(lat2), NormalizeLongitude(RadiansToDegrees(lon2)));
    }

    private static double HaversineKm(double lat1, double lon1, double lat2, double lon2)
    {
        var dLat = DegreesToRadians(lat2 - lat1);
        var dLon = DegreesToRadians(lon2 - lon1);
        var radLat1 = DegreesToRadians(lat1);
        var radLat2 = DegreesToRadians(lat2);

        var a = Math.Pow(Math.Sin(dLat / 2), 2) +
            Math.Cos(radLat1) * Math.Cos(radLat2) *
            Math.Pow(Math.Sin(dLon / 2), 2);
        var c = 2 * Math.Asin(Math.Min(1, Math.Sqrt(a)));
        return EarthRadiusKm * c;
    }

    private static double DegreesToRadians(double degrees) => degrees * Math.PI / 180d;

    private static double RadiansToDegrees(double radians) => radians * 180d / Math.PI;

    private static double NormalizeLongitude(double longitude)
    {
        if (longitude is >= -180 and <= 180)
        {
            return longitude;
        }

        var normalized = longitude % 360;
        if (normalized > 180)
        {
            normalized -= 360;
        }
        else if (normalized < -180)
        {
            normalized += 360;
        }

        return normalized;
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
        string? ebikeAssist,
        double speedKmh)
    {
        if (costing is not ("bicycle" or "pedestrian"))
        {
            return null;
        }

        var normalizedMode = mode.Trim().ToLowerInvariant();
        var useHills = ResolveBaseUseHills(normalizedMode, avoidHills: false);
        useHills += ResolveSpeedHillsBias(normalizedMode, speedKmh);

        if (normalizedMode == "ebike")
        {
            useHills += ResolveEbikeAssistHillsBias(ebikeAssist);
        }

        useHills = Math.Clamp(useHills, 0.05, 0.95);

        if (costing == "bicycle")
        {
            const double useRoads = 0.2;
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

    private static LoopRouteSnapshot MapResponse(ValhallaTrip trip, double speedKmh)
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

        var closedCoordinates = EnsureClosed(coordinates);
        var distanceMeters = trip.Legs.Sum(leg => (leg.Summary?.Length ?? 0) * 1000d);
        var durationSeconds = trip.Legs.Sum(leg => leg.Summary?.Time ?? 0);
        var etaSeconds = ComputeEtaSeconds(distanceMeters, speedKmh, durationSeconds);

        return new LoopRouteSnapshot(
            new GeoJsonLineString("LineString", closedCoordinates),
            distanceMeters,
            etaSeconds);
    }

    private static IReadOnlyList<double[]> EnsureClosed(IReadOnlyList<double[]> coordinates)
    {
        if (coordinates.Count == 0)
        {
            return coordinates;
        }

        var first = coordinates[0];
        var last = coordinates[^1];

        if (CoordinatesMatch(first, last))
        {
            return coordinates;
        }

        var closed = coordinates.ToList();
        closed.Add(new[] { first[0], first[1] });
        return closed;
    }

    private static bool CoordinatesMatch(double[] first, double[] last)
    {
        if (first.Length < 2 || last.Length < 2)
        {
            return false;
        }

        return Math.Abs(first[0] - last[0]) < 0.00001 && Math.Abs(first[1] - last[1]) < 0.00001;
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

    private sealed record LoopCandidate(LoopPoint PointA, LoopPoint PointB);

    private sealed record LoopPoint(double Lat, double Lon);

    private sealed record LoopRouteSnapshot(
        GeoJsonLineString Geometry,
        double DistanceMeters,
        double EtaSeconds);

    private sealed record LoopCandidateResult(
        GeoJsonLineString Geometry,
        double DistanceMeters,
        double EtaSeconds,
        string OverlapScore,
        int SegmentsCount,
        double OverlapRatio,
        double DistanceErrorKm);

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
        [property: JsonPropertyName("summary")] ValhallaSummary? Summary);

    private sealed record ValhallaSummary(
        [property: JsonPropertyName("length")] double Length,
        [property: JsonPropertyName("time")] double Time);

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
}
