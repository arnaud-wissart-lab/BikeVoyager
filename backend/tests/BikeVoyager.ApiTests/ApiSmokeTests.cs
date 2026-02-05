using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace BikeVoyager.ApiTests;

public class ApiSmokeTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public ApiSmokeTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.WithWebHostBuilder(builder =>
            {
                builder.UseEnvironment("Development");
            })
            .CreateClient();
    }

    [Fact]
    public async Task Health_retourne_un_correlation_id()
    {
        var response = await _client.GetAsync("/api/v1/health");

        response.EnsureSuccessStatusCode();
        Assert.True(response.Headers.Contains("X-Correlation-Id"));
    }

    [Fact]
    public async Task CreateTrip_rejette_un_corps_invalide()
    {
        var response = await _client.PostAsJsonAsync("/api/v1/trips", new
        {
            Name = "",
            DistanceKm = 0,
            StartDateUtc = DateTime.UtcNow
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}
