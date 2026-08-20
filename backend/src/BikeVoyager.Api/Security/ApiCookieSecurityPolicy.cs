using Microsoft.Extensions.Hosting;

namespace BikeVoyager.Api.Security;

internal static class ApiCookieSecurityPolicy
{
    public static bool UseSecureCookies(IHostEnvironment environment)
    {
        return !environment.IsDevelopment();
    }
}
