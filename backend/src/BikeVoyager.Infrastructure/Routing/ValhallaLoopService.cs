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
    private const double TolerancePct = 0.15;
    private static readonly TimeSpan MaxComputeDuration = TimeSpan.FromSeconds(12);

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

        foreach (var candidate in LoopCandidateSelector.BuildCandidates(request.Start, targetKm, seed))
        {
            if (stopwatch.Elapsed >= MaxComputeDuration)
            {
                break;
            }

            var estimateKm = LoopCandidateSelector.EstimateLoopDistanceKm(
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

            var candidateResult = LoopScorer.CreateResult(loopSnapshot, targetKm);
            if (LoopScorer.IsBetter(candidateResult, bestCandidate))
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

        var orderedIntermediates = LoopCandidateSelector.BuildOrderedLoopIntermediates(
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

        return ValhallaLoopResponseMapper.Map(payloadModel.Trip, request.SpeedKmh);
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
}
