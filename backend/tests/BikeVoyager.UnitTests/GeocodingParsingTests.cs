using System.Text.Json;
using BikeVoyager.Infrastructure.Geocoding;

namespace BikeVoyager.UnitTests;

public class GeocodingParsingTests
{
    [Fact]
    public void MapCommunes_GenereUnCandidat()
    {
        var json = ReadFixture("geoapi-communes.json");
        var communes = JsonSerializer.Deserialize<List<GeoApiGouvGeocodingProvider.CommuneDto>>(json);

        Assert.NotNull(communes);
        var results = GeoApiGouvGeocodingProvider.MapCommunes(communes!, "geo.api.gouv.fr");

        var candidat = Assert.Single(results);
        Assert.Equal("Lyon (69001)", candidat.Label);
        Assert.Equal(45.764, candidat.Lat, 3);
        Assert.Equal(4.8357, candidat.Lon, 3);
        Assert.Equal("69123", candidat.InseeCode);
        Assert.Equal("Rhone", candidat.Department);
    }

    [Fact]
    public void MapAdresses_GenereUnCandidat()
    {
        var json = ReadFixture("adresse-search.json");
        var result = JsonSerializer.Deserialize<AddressApiGeocodingProvider.AddressFeatureCollection>(json);

        Assert.NotNull(result?.Features);
        var results = AddressApiGeocodingProvider.MapFeatures(result!.Features!, "adresse.data.gouv.fr");

        var candidat = Assert.Single(results);
        Assert.Equal("10 Rue de Rivoli 75004 Paris", candidat.Label);
        Assert.Equal("75004", candidat.Postcode);
        Assert.Equal("Paris", candidat.City);
        Assert.Equal("75", candidat.Department);
    }

    [Fact]
    public void BuildSearchUrls_AvecNumero_CommenceParUneRechercheHousenumber()
    {
        var urls = AddressApiGeocodingProvider.BuildSearchUrls("31 rue de la place", 8);

        Assert.Equal(2, urls.Count);
        Assert.Equal("search/?q=31%20rue%20de%20la%20place&limit=8&type=housenumber&autocomplete=0", urls[0]);
        Assert.Equal("search/?q=31%20rue%20de%20la%20place&limit=8", urls[1]);
    }

    [Fact]
    public void BuildSearchUrls_SansNumero_GardeLaRechercheStandard()
    {
        var urls = AddressApiGeocodingProvider.BuildSearchUrls("rue de la place", 8);

        var uniqueUrl = Assert.Single(urls);
        Assert.Equal("search/?q=rue%20de%20la%20place&limit=8", uniqueUrl);
    }

    private static string ReadFixture(string fileName)
    {
        var path = Path.Combine(AppContext.BaseDirectory, "Fixtures", fileName);
        return File.ReadAllText(path);
    }
}
