using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;

namespace BikeVoyager.ApiTests;

public class ErrorContractEndpointsTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public ErrorContractEndpointsTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Places_search_trop_court_expose_un_message_coherent()
    {
        using var client = _factory.CreateClient();
        using var response = await client.GetAsync("/api/v1/places/search?q=a");
        var payload = await response.Content.ReadAsStringAsync();
        using var document = JsonDocument.Parse(payload);
        var root = document.RootElement;

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(400, root.GetProperty("status").GetInt32());
        Assert.Contains("q", root.GetProperty("message").GetString(), StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Poi_around_route_sans_geometry_expose_un_message_coherent()
    {
        using var client = _factory.CreateClient();
        using var response = await client.GetAsync("/api/v1/poi/around-route");
        var payload = await response.Content.ReadAsStringAsync();
        using var document = JsonDocument.Parse(payload);
        var root = document.RootElement;

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(400, root.GetProperty("status").GetInt32());
        Assert.Contains("geometry", root.GetProperty("message").GetString(), StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Export_gpx_invalide_expose_un_message_coherent()
    {
        using var client = _factory.CreateClient();
        using var response = await client.PostAsJsonAsync("/api/v1/export/gpx", new
        {
            geometry = new
            {
                type = "Point",
                coordinates = new[]
                {
                    new[] { 2.35, 48.85 },
                    new[] { 2.36, 48.86 },
                },
            },
            name = "demo",
        });
        var payload = await response.Content.ReadAsStringAsync();
        using var document = JsonDocument.Parse(payload);
        var root = document.RootElement;

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(400, root.GetProperty("status").GetInt32());
        Assert.Contains("géométrie", root.GetProperty("message").GetString(), StringComparison.OrdinalIgnoreCase);
    }
}
