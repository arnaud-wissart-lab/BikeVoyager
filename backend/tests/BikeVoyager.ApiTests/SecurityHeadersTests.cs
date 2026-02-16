using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace BikeVoyager.ApiTests;

public class SecurityHeadersTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public SecurityHeadersTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Health_expose_les_headers_de_securite_hors_development()
    {
        using var client = _factory
            .WithWebHostBuilder(builder =>
            {
                builder.UseEnvironment("Production");
            })
            .CreateClient(new WebApplicationFactoryClientOptions
            {
                BaseAddress = new Uri("https://bikevoyager.test"),
            });

        using var response = await client.GetAsync("/api/v1/health");

        response.EnsureSuccessStatusCode();
        AssertHeaderValue(response, "X-Content-Type-Options", "nosniff");
        AssertHeaderValue(response, "Referrer-Policy", "strict-origin-when-cross-origin");
        AssertHeaderValue(response, "X-Frame-Options", "DENY");
        AssertHeaderValue(response, "Permissions-Policy", "geolocation=(), camera=(), microphone=()");
        Assert.True(response.Headers.TryGetValues("Strict-Transport-Security", out var hstsValues));
        Assert.Contains("max-age=", Assert.Single(hstsValues), StringComparison.OrdinalIgnoreCase);
    }

    private static void AssertHeaderValue(HttpResponseMessage response, string headerName, string expectedValue)
    {
        Assert.True(response.Headers.TryGetValues(headerName, out var values));
        Assert.Equal(expectedValue, Assert.Single(values));
    }
}
