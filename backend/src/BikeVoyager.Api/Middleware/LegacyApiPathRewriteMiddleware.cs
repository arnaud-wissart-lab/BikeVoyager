namespace BikeVoyager.Api.Middleware;

public sealed class LegacyApiPathRewriteMiddleware
{
    private const string DeprecationHeaderName = "Deprecation";
    private const string DeprecationHeaderValue = "true";
    private const string SunsetHeaderName = "Sunset";
    private const string LegacyApiSunset = "Tue, 30 Jun 2026 23:59:59 GMT";

    private static readonly string[] LegacyPrefixes =
    [
        "/api/route",
        "/api/loop",
        "/api/places",
        "/api/poi",
        "/api/export",
        "/api/cloud",
        "/api/feedback",
        "/api/valhalla",
    ];

    private readonly RequestDelegate _next;
    private readonly ILogger<LegacyApiPathRewriteMiddleware> _logger;

    public LegacyApiPathRewriteMiddleware(
        RequestDelegate next,
        ILogger<LegacyApiPathRewriteMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var path = context.Request.Path;
        if (!TryRewritePath(path, out var rewrittenPath))
        {
            await _next(context);
            return;
        }

        RegisterDeprecationHeaders(context);

        _logger.LogInformation(
            "Legacy API path used Method={Method} LegacyPath={LegacyPath} VersionedPath={VersionedPath}",
            context.Request.Method,
            path.Value,
            rewrittenPath.Value);

        context.Request.Path = rewrittenPath;
        await _next(context);
    }

    private static void RegisterDeprecationHeaders(HttpContext context)
    {
        context.Response.OnStarting(static state =>
        {
            var httpContext = (HttpContext)state;
            httpContext.Response.Headers[DeprecationHeaderName] = DeprecationHeaderValue;
            httpContext.Response.Headers[SunsetHeaderName] = LegacyApiSunset;
            return Task.CompletedTask;
        }, context);
    }

    private static bool TryRewritePath(PathString path, out PathString rewrittenPath)
    {
        rewrittenPath = default;

        if (!path.HasValue || path.StartsWithSegments("/api/v1"))
        {
            return false;
        }

        var value = path.Value!;
        for (var index = 0; index < LegacyPrefixes.Length; index++)
        {
            var prefix = LegacyPrefixes[index];
            if (value.Equals(prefix, StringComparison.OrdinalIgnoreCase) ||
                value.StartsWith($"{prefix}/", StringComparison.OrdinalIgnoreCase))
            {
                rewrittenPath = new PathString($"/api/v1{value["/api".Length..]}");
                return true;
            }
        }

        return false;
    }
}
