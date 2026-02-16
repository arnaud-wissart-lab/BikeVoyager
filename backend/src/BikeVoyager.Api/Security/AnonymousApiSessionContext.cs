namespace BikeVoyager.Api.Security;

public static class AnonymousApiSessionContext
{
    public const string ItemKey = "BikeVoyager.Api.AnonymousSessionId";

    public static bool TryGetSessionId(HttpContext context, out string sessionId)
    {
        sessionId = string.Empty;
        if (!context.Items.TryGetValue(ItemKey, out var value) || value is not string raw)
        {
            return false;
        }

        if (string.IsNullOrWhiteSpace(raw))
        {
            return false;
        }

        sessionId = raw;
        return true;
    }
}

