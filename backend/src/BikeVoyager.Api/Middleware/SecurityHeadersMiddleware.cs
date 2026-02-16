namespace BikeVoyager.Api.Middleware;

public sealed class SecurityHeadersMiddleware
{
    private const string XContentTypeOptionsHeader = "X-Content-Type-Options";
    private const string ReferrerPolicyHeader = "Referrer-Policy";
    private const string XFrameOptionsHeader = "X-Frame-Options";
    private const string PermissionsPolicyHeader = "Permissions-Policy";
    private const string PermissionsPolicyValue = "geolocation=(), camera=(), microphone=()";

    private readonly RequestDelegate _next;

    public SecurityHeadersMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public Task InvokeAsync(HttpContext context)
    {
        context.Response.OnStarting(static state =>
        {
            var httpContext = (HttpContext)state;
            var headers = httpContext.Response.Headers;

            headers[XContentTypeOptionsHeader] = "nosniff";
            headers[ReferrerPolicyHeader] = "strict-origin-when-cross-origin";
            headers[XFrameOptionsHeader] = "DENY";
            headers[PermissionsPolicyHeader] = PermissionsPolicyValue;

            return Task.CompletedTask;
        }, context);

        return _next(context);
    }
}
