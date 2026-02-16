using System.Net.Http.Json;
using System.Text.Json.Serialization;
using BikeVoyager.Application.Geocoding;
using Microsoft.Extensions.Logging;

namespace BikeVoyager.Infrastructure.Geocoding;

internal sealed class GeoApiGouvGeocodingProvider : IGeocodingProvider
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<GeoApiGouvGeocodingProvider> _logger;

    public GeoApiGouvGeocodingProvider(
        HttpClient httpClient,
        ILogger<GeoApiGouvGeocodingProvider> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
    }

    public string Source => "geo.api.gouv.fr";

    public async Task<IReadOnlyList<PlaceCandidate>> SearchAsync(
        string query,
        int limit,
        CancellationToken cancellationToken)
    {
        var url = $"communes?nom={Uri.EscapeDataString(query)}&limit={limit}&fields=nom,centre,code,codesPostaux,departement";

        try
        {
            var communes = await _httpClient.GetFromJsonAsync<List<CommuneDto>>(url, cancellationToken);
            if (communes is null)
            {
                return Array.Empty<PlaceCandidate>();
            }

            return MapCommunes(communes, Source);
        }
        catch (OperationCanceledException)
        {
            return Array.Empty<PlaceCandidate>();
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogWarning(ex, "Erreur lors de la recherche de communes via Geo API Gouv.");
            return Array.Empty<PlaceCandidate>();
        }
    }

    public async Task<PlaceCandidate?> ReverseAsync(
        double lat,
        double lon,
        CancellationToken cancellationToken)
    {
        var url = $"communes?lat={lat.ToString(System.Globalization.CultureInfo.InvariantCulture)}&lon={lon.ToString(System.Globalization.CultureInfo.InvariantCulture)}&fields=nom,centre,code,codesPostaux,departement";

        try
        {
            var communes = await _httpClient.GetFromJsonAsync<List<CommuneDto>>(url, cancellationToken);
            if (communes is null)
            {
                return null;
            }

            return MapCommunes(communes, Source).FirstOrDefault();
        }
        catch (OperationCanceledException)
        {
            return null;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogWarning(ex, "Erreur lors du reverse géocodage via Geo API Gouv.");
            return null;
        }
    }

    internal static IReadOnlyList<PlaceCandidate> MapCommunes(
        IEnumerable<CommuneDto> communes,
        string source)
    {
        var results = new List<PlaceCandidate>();

        foreach (var commune in communes)
        {
            if (commune.Centre?.Coordinates is null || commune.Centre.Coordinates.Length < 2)
            {
                continue;
            }

            var lon = commune.Centre.Coordinates[0];
            var lat = commune.Centre.Coordinates[1];
            var postcode = commune.CodesPostaux?.FirstOrDefault();
            var label = !string.IsNullOrWhiteSpace(postcode)
                ? $"{commune.Nom} ({postcode})"
                : commune.Nom;

            if (string.IsNullOrWhiteSpace(label))
            {
                continue;
            }

            results.Add(new PlaceCandidate(
                label,
                lat,
                lon,
                1,
                source,
                postcode,
                commune.Nom,
                commune.Departement?.Nom ?? commune.Departement?.Code,
                commune.Code));
        }

        return results;
    }

    internal sealed class CommuneDto
    {
        [JsonPropertyName("nom")]
        public string? Nom { get; set; }

        [JsonPropertyName("code")]
        public string? Code { get; set; }

        [JsonPropertyName("codesPostaux")]
        public string[]? CodesPostaux { get; set; }

        [JsonPropertyName("centre")]
        public CentreDto? Centre { get; set; }

        [JsonPropertyName("departement")]
        public DepartementDto? Departement { get; set; }
    }

    internal sealed class CentreDto
    {
        [JsonPropertyName("coordinates")]
        public double[]? Coordinates { get; set; }
    }

    internal sealed class DepartementDto
    {
        [JsonPropertyName("code")]
        public string? Code { get; set; }

        [JsonPropertyName("nom")]
        public string? Nom { get; set; }
    }
}
