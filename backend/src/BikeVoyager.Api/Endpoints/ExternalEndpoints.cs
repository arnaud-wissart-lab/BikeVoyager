using BikeVoyager.Application.Integrations;

namespace BikeVoyager.Api.Endpoints;

public static class ExternalEndpoints
{
    public static IEndpointRouteBuilder MapExternalEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var api = endpoints.MapGroup("/api/v1");

        api.MapGet("/external/ping", async (IExternalPingService ping, CancellationToken cancellationToken) =>
            {
                var ok = await ping.PingAsync(cancellationToken);
                return ok ? Results.Ok(new { status = "ok" }) : Results.StatusCode(StatusCodes.Status502BadGateway);
            })
            .WithName("ExternalPing");

        return endpoints;
    }
}
