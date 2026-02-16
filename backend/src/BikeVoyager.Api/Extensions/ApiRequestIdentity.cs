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
