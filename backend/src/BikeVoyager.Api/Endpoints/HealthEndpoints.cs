using BikeVoyager.Api.Filters;
using BikeVoyager.Application.Integrations;
using BikeVoyager.Application.Trips;

namespace BikeVoyager.Api.Endpoints;

public static class HealthEndpoints
{
    public static IEndpointRouteBuilder MapHealthEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var api = endpoints.MapGroup("/api/v1");

        api.MapGet("/health", () => Results.Ok(new { status = "ok" }))
            .WithName("Health");

        api.MapGet("/trips", async (ITripService trips, CancellationToken cancellationToken) =>
                Results.Ok(await trips.ListAsync(cancellationToken)))
            .WithName("ListTrips");

        api.MapPost("/trips", async (CreateTripRequest request, ITripService trips, CancellationToken cancellationToken) =>
            {
                var created = await trips.CreateAsync(request, cancellationToken);
                return Results.Created($"/api/v1/trips/{created.Id}", created);
            })
            .AddEndpointFilter<ValidationFilter<CreateTripRequest>>()
            .WithName("CreateTrip");

        api.MapGet("/external/ping", async (IExternalPingService ping, CancellationToken cancellationToken) =>
            {
                var ok = await ping.PingAsync(cancellationToken);
                return ok ? Results.Ok(new { status = "ok" }) : Results.StatusCode(StatusCodes.Status502BadGateway);
            })
            .WithName("ExternalPing");

        return endpoints;
    }
}
