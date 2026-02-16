using BikeVoyager.Api.Extensions;
using BikeVoyager.Api.Filters;
using BikeVoyager.Api.Valhalla;
using BikeVoyager.Application.Routing;
using Polly.CircuitBreaker;

namespace BikeVoyager.Api.Endpoints;

public static class RouteEndpoints
{
    public static IEndpointRouteBuilder MapRouteEndpoints(this IEndpointRouteBuilder endpoints, string? valhallaDataPath)
    {
        var route = endpoints.MapGroup("/api/v1");

        route.MapPost("/route",
                async (RouteRequest request,
                    IRouteService routing,
                    HttpContext httpContext,
                    ILogger<global::Program> logger,
                    CancellationToken cancellationToken) =>
                {
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

                        var response = await routing.ComputeAsync(request, cancellationToken);
                        var sessionId = ApiRequestIdentity.ResolveRequestSessionId(httpContext);

                        logger.LogInformation(
                            "RouteComputed {DurationSeconds} {DistanceMeters} {Mode} {SessionId}",
                            response.DurationSecondsEngine,
                            response.DistanceMeters,
                            request.Mode,
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
            .AddEndpointFilter<ValidationFilter<RouteRequest>>()
            .RequireRateLimiting("compute-heavy")
            .WithName("ComputeRoute");

        return endpoints;
    }
}
