namespace BikeVoyager.Api.Cloud.OAuth;

public sealed class CloudOAuthRedirectPolicy : ICloudOAuthRedirectPolicy
{
    public string ResolveRedirectUri(HttpContext httpContext, string? candidate)
    {
        if (!string.IsNullOrWhiteSpace(candidate))
        {
            return candidate.Trim();
        }

        var request = httpContext.Request;
        var baseUri = $"{request.Scheme}://{request.Host}";
        return $"{baseUri}/";
    }

    public bool IsRedirectUriAllowed(HttpContext httpContext, string redirectUri)
    {
        if (!Uri.TryCreate(redirectUri, UriKind.Absolute, out var parsedRedirectUri))
        {
            return false;
        }

        if (parsedRedirectUri.Scheme is not ("https" or "http"))
        {
            return false;
        }

        var origin = httpContext.Request.Headers.Origin.ToString();
        if (!string.IsNullOrWhiteSpace(origin) &&
            Uri.TryCreate(origin, UriKind.Absolute, out var originUri))
        {
            return string.Equals(originUri.Scheme, parsedRedirectUri.Scheme, StringComparison.OrdinalIgnoreCase) &&
                   string.Equals(originUri.Host, parsedRedirectUri.Host, StringComparison.OrdinalIgnoreCase) &&
                   originUri.Port == parsedRedirectUri.Port;
        }

        return true;
    }
}
