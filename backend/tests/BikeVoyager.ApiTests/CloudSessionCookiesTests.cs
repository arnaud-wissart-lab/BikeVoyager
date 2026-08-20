using BikeVoyager.Api.Cloud;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;

namespace BikeVoyager.ApiTests;

public sealed class CloudSessionCookiesTests
{
    [Theory]
    [InlineData("Development", false)]
    [InlineData("Staging", true)]
    [InlineData("Production", true)]
    public void SetAuthSessionId_definit_le_cookie_secure_hors_development(
        string environmentName,
        bool expectedSecure)
    {
        var cookies = new CloudSessionCookies(new TestHostEnvironment(environmentName));
        var context = new DefaultHttpContext();
        context.Request.Scheme = Uri.UriSchemeHttp;

        cookies.SetAuthSessionId(context, "session-id");

        var setCookie = Assert.Single(context.Response.Headers.SetCookie);
        var hasSecureAttribute = setCookie?.Contains("; secure", StringComparison.OrdinalIgnoreCase) ?? false;

        Assert.NotNull(setCookie);
        Assert.Equal(
            expectedSecure,
            hasSecureAttribute);
    }

    private sealed class TestHostEnvironment(string environmentName) : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = environmentName;

        public string ApplicationName { get; set; } = "BikeVoyager.ApiTests";

        public string ContentRootPath { get; set; } = AppContext.BaseDirectory;

        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }
}
