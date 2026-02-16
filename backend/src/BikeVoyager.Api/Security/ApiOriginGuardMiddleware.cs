using System.Net;
using System.Text.Json;
using Microsoft.Extensions.Options;

namespace BikeVoyager.Api.Security;

public sealed class ApiOriginGuardMiddleware
{
    private static readonly JsonSerializerOptions SerializerOptions = new(JsonSerializerDefaults.Web);
    private readonly RequestDelegate _next;
    private readonly IOptionsMonitor<ApiSecurityOptions> _optionsMonitor;
    private readonly ILogger<ApiOriginGuardMiddleware> _logger;

    public ApiOriginGuardMiddleware(
        RequestDelegate next,
        IOptionsMonitor<ApiSecurityOptions> optionsMonitor,
        ILogger<ApiOriginGuardMiddleware> logger)
    {
        _next = next;
        _optionsMonitor = optionsMonitor;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        if (!context.Request.Path.StartsWithSegments("/api"))
        {
            await _next(context);
            return;
        }

        if (HttpMethods.IsOptions(context.Request.Method))
        {
            await _next(context);
            return;
        }

        var options = _optionsMonitor.CurrentValue;
        var allowedOrigins = BuildAllowedOrigins(options.AllowedOrigins);
        if (allowedOrigins.Count == 0)
        {
            await _next(context);
            return;
        }

        var unsafeMethod =
            !HttpMethods.IsGet(context.Request.Method) &&
            !HttpMethods.IsHead(context.Request.Method) &&
            !HttpMethods.IsOptions(context.Request.Method);

        var originHeader = context.Request.Headers.Origin.ToString();
        if (TryParseOrigin(originHeader, out var origin) &&
            !IsOriginAllowed(origin, allowedOrigins))
        {
            await RejectAsync(context, "origin_not_allowed");
            return;
        }

        var refererHeader = context.Request.Headers.Referer.ToString();
        if (TryParseOrigin(refererHeader, out var referer) &&
            !IsOriginAllowed(referer, allowedOrigins))
        {
            await RejectAsync(context, "referer_not_allowed");
            return;
        }

        if (unsafeMethod &&
            options.EnforceOriginForUnsafeMethods &&
            string.IsNullOrWhiteSpace(originHeader) &&
            !IsLikelyLocalCall(context))
        {
            await RejectAsync(context, "origin_required");
            return;
        }

        await _next(context);
    }

    private static List<Uri> BuildAllowedOrigins(IEnumerable<string>? origins)
    {
        var values = new List<Uri>();
        if (origins is null)
        {
            return values;
        }

        foreach (var candidate in origins)
        {
            if (string.IsNullOrWhiteSpace(candidate))
            {
                continue;
            }

            if (!Uri.TryCreate(candidate.Trim(), UriKind.Absolute, out var parsed))
            {
                continue;
            }

            if (parsed.Scheme is not ("http" or "https"))
            {
                continue;
            }

            values.Add(parsed);
        }

        return values;
    }

    private static bool TryParseOrigin(string value, out Uri uri)
    {
        uri = default!;
        if (string.IsNullOrWhiteSpace(value))
        {
            return false;
        }

        if (!Uri.TryCreate(value.Trim(), UriKind.Absolute, out var parsed))
        {
            return false;
        }

        if (parsed.Scheme is not ("http" or "https"))
        {
            return false;
        }

        uri = parsed;
        return true;
    }

    private static bool IsOriginAllowed(Uri requestOrigin, IReadOnlyList<Uri> allowedOrigins)
    {
        for (var i = 0; i < allowedOrigins.Count; i++)
        {
            var allowed = allowedOrigins[i];
            if (string.Equals(allowed.Scheme, requestOrigin.Scheme, StringComparison.OrdinalIgnoreCase) &&
                string.Equals(allowed.Host, requestOrigin.Host, StringComparison.OrdinalIgnoreCase) &&
                allowed.Port == requestOrigin.Port)
            {
                return true;
            }
        }

        return false;
    }

    private static bool IsLikelyLocalCall(HttpContext context)
    {
        var remoteIp = context.Connection.RemoteIpAddress;
        if (remoteIp is null || IPAddress.IsLoopback(remoteIp))
        {
            return true;
        }

        var host = context.Request.Host.Host;
        return string.Equals(host, "localhost", StringComparison.OrdinalIgnoreCase) ||
               string.Equals(host, "127.0.0.1", StringComparison.OrdinalIgnoreCase);
    }

    private async Task RejectAsync(HttpContext context, string reason)
    {
        _logger.LogWarning(
            "ApiOriginGuardRejected {Reason} {Method} {Path}",
            reason,
            context.Request.Method,
            context.Request.Path);

        context.Response.StatusCode = StatusCodes.Status403Forbidden;
        context.Response.ContentType = "application/json";

        var payload = JsonSerializer.Serialize(
            new
            {
                message = "Requete API refusee par la politique d'origine.",
                reason,
            },
            SerializerOptions);

        await context.Response.WriteAsync(payload);
    }
}
