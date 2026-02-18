using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace BikeVoyager.ApiTests;

public class ApiOriginGuardMiddlewareTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public ApiOriginGuardMiddlewareTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Health_rejette_origin_non_autorisee_quand_allowed_origins_est_configure()
    {
        using var client = CreateClientWithAllowedOrigins("https://allowed.example");
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/v1/health");
        request.Headers.TryAddWithoutValidation("Origin", "https://evil.example");

        using var response = await client.SendAsync(request);
        var payload = await response.Content.ReadAsStringAsync();
        using var document = JsonDocument.Parse(payload);
        var root = document.RootElement;

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal("application/json", response.Content.Headers.ContentType?.MediaType);
        Assert.Equal("origin_not_allowed", root.GetProperty("reason").GetString());
    }

    [Fact]
    public async Task Health_rejette_referer_non_autorise_quand_allowed_origins_est_configure()
    {
        using var client = CreateClientWithAllowedOrigins("https://allowed.example");
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/v1/health");
        request.Headers.Referrer = new Uri("https://evil.example/some/path");

        using var response = await client.SendAsync(request);
        var payload = await response.Content.ReadAsStringAsync();
        using var document = JsonDocument.Parse(payload);
        var root = document.RootElement;

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal("application/json", response.Content.Headers.ContentType?.MediaType);
        Assert.Equal("referer_not_allowed", root.GetProperty("reason").GetString());
    }

    [Fact]
    public async Task Health_accepte_origin_autorisee_quand_allowed_origins_est_configure()
    {
        using var client = CreateClientWithAllowedOrigins("https://allowed.example");
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/v1/health");
        request.Headers.TryAddWithoutValidation("Origin", "https://allowed.example");

        using var response = await client.SendAsync(request);
        var payload = await response.Content.ReadAsStringAsync();
        using var document = JsonDocument.Parse(payload);
        var root = document.RootElement;

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("ok", root.GetProperty("status").GetString());
    }

    private HttpClient CreateClientWithAllowedOrigins(params string[] allowedOrigins)
    {
        var app = _factory.WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Development");
            for (var index = 0; index < allowedOrigins.Length; index += 1)
            {
                builder.UseSetting($"ApiSecurity:AllowedOrigins:{index}", allowedOrigins[index]);
            }
        });

        return app.CreateClient();
    }
}
