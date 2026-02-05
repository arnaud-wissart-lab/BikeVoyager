namespace BikeVoyager.Application.Geocoding;

public interface IGeocodingService
{
    Task<IReadOnlyList<PlaceCandidate>> SearchAsync(string query, int limit, CancellationToken cancellationToken);

    Task<PlaceCandidate?> ReverseAsync(double lat, double lon, CancellationToken cancellationToken);
}
