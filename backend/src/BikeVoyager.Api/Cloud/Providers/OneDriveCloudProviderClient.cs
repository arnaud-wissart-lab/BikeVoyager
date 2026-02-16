using Microsoft.AspNetCore.Http.Extensions;
using Microsoft.Extensions.Options;
using System.Net;
using System.Text;
using System.Text.Json;

namespace BikeVoyager.Api.Cloud.Providers;

internal sealed class OneDriveCloudProviderClient(
    HttpClient httpClient,
    IOptions<CloudSyncOptions> options)
    : CloudProviderClientBase(httpClient, options)
{
    private const string MicrosoftAuthorizeUrl = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
    private const string MicrosoftTokenUrl = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
    private const string MicrosoftGraphApiBase = "https://graph.microsoft.com/v1.0";

    public override CloudProviderKind Provider => CloudProviderKind.OneDrive;

    public override string BuildAuthorizationUrl(CloudOAuthPendingState pendingState, string codeChallenge)
    {
        var clientId = GetClientId();
        if (string.IsNullOrWhiteSpace(clientId))
        {
            throw new CloudSyncException("Client ID cloud non configuré.");
        }

        var query = new Dictionary<string, string?>
        {
            ["client_id"] = clientId,
            ["redirect_uri"] = pendingState.RedirectUri,
            ["response_type"] = "code",
            ["scope"] = BuildAuthScope(Provider),
            ["state"] = pendingState.State,
            ["code_challenge"] = codeChallenge,
            ["code_challenge_method"] = "S256",
            ["prompt"] = "select_account",
        };

        return $"{MicrosoftAuthorizeUrl}{QueryString.Create(query)}";
    }

    public override async Task<CloudTokenPayload> ExchangeAuthorizationCodeAsync(
        CloudOAuthPendingState pendingState,
        string code,
        CancellationToken cancellationToken)
    {
        var clientId = GetClientId();
        if (string.IsNullOrWhiteSpace(clientId))
        {
            throw new CloudSyncException("Client ID cloud non configuré.");
        }

        var clientSecret = GetClientSecret();
        var payload = new Dictionary<string, string>
        {
            ["client_id"] = clientId,
            ["grant_type"] = "authorization_code",
            ["code"] = code,
            ["redirect_uri"] = pendingState.RedirectUri,
            ["code_verifier"] = pendingState.Verifier,
        };
        if (!string.IsNullOrWhiteSpace(clientSecret))
        {
            payload["client_secret"] = clientSecret;
        }

        using var response = await HttpClient.PostAsync(
            MicrosoftTokenUrl,
            new FormUrlEncodedContent(payload),
            cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            throw new CloudSyncException(
                await CloudProviderHttpHelpers.ParseCloudErrorAsync(response, cancellationToken),
                (int)HttpStatusCode.BadGateway);
        }

        return await CloudProviderHttpHelpers.ParseTokenPayloadAsync(response, cancellationToken);
    }

    public override async Task<CloudTokenPayload> RefreshTokenAsync(
        CloudAuthState authState,
        CancellationToken cancellationToken)
    {
        var clientId = GetClientId();
        if (string.IsNullOrWhiteSpace(clientId))
        {
            throw new CloudSyncException("Client ID cloud non configuré.");
        }

        var clientSecret = GetClientSecret();
        var payload = new Dictionary<string, string>
        {
            ["client_id"] = clientId,
            ["grant_type"] = "refresh_token",
            ["refresh_token"] = authState.RefreshToken!,
            ["scope"] = BuildAuthScope(Provider),
        };
        if (!string.IsNullOrWhiteSpace(clientSecret))
        {
            payload["client_secret"] = clientSecret;
        }

        using var response = await HttpClient.PostAsync(
            MicrosoftTokenUrl,
            new FormUrlEncodedContent(payload),
            cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            throw new CloudSyncException(
                await CloudProviderHttpHelpers.ParseCloudErrorAsync(response, cancellationToken),
                StatusCodes.Status401Unauthorized);
        }

        return await CloudProviderHttpHelpers.ParseTokenPayloadAsync(response, cancellationToken);
    }

    public override async Task<(string? Email, string? Name)> FetchAccountAsync(
        string accessToken,
        CancellationToken cancellationToken)
    {
        using var response = await CloudProviderHttpHelpers.SendAuthorizedAsync(
            HttpClient,
            accessToken,
            HttpMethod.Get,
            $"{MicrosoftGraphApiBase}/me?$select=displayName,userPrincipalName,mail",
            null,
            cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            return (null, null);
        }

        using var document = await CloudProviderHttpHelpers.ReadJsonDocumentAsync(response, cancellationToken);
        var root = document.RootElement;
        var email = CloudProviderHttpHelpers.GetString(root, "mail") ??
                    CloudProviderHttpHelpers.GetString(root, "userPrincipalName");
        return (email, CloudProviderHttpHelpers.GetString(root, "displayName"));
    }

    public override async Task<string> UploadBackupAsync(
        CloudAuthState authState,
        string backupFolderName,
        string fileName,
        string content,
        CancellationToken cancellationToken)
    {
        await EnsureBackupFolderAsync(authState, backupFolderName, cancellationToken);
        var folderName = Uri.EscapeDataString(backupFolderName);
        var escapedFileName = Uri.EscapeDataString(fileName);
        var url = $"{MicrosoftGraphApiBase}/me/drive/root:/{folderName}/{escapedFileName}:/content";

        using var response = await CloudProviderHttpHelpers.SendAuthorizedAsync(
            HttpClient,
            authState.AccessToken,
            HttpMethod.Put,
            url,
            new StringContent(content, Encoding.UTF8, "application/json"),
            cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            throw new CloudSyncException(
                await CloudProviderHttpHelpers.ParseCloudErrorAsync(response, cancellationToken),
                (int)response.StatusCode);
        }

        using var payload = await CloudProviderHttpHelpers.ReadJsonDocumentAsync(response, cancellationToken);
        return CloudProviderHttpHelpers.GetString(payload.RootElement, "lastModifiedDateTime")
            ?? DateTimeOffset.UtcNow.ToString("O");
    }

    public override async Task<(string Content, string? ModifiedAt)> RestoreBackupAsync(
        CloudAuthState authState,
        string backupFolderName,
        string fileName,
        CancellationToken cancellationToken)
    {
        await EnsureBackupFolderAsync(authState, backupFolderName, cancellationToken);
        var folderName = Uri.EscapeDataString(backupFolderName);
        var escapedFileName = Uri.EscapeDataString(fileName);
        var metadataUrl = $"{MicrosoftGraphApiBase}/me/drive/root:/{folderName}/{escapedFileName}?$select=lastModifiedDateTime";

        using var metadataResponse = await CloudProviderHttpHelpers.SendAuthorizedAsync(
            HttpClient,
            authState.AccessToken,
            HttpMethod.Get,
            metadataUrl,
            null,
            cancellationToken);
        if (!metadataResponse.IsSuccessStatusCode)
        {
            throw new CloudSyncException(
                await CloudProviderHttpHelpers.ParseCloudErrorAsync(metadataResponse, cancellationToken),
                (int)metadataResponse.StatusCode);
        }

        using var metadata = await CloudProviderHttpHelpers.ReadJsonDocumentAsync(metadataResponse, cancellationToken);
        var modifiedAt = CloudProviderHttpHelpers.GetString(metadata.RootElement, "lastModifiedDateTime");

        var contentUrl = $"{MicrosoftGraphApiBase}/me/drive/root:/{folderName}/{escapedFileName}:/content";
        using var contentResponse = await CloudProviderHttpHelpers.SendAuthorizedAsync(
            HttpClient,
            authState.AccessToken,
            HttpMethod.Get,
            contentUrl,
            null,
            cancellationToken);
        if (!contentResponse.IsSuccessStatusCode)
        {
            throw new CloudSyncException(
                await CloudProviderHttpHelpers.ParseCloudErrorAsync(contentResponse, cancellationToken),
                (int)contentResponse.StatusCode);
        }

        return (await contentResponse.Content.ReadAsStringAsync(cancellationToken), modifiedAt);
    }

    private async Task EnsureBackupFolderAsync(
        CloudAuthState authState,
        string backupFolderName,
        CancellationToken cancellationToken)
    {
        var folderName = Uri.EscapeDataString(backupFolderName);
        var folderUrl = $"{MicrosoftGraphApiBase}/me/drive/root:/{folderName}";

        using var response = await CloudProviderHttpHelpers.SendAuthorizedAsync(
            HttpClient,
            authState.AccessToken,
            HttpMethod.Get,
            folderUrl,
            null,
            cancellationToken);
        if (response.IsSuccessStatusCode)
        {
            return;
        }

        if (response.StatusCode != HttpStatusCode.NotFound)
        {
            throw new CloudSyncException(
                await CloudProviderHttpHelpers.ParseCloudErrorAsync(response, cancellationToken),
                (int)response.StatusCode);
        }

        var payload = JsonSerializer.Serialize(new Dictionary<string, object?>
        {
            ["name"] = backupFolderName,
            ["folder"] = new Dictionary<string, object?>(),
            ["@microsoft.graph.conflictBehavior"] = "replace",
        });

        using var createResponse = await CloudProviderHttpHelpers.SendAuthorizedAsync(
            HttpClient,
            authState.AccessToken,
            HttpMethod.Post,
            $"{MicrosoftGraphApiBase}/me/drive/root/children",
            new StringContent(payload, Encoding.UTF8, "application/json"),
            cancellationToken);
        if (!createResponse.IsSuccessStatusCode)
        {
            throw new CloudSyncException(
                await CloudProviderHttpHelpers.ParseCloudErrorAsync(createResponse, cancellationToken),
                (int)createResponse.StatusCode);
        }
    }
}
