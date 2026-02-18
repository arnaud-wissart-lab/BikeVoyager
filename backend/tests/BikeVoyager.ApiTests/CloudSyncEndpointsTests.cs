using System.Net;
using System.Text.Json;
using BikeVoyager.Api.Cloud;
using Microsoft.AspNetCore.Mvc.Testing;

namespace BikeVoyager.ApiTests;

public class CloudSyncEndpointsTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public CloudSyncEndpointsTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Providers_retourne_la_configuration_cloud()
    {
        using var client = _factory.CreateClient();
        using var response = await client.GetAsync("/api/v1/cloud/providers");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var payload = await response.Content.ReadAsStringAsync();
        using var document = JsonDocument.Parse(payload);
        var providers = document.RootElement.GetProperty("providers");

        Assert.True(providers.TryGetProperty("onedrive", out _));
        Assert.True(providers.TryGetProperty("googleDrive", out _));
    }

    [Fact]
    public async Task Session_retourne_deconnecte_par_defaut()
    {
        using var client = _factory.CreateClient();
        using var response = await client.GetAsync("/api/v1/cloud/session");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var payload = await response.Content.ReadAsStringAsync();
        using var document = JsonDocument.Parse(payload);
        Assert.False(document.RootElement.GetProperty("connected").GetBoolean());
    }

    [Fact]
    public async Task Status_retourne_les_diagnostics_cloud()
    {
        using var client = _factory.CreateClient();
        using var response = await client.GetAsync("/api/v1/cloud/status");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var payload = await response.Content.ReadAsStringAsync();
        using var document = JsonDocument.Parse(payload);
        var root = document.RootElement;

        var providers = root.GetProperty("providers");
        Assert.True(providers.TryGetProperty("onedrive", out _));
        Assert.True(providers.TryGetProperty("googleDrive", out _));

        var session = root.GetProperty("session");
        Assert.False(session.GetProperty("connected").GetBoolean());

        var cache = root.GetProperty("cache");
        Assert.True(cache.TryGetProperty("distributedCacheType", out var cacheType));
        Assert.False(string.IsNullOrWhiteSpace(cacheType.GetString()));
        Assert.True(cache.TryGetProperty("healthy", out _));
        Assert.True(cache.TryGetProperty("fallback", out _));

        Assert.True(root.TryGetProperty("serverTimeUtc", out var serverTimeUtc));
        Assert.False(string.IsNullOrWhiteSpace(serverTimeUtc.GetString()));
    }

    [Fact]
    public async Task Disconnect_reinitialise_la_session()
    {
        using var client = _factory.CreateClient();
        using var response = await client.PostAsync("/api/v1/cloud/disconnect", content: null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var payload = await response.Content.ReadAsStringAsync();
        using var document = JsonDocument.Parse(payload);
        Assert.True(document.RootElement.GetProperty("disconnected").GetBoolean());
    }

    [Fact]
    public async Task Disconnect_emet_les_cookies_cloud_avec_path_api()
    {
        using var client = _factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            HandleCookies = false,
        });

        using var response = await client.PostAsync("/api/v1/cloud/disconnect", content: null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var setCookies = response.Headers.GetValues("Set-Cookie").ToArray();
        var authCookie = setCookies.First(value =>
            value.StartsWith($"{CloudSessionCookies.AuthSessionCookieName}=", StringComparison.OrdinalIgnoreCase));
        var pendingCookie = setCookies.First(value =>
            value.StartsWith($"{CloudSessionCookies.PendingSessionCookieName}=", StringComparison.OrdinalIgnoreCase));

        Assert.Contains("httponly", authCookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("samesite=lax", authCookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("path=/api", authCookie, StringComparison.OrdinalIgnoreCase);

        Assert.Contains("httponly", pendingCookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("samesite=lax", pendingCookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("path=/api", pendingCookie, StringComparison.OrdinalIgnoreCase);
    }
}
