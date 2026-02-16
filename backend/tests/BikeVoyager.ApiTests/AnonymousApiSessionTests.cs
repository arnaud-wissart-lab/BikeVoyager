using System.Net;
using Microsoft.AspNetCore.Mvc.Testing;

namespace BikeVoyager.ApiTests;

public class AnonymousApiSessionTests : IClassFixture<WebApplicationFactory<Program>>
{
    private const string SessionCookieName = "bv_anon_sid";
    private readonly WebApplicationFactory<Program> _factory;

    public AnonymousApiSessionTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Api_request_cree_un_cookie_de_session_anonyme()
    {
        using var client = _factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            HandleCookies = false,
        });

        using var response = await client.GetAsync("/api/cloud/providers");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var sessionCookie = response.Headers
            .GetValues("Set-Cookie")
            .First(value => value.StartsWith($"{SessionCookieName}=", StringComparison.OrdinalIgnoreCase));

        Assert.Contains("httponly", sessionCookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("samesite=lax", sessionCookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("path=/", sessionCookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("expires=", sessionCookie, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Cookie_de_session_valide_est_reutilise_sans_rotation()
    {
        using var client = _factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            HandleCookies = true,
        });

        using var firstResponse = await client.GetAsync("/api/cloud/providers");
        Assert.Equal(HttpStatusCode.OK, firstResponse.StatusCode);
        Assert.Contains(
            firstResponse.Headers.GetValues("Set-Cookie"),
            value => value.StartsWith($"{SessionCookieName}=", StringComparison.OrdinalIgnoreCase));

        using var secondResponse = await client.GetAsync("/api/cloud/providers");
        Assert.Equal(HttpStatusCode.OK, secondResponse.StatusCode);
        Assert.False(
            secondResponse.Headers.TryGetValues("Set-Cookie", out var secondSetCookies) &&
            secondSetCookies.Any(value =>
                value.StartsWith($"{SessionCookieName}=", StringComparison.OrdinalIgnoreCase)));
    }

    [Fact]
    public async Task Cookie_de_session_invalide_est_remplace()
    {
        using var client = _factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            HandleCookies = false,
        });

        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/cloud/providers");
        request.Headers.Add("Cookie", $"{SessionCookieName}=invalid");

        using var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains(
            response.Headers.GetValues("Set-Cookie"),
            value => value.StartsWith($"{SessionCookieName}=", StringComparison.OrdinalIgnoreCase));
    }
}
