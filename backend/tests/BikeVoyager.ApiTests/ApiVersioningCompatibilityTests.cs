using System.Net;
using Microsoft.AspNetCore.Mvc.Testing;

namespace BikeVoyager.ApiTests;

public class ApiVersioningCompatibilityTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public ApiVersioningCompatibilityTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    [Theory]
    [InlineData("/api/v1/cloud/providers", HttpStatusCode.OK)]
    [InlineData("/api/cloud/providers", HttpStatusCode.OK)]
    [InlineData("/api/v1/places/search?q=a", HttpStatusCode.BadRequest)]
    [InlineData("/api/places/search?q=a", HttpStatusCode.BadRequest)]
    public async Task Routes_canonique_et_legacy_restent_accessibles(string path, HttpStatusCode expectedStatusCode)
    {
        using var client = _factory.CreateClient();
        using var response = await client.GetAsync(path);

        Assert.Equal(expectedStatusCode, response.StatusCode);
    }

    [Fact]
    public async Task Route_legacy_et_canonique_retournent_le_meme_status()
    {
        using var client = _factory.CreateClient();

        using var canonicalResponse = await client.GetAsync("/api/v1/cloud/providers");
        using var legacyResponse = await client.GetAsync("/api/cloud/providers");

        Assert.Equal(canonicalResponse.StatusCode, legacyResponse.StatusCode);
    }

    [Fact]
    public async Task Route_legacy_retourne_les_headers_de_deprecation()
    {
        using var client = _factory.CreateClient();

        using var canonicalResponse = await client.GetAsync("/api/v1/cloud/providers");
        using var legacyResponse = await client.GetAsync("/api/cloud/providers");

        Assert.Equal(HttpStatusCode.OK, legacyResponse.StatusCode);
        Assert.False(canonicalResponse.Headers.Contains("Deprecation"));
        Assert.False(canonicalResponse.Headers.Contains("Sunset"));

        Assert.True(legacyResponse.Headers.TryGetValues("Deprecation", out var deprecationValues));
        var deprecationValue = Assert.Single(deprecationValues);
        Assert.Equal("true", deprecationValue, StringComparer.OrdinalIgnoreCase);

        Assert.True(legacyResponse.Headers.TryGetValues("Sunset", out var sunsetValues));
        var sunsetValue = Assert.Single(sunsetValues);
        Assert.Equal("Tue, 30 Jun 2026 23:59:59 GMT", sunsetValue);
    }
}
