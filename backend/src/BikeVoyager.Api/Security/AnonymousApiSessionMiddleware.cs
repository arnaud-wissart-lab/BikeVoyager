using System.Security.Cryptography;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.Extensions.Options;

namespace BikeVoyager.Api.Security;

public sealed class AnonymousApiSessionMiddleware
{
    private const string ProtectorPurpose = "BikeVoyager.Api.Security.AnonymousApiSession.v1";
    private static readonly TimeSpan MinimumSessionLifetime = TimeSpan.FromHours(1);

    private readonly RequestDelegate _next;
    private readonly IDataProtector _protector;
    private readonly IOptionsMonitor<ApiSecurityOptions> _optionsMonitor;
    private readonly ILogger<AnonymousApiSessionMiddleware> _logger;

    public AnonymousApiSessionMiddleware(
        RequestDelegate next,
        IDataProtectionProvider dataProtectionProvider,
        IOptionsMonitor<ApiSecurityOptions> optionsMonitor,
        ILogger<AnonymousApiSessionMiddleware> logger)
    {
        _next = next;
        _protector = dataProtectionProvider.CreateProtector(ProtectorPurpose);
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
        var cookieName = NormalizeCookieName(options.AnonymousSessionCookieName);
        var sessionLifetime = ResolveLifetime(options.AnonymousSessionLifetimeHours);
        var now = DateTimeOffset.UtcNow;

        if (TryReadSession(context, cookieName, now, out var sessionId))
        {
            context.Items[AnonymousApiSessionContext.ItemKey] = sessionId;
            await _next(context);
            return;
        }

        sessionId = CreateSessionId();
        var expiresAt = now.Add(sessionLifetime);
        var payload = $"{sessionId}|{expiresAt.ToUnixTimeSeconds()}";
        var protectedValue = _protector.Protect(payload);

        context.Items[AnonymousApiSessionContext.ItemKey] = sessionId;
        context.Response.Cookies.Append(cookieName, protectedValue, new CookieOptions
        {
            HttpOnly = true,
            IsEssential = true,
            SameSite = SameSiteMode.Lax,
            Secure = context.Request.IsHttps,
            Path = "/api",
            Expires = expiresAt,
        });

        await _next(context);
    }

    private bool TryReadSession(
        HttpContext context,
        string cookieName,
        DateTimeOffset now,
        out string sessionId)
    {
        sessionId = string.Empty;
        if (!context.Request.Cookies.TryGetValue(cookieName, out var protectedValue) ||
            string.IsNullOrWhiteSpace(protectedValue))
        {
            return false;
        }

        string payload;
        try
        {
            payload = _protector.Unprotect(protectedValue);
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Anonymous API session cookie unprotect failed.");
            return false;
        }

        var separatorIndex = payload.LastIndexOf('|');
        if (separatorIndex <= 0 || separatorIndex >= payload.Length - 1)
        {
            return false;
        }

        var rawSessionId = payload[..separatorIndex].Trim();
        var rawExpiresAt = payload[(separatorIndex + 1)..].Trim();

        if (!IsValidSessionId(rawSessionId))
        {
            return false;
        }

        if (!long.TryParse(rawExpiresAt, out var expiresAtUnix))
        {
            return false;
        }

        var expiresAt = DateTimeOffset.FromUnixTimeSeconds(expiresAtUnix);
        if (expiresAt <= now)
        {
            return false;
        }

        sessionId = rawSessionId;
        return true;
    }

    private static bool IsValidSessionId(string sessionId)
    {
        if (string.IsNullOrWhiteSpace(sessionId) || sessionId.Length is < 16 or > 128)
        {
            return false;
        }

        for (var i = 0; i < sessionId.Length; i++)
        {
            var current = sessionId[i];
            var isAlphaNumeric =
                (current >= 'a' && current <= 'z') ||
                (current >= '0' && current <= '9');

            if (!isAlphaNumeric)
            {
                return false;
            }
        }

        return true;
    }

    private static string CreateSessionId()
    {
        var bytes = RandomNumberGenerator.GetBytes(16);
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    private static string NormalizeCookieName(string? candidate) =>
        string.IsNullOrWhiteSpace(candidate) ? "bv_anon_sid" : candidate.Trim();

    private static TimeSpan ResolveLifetime(int configuredHours)
    {
        if (configuredHours <= 0)
        {
            return MinimumSessionLifetime;
        }

        var proposed = TimeSpan.FromHours(configuredHours);
        return proposed < MinimumSessionLifetime ? MinimumSessionLifetime : proposed;
    }
}
