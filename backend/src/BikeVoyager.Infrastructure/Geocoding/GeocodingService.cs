using BikeVoyager.Application.Geocoding;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace BikeVoyager.Infrastructure.Geocoding;

internal sealed class GeocodingService : IGeocodingService
{
    private readonly GeoApiGouvGeocodingProvider _communeProvider;
    private readonly AddressApiGeocodingProvider _addressProvider;
    private readonly IMemoryCache _cache;
    private readonly GeocodingOptions _options;
    private readonly ILogger<GeocodingService> _logger;

    public GeocodingService(
        GeoApiGouvGeocodingProvider communeProvider,
        AddressApiGeocodingProvider addressProvider,
        IMemoryCache cache,
        IOptions<GeocodingOptions> options,
        ILogger<GeocodingService> logger)
    {
        _communeProvider = communeProvider;
        _addressProvider = addressProvider;
        _cache = cache;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<IReadOnlyList<PlaceCandidate>> SearchAsync(
        string query,
        int limit,
        CancellationToken cancellationToken)
    {
        var normalized = query.Trim();
        if (string.IsNullOrWhiteSpace(normalized))
        {
            return Array.Empty<PlaceCandidate>();
        }

        var safeLimit = Math.Clamp(limit, 1, 20);
        var cacheKey = $"geocoding:search:{normalized.ToLowerInvariant()}:{safeLimit}";
        if (_cache.TryGetValue(cacheKey, out IReadOnlyList<PlaceCandidate>? cached))
        {
            return cached;
        }

        IReadOnlyList<PlaceCandidate> results;

        if (_options.AddressProvider.Enabled)
        {
            results = await _addressProvider.SearchAsync(normalized, safeLimit, cancellationToken);
            if (results.Count == 0)
            {
                results = await _communeProvider.SearchAsync(normalized, safeLimit, cancellationToken);
            }
        }
        else
        {
            results = await _communeProvider.SearchAsync(normalized, safeLimit, cancellationToken);
        }

        _cache.Set(cacheKey, results, TimeSpan.FromSeconds(_options.Cache.SearchTtlSeconds));
        return results;
    }

    public async Task<PlaceCandidate?> ReverseAsync(
        double lat,
        double lon,
        CancellationToken cancellationToken)
    {
        var cacheKey = $"geocoding:reverse:{lat:F5}:{lon:F5}";
        if (_cache.TryGetValue(cacheKey, out PlaceCandidate? cached))
        {
            return cached;
        }

        PlaceCandidate? result;

        if (_options.AddressProvider.Enabled)
        {
            result = await _addressProvider.ReverseAsync(lat, lon, cancellationToken);
            if (result is null)
            {
                result = await _communeProvider.ReverseAsync(lat, lon, cancellationToken);
            }
        }
        else
        {
            result = await _communeProvider.ReverseAsync(lat, lon, cancellationToken);
        }

        if (result is null)
        {
            _logger.LogInformation("Aucun lieu trouvé pour {Lat} {Lon}.", lat, lon);
            return null;
        }

        _cache.Set(cacheKey, result, TimeSpan.FromSeconds(_options.Cache.ReverseTtlSeconds));
        return result;
    }
}
