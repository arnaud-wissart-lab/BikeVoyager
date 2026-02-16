namespace BikeVoyager.Api.Extensions;

internal static class ApiProblemResults
{
    public static IResult Message(
        int statusCode,
        string message,
        string? title = null,
        IReadOnlyDictionary<string, object?>? extensions = null)
    {
        var values = new Dictionary<string, object?>(StringComparer.Ordinal)
        {
            ["message"] = message,
        };

        if (extensions is not null)
        {
            foreach (var extension in extensions)
            {
                values[extension.Key] = extension.Value;
            }
        }

        return Results.Problem(
            statusCode: statusCode,
            title: title,
            detail: message,
            extensions: values);
    }

    public static IResult Status(int statusCode, string? detail = null, string? title = null)
    {
        return Results.Problem(
            statusCode: statusCode,
            title: title,
            detail: detail);
    }
}
