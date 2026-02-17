using System.Net;
using System.Text;
using System.Text.Json;
using BikeVoyager.Application.Pois;
using BikeVoyager.Application.Routing;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace BikeVoyager.ApiTests;

public class PoiEndpointsTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public PoiEndpointsTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                services.RemoveAll<IPoiService>();
                services.AddSingleton<IPoiService>(new StubPoiService());
            });
        });
    }

    [Fact]
    public async Task AroundRoute_RetourneDesPois()
    {
        using var client = _factory.CreateClient();
        var geometry = Uri.EscapeDataString("{\"type\":\"LineString\",\"coordinates\":[[2.35,48.85],[2.36,48.86]]}");
        var response = await client.GetAsync($"/api/v1/poi/around-route?geometry={geometry}&categories=monuments&distance=500");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var json = await response.Content.ReadAsStringAsync();
        using var document = JsonDocument.Parse(json);
        Assert.Equal(JsonValueKind.Array, document.RootElement.ValueKind);
        Assert.Equal("poi-1", document.RootElement[0].GetProperty("id").GetString());
    }

    [Fact]
    public async Task AroundRoute_RefuseSiGeometryAbsente()
    {
        using var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/v1/poi/around-route");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task AroundRoutePost_RetourneDesPois()
    {
        using var client = _factory.CreateClient();
        var payload = """
            {
              "geometry": {
                "type": "LineString",
                "coordinates": [[2.35, 48.85], [2.36, 48.86]]
              },
              "categories": ["monuments"],
              "distance": 500,
              "limit": 20
            }
            """;

        using var content = new StringContent(payload, Encoding.UTF8, "application/json");
        var response = await client.PostAsync("/api/v1/poi/around-route", content);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var json = await response.Content.ReadAsStringAsync();
        using var document = JsonDocument.Parse(json);
        Assert.Equal(JsonValueKind.Array, document.RootElement.ValueKind);
        Assert.Equal("poi-1", document.RootElement[0].GetProperty("id").GetString());
    }

    private sealed class StubPoiService : IPoiService
    {
        public Task<IReadOnlyList<PoiItem>> AroundRouteAsync(
            PoiAroundRouteRequest request,
            CancellationToken cancellationToken)
        {
            IReadOnlyList<PoiItem> result = new[]
            {
                new PoiItem("poi-1", "Chateau", 48.85, 2.35, "monuments", "historic:castle", 120),
            };

            return Task.FromResult(result);
        }
    }
}
