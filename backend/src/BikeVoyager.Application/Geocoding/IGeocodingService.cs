namespace BikeVoyager.Application.Geocoding;

public interface IGeocodingService
{
    Task<IReadOnlyList<PlaceCandidate>> SearchAsync(
        string query,
        int limit,
        GeocodingSearchMode mode,
        CancellationToken cancellationToken);

    Task<PlaceCandidate?> ReverseAsync(double lat, double lon, CancellationToken cancellationToken);
}
