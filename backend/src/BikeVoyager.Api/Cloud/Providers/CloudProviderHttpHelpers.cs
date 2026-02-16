using System.Net.Http.Headers;
using System.Text.Json;

namespace BikeVoyager.Api.Cloud.Providers;

internal static class CloudProviderHttpHelpers
{
    public static async Task<string> ParseCloudErrorAsync(
        HttpResponseMessage response,
        CancellationToken cancellationToken)
    {
        var fallback = $"{(int)response.StatusCode} {response.ReasonPhrase}".Trim();
        var raw = await response.Content.ReadAsStringAsync(cancellationToken);
        if (string.IsNullOrWhiteSpace(raw))
        {
            return fallback;
        }

        try
        {
            using var document = JsonDocument.Parse(raw);
            var root = document.RootElement;

            var errorDescription = GetString(root, "error_description");
            if (!string.IsNullOrWhiteSpace(errorDescription))
            {
                return errorDescription;
            }

            var message = GetString(root, "message");
            if (!string.IsNullOrWhiteSpace(message))
            {
                return message;
            }

            if (root.TryGetProperty("error", out var errorNode))
            {
                if (errorNode.ValueKind == JsonValueKind.String)
                {
                    var value = errorNode.GetString();
                    if (!string.IsNullOrWhiteSpace(value))
                    {
                        return value;
                    }
                }

                if (errorNode.ValueKind == JsonValueKind.Object)
                {
                    var nestedMessage = GetString(errorNode, "message");
                    if (!string.IsNullOrWhiteSpace(nestedMessage))
                    {
                        return nestedMessage;
                    }
                }
            }
        }
        catch
        {
            // Ignore les erreurs de parsing et conserve le message brut de repli.
        }

        return raw.Length > 240 ? raw[..240] : raw;
    }

    public static async Task<CloudTokenPayload> ParseTokenPayloadAsync(
        HttpResponseMessage response,
        CancellationToken cancellationToken)
    {
        using var document = await ReadJsonDocumentAsync(response, cancellationToken);
        var root = document.RootElement;

        var accessToken = GetString(root, "access_token") ?? string.Empty;
        var refreshToken = GetString(root, "refresh_token");
        var tokenType = GetString(root, "token_type") ?? "Bearer";
        var scope = GetString(root, "scope");
        var expiresInSeconds = GetInt(root, "expires_in") ?? 0;

        return new CloudTokenPayload(
            accessToken,
            refreshToken,
            tokenType,
            scope,
            Math.Max(0, expiresInSeconds));
    }

    public static async Task<HttpResponseMessage> SendAuthorizedAsync(
        HttpClient httpClient,
        string accessToken,
        HttpMethod method,
        string url,
        HttpContent? content,
        CancellationToken cancellationToken)
    {
        var request = new HttpRequestMessage(method, url);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        request.Content = content;
        return await httpClient.SendAsync(request, cancellationToken);
    }

    public static async Task<JsonDocument> ReadJsonDocumentAsync(
        HttpResponseMessage response,
        CancellationToken cancellationToken)
    {
        var raw = await response.Content.ReadAsStringAsync(cancellationToken);
        if (string.IsNullOrWhiteSpace(raw))
        {
            return JsonDocument.Parse("{}");
        }

        return JsonDocument.Parse(raw);
    }

    public static bool TryGetFirstArrayItem(
        JsonElement root,
        string propertyName,
        out JsonElement firstItem)
    {
        firstItem = default;
        if (!root.TryGetProperty(propertyName, out var collection) ||
            collection.ValueKind != JsonValueKind.Array ||
            collection.GetArrayLength() == 0)
        {
            return false;
        }

        firstItem = collection[0];
        return true;
    }

    public static string? GetString(JsonElement element, string propertyName)
    {
        if (!element.TryGetProperty(propertyName, out var property) ||
            property.ValueKind != JsonValueKind.String)
        {
            return null;
        }

        var value = property.GetString();
        return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }

    public static int? GetInt(JsonElement element, string propertyName)
    {
        if (!element.TryGetProperty(propertyName, out var property))
        {
            return null;
        }

        if (property.ValueKind == JsonValueKind.Number && property.TryGetInt32(out var number))
        {
            return number;
        }

        if (property.ValueKind == JsonValueKind.String &&
            int.TryParse(property.GetString(), out var parsed))
        {
            return parsed;
        }

        return null;
    }

    public static string EscapeGoogleQuery(string value) =>
        value.Replace("\\", "\\\\", StringComparison.Ordinal)
            .Replace("'", "\\'", StringComparison.Ordinal);
}
