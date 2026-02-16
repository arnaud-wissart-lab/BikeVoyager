namespace BikeVoyager.Api.Cloud;

public interface ICloudSessionCookies
{
    bool TryGetAuthSessionId(HttpContext httpContext, out string value);
    bool TryGetPendingSessionId(HttpContext httpContext, out string value);
    void SetAuthSessionId(HttpContext httpContext, string value);
    void SetPendingSessionId(HttpContext httpContext, string value);
    void DeleteAuthSessionId(HttpContext httpContext);
    void DeletePendingSessionId(HttpContext httpContext);
}
