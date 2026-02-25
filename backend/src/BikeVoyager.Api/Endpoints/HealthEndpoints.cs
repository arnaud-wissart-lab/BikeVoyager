using BikeVoyager.Api.Health;
using BikeVoyager.Api.Valhalla;

namespace BikeVoyager.Api.Endpoints;

public static class HealthEndpoints
{
    public static IEndpointRouteBuilder MapHealthEndpoints(
        this IEndpointRouteBuilder endpoints,
        string? valhallaDataPath,
        string? valhallaBaseUrl)
    {
        var api = endpoints.MapGroup("/api/v1");

        api.MapGet("/health",
                async (
                    ApiHealthStatusService healthStatusService,
                    IValhallaProbeClient probeClient,
                    CancellationToken cancellationToken) =>
                {
                    var payload = await healthStatusService.BuildAsync(
                        valhallaDataPath,
                        valhallaBaseUrl,
                        probeClient,
                        cancellationToken);

                    return Results.Ok(payload);
                })
            .WithName("Health");

        return endpoints;
    }
}
