using BikeVoyager.Application.Trips;
using BikeVoyager.Domain.Entities;

namespace BikeVoyager.Infrastructure.Services;

public sealed class InMemoryTripService : ITripService
{
    private readonly List<Trip> _trips = new();
    private readonly object _lock = new();

    public Task<TripDto> CreateAsync(CreateTripRequest request, CancellationToken cancellationToken)
    {
        var trip = new Trip(
            Guid.NewGuid(),
            request.Name.Trim(),
            request.DistanceKm,
            request.StartDateUtc);

        lock (_lock)
        {
            _trips.Add(trip);
        }

        return Task.FromResult(ToDto(trip));
    }

    public Task<IReadOnlyList<TripDto>> ListAsync(CancellationToken cancellationToken)
    {
        List<TripDto> snapshot;

        lock (_lock)
        {
            snapshot = _trips.Select(ToDto).ToList();
        }

        return Task.FromResult<IReadOnlyList<TripDto>>(snapshot);
    }

    private static TripDto ToDto(Trip trip) =>
        new(trip.Id, trip.Name, trip.DistanceKm, trip.StartDateUtc);
}
