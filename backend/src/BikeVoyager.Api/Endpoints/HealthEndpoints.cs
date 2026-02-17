namespace BikeVoyager.Api.Endpoints;

public static class HealthEndpoints
{
    public static IEndpointRouteBuilder MapHealthEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var api = endpoints.MapGroup("/api/v1");

        api.MapGet("/health", () => Results.Ok(new { status = "ok" }))
            .WithName("Health");

        return endpoints;
    }
}
