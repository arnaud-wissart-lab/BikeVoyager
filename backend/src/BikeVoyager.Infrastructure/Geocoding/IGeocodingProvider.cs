using BikeVoyager.Application.Geocoding;

namespace BikeVoyager.Infrastructure.Geocoding;

internal interface IGeocodingProvider
{
    string Source { get; }

    Task<IReadOnlyList<PlaceCandidate>> SearchAsync(string query, int limit, CancellationToken cancellationToken);

    Task<PlaceCandidate?> ReverseAsync(double lat, double lon, CancellationToken cancellationToken);
}
