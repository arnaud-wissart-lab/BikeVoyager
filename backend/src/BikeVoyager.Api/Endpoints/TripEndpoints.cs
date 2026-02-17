using BikeVoyager.Api.Filters;
using BikeVoyager.Application.Trips;

namespace BikeVoyager.Api.Endpoints;

public static class TripEndpoints
{
    public static IEndpointRouteBuilder MapTripEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var api = endpoints.MapGroup("/api/v1");

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

        return endpoints;
    }
}
