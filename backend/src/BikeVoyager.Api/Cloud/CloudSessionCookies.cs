namespace BikeVoyager.Api.Cloud;

public sealed class CloudSessionCookies : ICloudSessionCookies
{
    public const string AuthSessionCookieName = "bv_cloud_auth_sid";
    public const string PendingSessionCookieName = "bv_cloud_pending_sid";

    private static readonly TimeSpan AuthSessionCookieLifetime = TimeSpan.FromDays(30);
    private static readonly TimeSpan PendingSessionCookieLifetime = TimeSpan.FromMinutes(10);

    public bool TryGetAuthSessionId(HttpContext httpContext, out string value)
    {
        return TryGetCookieValue(httpContext, AuthSessionCookieName, out value);
    }

    public bool TryGetPendingSessionId(HttpContext httpContext, out string value)
    {
        return TryGetCookieValue(httpContext, PendingSessionCookieName, out value);
    }

    public void SetAuthSessionId(HttpContext httpContext, string value)
    {
        SetCookie(httpContext, AuthSessionCookieName, value, AuthSessionCookieLifetime);
    }

    public void SetPendingSessionId(HttpContext httpContext, string value)
    {
        SetCookie(httpContext, PendingSessionCookieName, value, PendingSessionCookieLifetime);
    }

    public void DeleteAuthSessionId(HttpContext httpContext)
    {
        DeleteCookie(httpContext, AuthSessionCookieName);
    }

    public void DeletePendingSessionId(HttpContext httpContext)
    {
        DeleteCookie(httpContext, PendingSessionCookieName);
    }

    private static bool TryGetCookieValue(
        HttpContext httpContext,
        string cookieName,
        out string value)
    {
        value = string.Empty;
        if (!httpContext.Request.Cookies.TryGetValue(cookieName, out var rawValue))
        {
            return false;
        }

        var trimmed = rawValue?.Trim();
        if (string.IsNullOrWhiteSpace(trimmed))
        {
            return false;
        }

        value = trimmed;
        return true;
    }

    private static void SetCookie(
        HttpContext httpContext,
        string cookieName,
        string value,
        TimeSpan lifetime)
    {
        httpContext.Response.Cookies.Append(cookieName, value, new CookieOptions
        {
            HttpOnly = true,
            Secure = httpContext.Request.IsHttps,
            SameSite = SameSiteMode.Lax,
            IsEssential = true,
            Path = "/",
            Expires = DateTimeOffset.UtcNow.Add(lifetime),
        });
    }

    private static void DeleteCookie(HttpContext httpContext, string cookieName)
    {
        httpContext.Response.Cookies.Delete(cookieName, new CookieOptions
        {
            HttpOnly = true,
            Secure = httpContext.Request.IsHttps,
            SameSite = SameSiteMode.Lax,
            IsEssential = true,
            Path = "/",
        });
    }
}
