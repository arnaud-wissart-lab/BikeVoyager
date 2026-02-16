using System.Net;
using System.Text.Json;
using BikeVoyager.Application.Geocoding;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace BikeVoyager.ApiTests;

public class PlacesEndpointsTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public PlacesEndpointsTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                services.RemoveAll<IGeocodingService>();
                services.AddSingleton<IGeocodingService>(new StubGeocodingService());
            });
        });
    }

    [Fact]
    public async Task Search_RetourneDesCandidats()
    {
        using var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/places/search?q=paris&limit=2");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var json = await response.Content.ReadAsStringAsync();
        using var document = JsonDocument.Parse(json);
        Assert.Equal(JsonValueKind.Array, document.RootElement.ValueKind);
        Assert.Equal("Paris", document.RootElement[0].GetProperty("label").GetString());
    }

    [Fact]
    public async Task Search_RefuseUneRequeteTropCourte()
    {
        using var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/places/search?q=a");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Reverse_RetourneUnCandidat()
    {
        using var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/places/reverse?lat=48.8566&lon=2.3522");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var json = await response.Content.ReadAsStringAsync();
        using var document = JsonDocument.Parse(json);
        Assert.Equal("Paris", document.RootElement.GetProperty("label").GetString());
    }

    private sealed class StubGeocodingService : IGeocodingService
    {
        public Task<IReadOnlyList<PlaceCandidate>> SearchAsync(
            string query,
            int limit,
            GeocodingSearchMode mode,
            CancellationToken cancellationToken)
        {
            IReadOnlyList<PlaceCandidate> result = new[]
            {
                new PlaceCandidate(
                    "Paris",
                    48.8566,
                    2.3522,
                    0.9,
                    "stub",
                    "75000",
                    "Paris",
                    "75",
                    "75056"),
            };

            return Task.FromResult(result);
        }

        public Task<PlaceCandidate?> ReverseAsync(
            double lat,
            double lon,
            CancellationToken cancellationToken)
        {
            var result = new PlaceCandidate(
                "Paris",
                48.8566,
                2.3522,
                0.9,
                "stub",
                "75000",
                "Paris",
                "75",
                "75056");

            return Task.FromResult<PlaceCandidate?>(result);
        }
    }
}
