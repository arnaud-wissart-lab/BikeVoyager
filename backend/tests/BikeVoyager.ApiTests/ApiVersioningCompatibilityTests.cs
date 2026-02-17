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
    [InlineData("/api/v1/places/search?q=a", HttpStatusCode.BadRequest)]
    public async Task Routes_canonique_restent_accessibles(string path, HttpStatusCode expectedStatusCode)
    {
        using var client = _factory.CreateClient();
        using var response = await client.GetAsync(path);

        Assert.Equal(expectedStatusCode, response.StatusCode);
    }

}
