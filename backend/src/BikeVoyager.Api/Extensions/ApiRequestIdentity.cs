using BikeVoyager.Api.Security;

namespace BikeVoyager.Api.Extensions;

internal static class ApiRequestIdentity
{
    public static string BuildRateLimitPartitionKey(HttpContext context)
    {
        if (AnonymousApiSessionContext.TryGetSessionId(context, out var sessionId) &&
            !string.IsNullOrWhiteSpace(sessionId))
        {
            return sessionId;
        }

        var forwardedFor = context.Request.Headers["X-Forwarded-For"].FirstOrDefault();
        if (!string.IsNullOrWhiteSpace(forwardedFor))
        {
            var firstValue = forwardedFor.Split(',')[0].Trim();
            if (!string.IsNullOrWhiteSpace(firstValue))
            {
                return firstValue;
            }
        }

        return context.Connection.RemoteIpAddress?.ToString() ??
               context.TraceIdentifier;
    }

    public static string ResolveRequestSessionId(HttpContext context)
    {
        if (AnonymousApiSessionContext.TryGetSessionId(context, out var sessionId) &&
            !string.IsNullOrWhiteSpace(sessionId))
        {
            return sessionId;
        }

        return context.TraceIdentifier;
    }
}
