namespace BikeVoyager.Api.Middleware;

public sealed class LegacyApiPathRewriteMiddleware
{
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

        _logger.LogDebug(
            "LegacyApiPathRewritten {LegacyPath} -> {VersionedPath}",
            path.Value,
            rewrittenPath.Value);

        context.Request.Path = rewrittenPath;
        await _next(context);
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
