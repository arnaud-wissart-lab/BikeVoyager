using System.Net.Http.Json;
using System.Text.Json.Serialization;
using BikeVoyager.Application.Geocoding;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace BikeVoyager.Infrastructure.Geocoding;

internal sealed class AddressApiGeocodingProvider : IGeocodingProvider
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<AddressApiGeocodingProvider> _logger;
    private readonly GeocodingOptions _options;

    public AddressApiGeocodingProvider(
        HttpClient httpClient,
        IOptions<GeocodingOptions> options,
        ILogger<AddressApiGeocodingProvider> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
        _options = options.Value;

        if (!string.IsNullOrWhiteSpace(_options.AddressProvider.ApiKey))
        {
            _httpClient.DefaultRequestHeaders.Remove("X-Api-Key");
            _httpClient.DefaultRequestHeaders.Add("X-Api-Key", _options.AddressProvider.ApiKey);
        }
    }

    public string Source => "adresse.data.gouv.fr";

    public async Task<IReadOnlyList<PlaceCandidate>> SearchAsync(
        string query,
        int limit,
        CancellationToken cancellationToken)
    {
        if (!_options.AddressProvider.Enabled)
        {
            return Array.Empty<PlaceCandidate>();
        }

        var url = $"search/?q={Uri.EscapeDataString(query)}&limit={limit}";

        try
        {
            var response = await _httpClient.GetFromJsonAsync<AddressFeatureCollection>(url, cancellationToken);
            if (response?.Features is null)
            {
                return Array.Empty<PlaceCandidate>();
            }

            return MapFeatures(response.Features, Source);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogWarning(ex, "Erreur lors de la recherche d'adresses via l'API Adresse.");
            return Array.Empty<PlaceCandidate>();
        }
    }

    public async Task<PlaceCandidate?> ReverseAsync(
        double lat,
        double lon,
        CancellationToken cancellationToken)
    {
        if (!_options.AddressProvider.Enabled)
        {
            return null;
        }

        var url = $"reverse/?lat={lat.ToString(System.Globalization.CultureInfo.InvariantCulture)}&lon={lon.ToString(System.Globalization.CultureInfo.InvariantCulture)}";

        try
        {
            var response = await _httpClient.GetFromJsonAsync<AddressFeatureCollection>(url, cancellationToken);
            if (response?.Features is null)
            {
                return null;
            }

            return MapFeatures(response.Features, Source).FirstOrDefault();
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogWarning(ex, "Erreur lors du reverse géocodage via l'API Adresse.");
            return null;
        }
    }

    internal static IReadOnlyList<PlaceCandidate> MapFeatures(
        IEnumerable<AddressFeature> features,
        string source)
    {
        var results = new List<PlaceCandidate>();

        foreach (var feature in features)
        {
            if (feature.Geometry?.Coordinates is null || feature.Geometry.Coordinates.Length < 2)
            {
                continue;
            }

            var lon = feature.Geometry.Coordinates[0];
            var lat = feature.Geometry.Coordinates[1];
            var label = feature.Properties?.Label;
            if (string.IsNullOrWhiteSpace(label))
            {
                continue;
            }

            results.Add(new PlaceCandidate(
                label,
                lat,
                lon,
                feature.Properties?.Score ?? 0,
                source,
                feature.Properties?.Postcode,
                feature.Properties?.City,
                ExtractDepartment(feature.Properties?.Context),
                feature.Properties?.CityCode));
        }

        return results;
    }

    private static string? ExtractDepartment(string? context)
    {
        if (string.IsNullOrWhiteSpace(context))
        {
            return null;
        }

        var parts = context.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
        return parts.Length > 0 ? parts[0] : null;
    }

    internal sealed class AddressFeatureCollection
    {
        [JsonPropertyName("features")]
        public List<AddressFeature>? Features { get; set; }
    }

    internal sealed class AddressFeature
    {
        [JsonPropertyName("properties")]
        public AddressProperties? Properties { get; set; }

        [JsonPropertyName("geometry")]
        public AddressGeometry? Geometry { get; set; }
    }

    internal sealed class AddressGeometry
    {
        [JsonPropertyName("coordinates")]
        public double[]? Coordinates { get; set; }
    }

    internal sealed class AddressProperties
    {
        [JsonPropertyName("label")]
        public string? Label { get; set; }

        [JsonPropertyName("score")]
        public double? Score { get; set; }

        [JsonPropertyName("postcode")]
        public string? Postcode { get; set; }

        [JsonPropertyName("city")]
        public string? City { get; set; }

        [JsonPropertyName("citycode")]
        public string? CityCode { get; set; }

        [JsonPropertyName("context")]
        public string? Context { get; set; }
    }
}
