using BikeVoyager.Api.Extensions;
using BikeVoyager.Api.Filters;
using BikeVoyager.Api.Valhalla;
using BikeVoyager.Application.Routing;
using Polly.CircuitBreaker;
using System.Diagnostics;

namespace BikeVoyager.Api.Endpoints;

public static class LoopEndpoints
{
    public static IEndpointRouteBuilder MapLoopEndpoints(this IEndpointRouteBuilder endpoints, string? valhallaDataPath)
    {
        var loop = endpoints.MapGroup("/api/v1");

        loop.MapPost("/loop",
                async (LoopRequest request,
                    ILoopService loops,
                    HttpContext httpContext,
                    ILogger<global::Program> logger,
                    CancellationToken cancellationToken) =>
                {
                    var stopwatch = Stopwatch.StartNew();

                    try
                    {
                        if (!ValhallaRuntime.IsReady(valhallaDataPath, out var notReadyReason))
                        {
                            var buildProgress = ValhallaRuntime.ReadBuildProgress(valhallaDataPath, ready: false);
                            logger.LogWarning("Valhalla non prêt: {Reason}", notReadyReason);
                            return Results.Json(
                                new
                                {
                                    message = ValhallaRuntime.BuildNotReadyMessage(buildProgress, notReadyReason),
                                    build = new
                                    {
                                        state = buildProgress.State,
                                        phase = buildProgress.Phase,
                                        progress_pct = buildProgress.ProgressPct,
                                        message = buildProgress.Message,
                                        updated_at = buildProgress.UpdatedAt,
                                    },
                                },
                                statusCode: StatusCodes.Status503ServiceUnavailable);
                        }

                        var response = await loops.ComputeAsync(request, cancellationToken);
                        var sessionId = ApiRequestIdentity.ResolveRequestSessionId(httpContext);

                        logger.LogInformation(
                            "LoopComputed {DistanceMeters} {OverlapScore} {DurationMs} {Mode} {Variation} {SessionId}",
                            response.DistanceMeters,
                            response.OverlapScore,
                            stopwatch.ElapsedMilliseconds,
                            request.Mode,
                            request.Variation,
                            sessionId);

                        if (request.Waypoints is { Count: > 0 })
                        {
                            logger.LogInformation(
                                "WaypointsApplied {WaypointsCount} {SessionId}",
                                request.Waypoints.Count,
                                sessionId);
                            logger.LogInformation(
                                "RouteRecomputed {WaypointsCount} {SessionId}",
                                request.Waypoints.Count,
                                sessionId);
                        }

                        return Results.Ok(response);
                    }
                    catch (LoopNotFoundException ex)
                    {
                        logger.LogWarning(ex, "Impossible de générer une boucle satisfaisante.");
                        return ApiProblemResults.Message(
                            StatusCodes.Status422UnprocessableEntity,
                            ex.Message);
                    }
                    catch (TaskCanceledException ex)
                    {
                        logger.LogWarning(ex, "Timeout Valhalla.");
                        return ApiProblemResults.Status(
                            StatusCodes.Status504GatewayTimeout,
                            "Timeout Valhalla.");
                    }
                    catch (BrokenCircuitException ex)
                    {
                        logger.LogWarning(ex, "Valhalla temporairement indisponible.");
                        return ApiProblemResults.Status(
                            StatusCodes.Status503ServiceUnavailable,
                            "Valhalla temporairement indisponible.");
                    }
                    catch (HttpRequestException ex)
                    {
                        logger.LogWarning(ex, "Échec de l'appel Valhalla.");
                        return ApiProblemResults.Status(
                            StatusCodes.Status502BadGateway,
                            "Échec de l'appel Valhalla.");
                    }
                    catch (InvalidOperationException ex)
                    {
                        logger.LogWarning(ex, "Réponse Valhalla invalide.");
                        return ApiProblemResults.Status(
                            StatusCodes.Status502BadGateway,
                            "Réponse Valhalla invalide.");
                    }
                })
            .AddEndpointFilter<ValidationFilter<LoopRequest>>()
            .RequireRateLimiting("compute-heavy")
            .WithName("ComputeLoop");

        return endpoints;
    }
}
