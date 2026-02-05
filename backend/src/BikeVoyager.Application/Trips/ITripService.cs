namespace BikeVoyager.Application.Trips;

public interface ITripService
{
    Task<TripDto> CreateAsync(CreateTripRequest request, CancellationToken cancellationToken);
    Task<IReadOnlyList<TripDto>> ListAsync(CancellationToken cancellationToken);
}
