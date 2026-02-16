namespace BikeVoyager.Api.Cloud.OAuth;

public interface ICloudOAuthRedirectPolicy
{
    string ResolveRedirectUri(HttpContext httpContext, string? candidate);
    bool IsRedirectUriAllowed(HttpContext httpContext, string redirectUri);
}
