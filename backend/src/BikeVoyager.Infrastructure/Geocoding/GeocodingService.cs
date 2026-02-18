using BikeVoyager.Application.Geocoding;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using System.Text.Json;

namespace BikeVoyager.Infrastructure.Geocoding;

internal sealed class GeocodingService : IGeocodingService
{
    private readonly GeoApiGouvGeocodingProvider _communeProvider;
    private readonly AddressApiGeocodingProvider _addressProvider;
    private readonly IMemoryCache _cache;
    private readonly IDistributedCache? _distributedCache;
    private readonly GeocodingOptions _options;
    private readonly ILogger<GeocodingService> _logger;
    private static readonly JsonSerializerOptions CacheSerializerOptions = new(JsonSerializerDefaults.Web);

    public GeocodingService(
        GeoApiGouvGeocodingProvider communeProvider,
        AddressApiGeocodingProvider addressProvider,
        IMemoryCache cache,
        IDistributedCache? distributedCache,
        IOptions<GeocodingOptions> options,
        ILogger<GeocodingService> logger)
    {
        _communeProvider = communeProvider;
        _addressProvider = addressProvider;
        _cache = cache;
        _distributedCache = distributedCache;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<IReadOnlyList<PlaceCandidate>> SearchAsync(
        string query,
        int limit,
        GeocodingSearchMode mode,
        CancellationToken cancellationToken)
    {
        var normalized = query.Trim();
        if (string.IsNullOrWhiteSpace(normalized))
        {
            return Array.Empty<PlaceCandidate>();
        }

        var safeLimit = Math.Clamp(limit, 1, 20);
        var resolvedMode = ResolveMode(mode);
        var cacheKey = $"geocoding:search:{resolvedMode.ToString().ToLowerInvariant()}:{normalized.ToLowerInvariant()}:{safeLimit}";
        var distributed = await TryGetDistributedAsync<List<PlaceCandidate>>(cacheKey, cancellationToken);
        if (distributed is not null)
        {
            _cache.Set(cacheKey, distributed, TimeSpan.FromSeconds(_options.Cache.SearchTtlSeconds));
            return distributed;
        }

        if (_cache.TryGetValue(cacheKey, out IReadOnlyList<PlaceCandidate>? cached) && cached is not null)
        {
            return cached;
        }

        IReadOnlyList<PlaceCandidate> results;

        if (resolvedMode == GeocodingSearchMode.City)
        {
            results = await _communeProvider.SearchAsync(normalized, safeLimit, cancellationToken);
        }
        else if (_options.AddressProvider.Enabled)
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
        await TrySetDistributedAsync(cacheKey, results, _options.Cache.SearchTtlSeconds, cancellationToken);
        return results;
    }

    private GeocodingSearchMode ResolveMode(GeocodingSearchMode mode)
    {
        if (mode != GeocodingSearchMode.Auto)
        {
            return mode;
        }

        return _options.AddressProvider.Enabled
            ? GeocodingSearchMode.Address
            : GeocodingSearchMode.City;
    }

    public async Task<PlaceCandidate?> ReverseAsync(
        double lat,
        double lon,
        CancellationToken cancellationToken)
    {
        var cacheKey = $"geocoding:reverse:{lat:F5}:{lon:F5}";
        var distributed = await TryGetDistributedAsync<PlaceCandidate>(cacheKey, cancellationToken);
        if (distributed is not null)
        {
            _cache.Set(cacheKey, distributed, TimeSpan.FromSeconds(_options.Cache.ReverseTtlSeconds));
            return distributed;
        }

        if (_cache.TryGetValue(cacheKey, out PlaceCandidate? cached))
        {
            return cached;
        }

        PlaceCandidate? result;

        if (_options.AddressProvider.Enabled)
        {
            result = await _addressProvider.ReverseAsync(lat, lon, cancellationToken);
            result ??= await _communeProvider.ReverseAsync(lat, lon, cancellationToken);
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
        await TrySetDistributedAsync(cacheKey, result, _options.Cache.ReverseTtlSeconds, cancellationToken);
        return result;
    }

    private async Task<T?> TryGetDistributedAsync<T>(string cacheKey, CancellationToken cancellationToken)
    {
        if (_distributedCache is null)
        {
            return default;
        }

        byte[]? payload;
        try
        {
            payload = await _distributedCache.GetAsync(cacheKey, cancellationToken);
            if (payload is null || payload.Length == 0)
            {
                return default;
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Cache distribué geocoding indisponible (lecture).");
            return default;
        }

        try
        {
            return JsonSerializer.Deserialize<T>(payload, CacheSerializerOptions);
        }
        catch (JsonException)
        {
            return default;
        }
    }

    private async Task TrySetDistributedAsync<T>(
        string cacheKey,
        T value,
        int ttlSeconds,
        CancellationToken cancellationToken)
    {
        if (_distributedCache is null)
        {
            return;
        }

        try
        {
            var payload = JsonSerializer.SerializeToUtf8Bytes(value, CacheSerializerOptions);
            await _distributedCache.SetAsync(
                cacheKey,
                payload,
                new DistributedCacheEntryOptions
                {
                    AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(ttlSeconds),
                },
                cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Cache distribué geocoding indisponible (écriture).");
        }
    }
}
