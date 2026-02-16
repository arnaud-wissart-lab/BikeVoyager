using Microsoft.AspNetCore.Http.Extensions;
using Microsoft.Extensions.Options;
using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace BikeVoyager.Api.Cloud.Providers;

internal sealed class GoogleDriveCloudProviderClient(
    HttpClient httpClient,
    IOptions<CloudSyncOptions> options)
    : CloudProviderClientBase(httpClient, options)
{
    private const string GoogleAuthorizeUrl = "https://accounts.google.com/o/oauth2/v2/auth";
    private const string GoogleTokenUrl = "https://oauth2.googleapis.com/token";
    private const string GoogleUserInfoUrl = "https://www.googleapis.com/oauth2/v3/userinfo";
    private const string GoogleDriveApiBase = "https://www.googleapis.com/drive/v3";
    private const string GoogleDriveUploadBase = "https://www.googleapis.com/upload/drive/v3";

    public override CloudProviderKind Provider => CloudProviderKind.GoogleDrive;

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
            ["access_type"] = "offline",
            ["include_granted_scopes"] = "true",
            ["prompt"] = "consent",
        };

        return $"{GoogleAuthorizeUrl}{QueryString.Create(query)}";
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
            GoogleTokenUrl,
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
        };
        if (!string.IsNullOrWhiteSpace(clientSecret))
        {
            payload["client_secret"] = clientSecret;
        }

        using var response = await HttpClient.PostAsync(
            GoogleTokenUrl,
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
            GoogleUserInfoUrl,
            null,
            cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            return (null, null);
        }

        using var document = await CloudProviderHttpHelpers.ReadJsonDocumentAsync(response, cancellationToken);
        var root = document.RootElement;
        return (
            CloudProviderHttpHelpers.GetString(root, "email"),
            CloudProviderHttpHelpers.GetString(root, "name"));
    }

    public override async Task<string> UploadBackupAsync(
        CloudAuthState authState,
        string backupFolderName,
        string fileName,
        string content,
        CancellationToken cancellationToken)
    {
        var folderId = await EnsureBackupFolderIdAsync(authState, backupFolderName, cancellationToken);
        var existing = await FindBackupFileAsync(authState, folderId, fileName, cancellationToken);

        if (!string.IsNullOrWhiteSpace(existing?.Id))
        {
            using var response = await CloudProviderHttpHelpers.SendAuthorizedAsync(
                HttpClient,
                authState.AccessToken,
                HttpMethod.Patch,
                $"{GoogleDriveUploadBase}/files/{existing.Id}?uploadType=media&fields=id,modifiedTime",
                new StringContent(content, Encoding.UTF8, "application/json"),
                cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                throw new CloudSyncException(
                    await CloudProviderHttpHelpers.ParseCloudErrorAsync(response, cancellationToken),
                    (int)response.StatusCode);
            }

            using var payload = await CloudProviderHttpHelpers.ReadJsonDocumentAsync(response, cancellationToken);
            return CloudProviderHttpHelpers.GetString(payload.RootElement, "modifiedTime")
                ?? DateTimeOffset.UtcNow.ToString("O");
        }

        var boundary = $"bikevoyager-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";
        var metadata = JsonSerializer.Serialize(new
        {
            name = fileName,
            parents = new[] { folderId },
            mimeType = "application/json",
        });
        var multipartBody = string.Join("\r\n", new[]
        {
            $"--{boundary}",
            "Content-Type: application/json; charset=UTF-8",
            string.Empty,
            metadata,
            $"--{boundary}",
            "Content-Type: application/json",
            string.Empty,
            content,
            $"--{boundary}--",
            string.Empty,
        });

        var multipartContent = new StringContent(multipartBody, Encoding.UTF8);
        multipartContent.Headers.ContentType = MediaTypeHeaderValue.Parse(
            $"multipart/related; boundary={boundary}");

        using var createResponse = await CloudProviderHttpHelpers.SendAuthorizedAsync(
            HttpClient,
            authState.AccessToken,
            HttpMethod.Post,
            $"{GoogleDriveUploadBase}/files?uploadType=multipart&fields=id,modifiedTime",
            multipartContent,
            cancellationToken);
        if (!createResponse.IsSuccessStatusCode)
        {
            throw new CloudSyncException(
                await CloudProviderHttpHelpers.ParseCloudErrorAsync(createResponse, cancellationToken),
                (int)createResponse.StatusCode);
        }

        using var createPayload = await CloudProviderHttpHelpers.ReadJsonDocumentAsync(createResponse, cancellationToken);
        return CloudProviderHttpHelpers.GetString(createPayload.RootElement, "modifiedTime")
            ?? DateTimeOffset.UtcNow.ToString("O");
    }

    public override async Task<(string Content, string? ModifiedAt)> RestoreBackupAsync(
        CloudAuthState authState,
        string backupFolderName,
        string fileName,
        CancellationToken cancellationToken)
    {
        var folderId = await EnsureBackupFolderIdAsync(authState, backupFolderName, cancellationToken);
        var file = await FindBackupFileAsync(authState, folderId, fileName, cancellationToken);
        if (file is null || string.IsNullOrWhiteSpace(file.Id))
        {
            throw new CloudSyncException("Sauvegarde cloud introuvable.", StatusCodes.Status404NotFound);
        }

        using var contentResponse = await CloudProviderHttpHelpers.SendAuthorizedAsync(
            HttpClient,
            authState.AccessToken,
            HttpMethod.Get,
            $"{GoogleDriveApiBase}/files/{file.Id}?alt=media",
            null,
            cancellationToken);
        if (!contentResponse.IsSuccessStatusCode)
        {
            throw new CloudSyncException(
                await CloudProviderHttpHelpers.ParseCloudErrorAsync(contentResponse, cancellationToken),
                (int)contentResponse.StatusCode);
        }

        return (await contentResponse.Content.ReadAsStringAsync(cancellationToken), file.ModifiedTime);
    }

    private async Task<string> EnsureBackupFolderIdAsync(
        CloudAuthState authState,
        string backupFolderName,
        CancellationToken cancellationToken)
    {
        var query = string.Join(" and ", new[]
        {
            $"name='{CloudProviderHttpHelpers.EscapeGoogleQuery(backupFolderName)}'",
            "mimeType='application/vnd.google-apps.folder'",
            "trashed=false",
        });
        var searchParams = new Dictionary<string, string?>
        {
            ["q"] = query,
            ["spaces"] = "drive",
            ["fields"] = "files(id,name)",
            ["pageSize"] = "1",
        };

        using var searchResponse = await CloudProviderHttpHelpers.SendAuthorizedAsync(
            HttpClient,
            authState.AccessToken,
            HttpMethod.Get,
            $"{GoogleDriveApiBase}/files{QueryString.Create(searchParams)}",
            null,
            cancellationToken);
        if (!searchResponse.IsSuccessStatusCode)
        {
            throw new CloudSyncException(
                await CloudProviderHttpHelpers.ParseCloudErrorAsync(searchResponse, cancellationToken),
                (int)searchResponse.StatusCode);
        }

        using var searchPayload = await CloudProviderHttpHelpers.ReadJsonDocumentAsync(searchResponse, cancellationToken);
        if (CloudProviderHttpHelpers.TryGetFirstArrayItem(searchPayload.RootElement, "files", out var firstFile))
        {
            var existingId = CloudProviderHttpHelpers.GetString(firstFile, "id");
            if (!string.IsNullOrWhiteSpace(existingId))
            {
                return existingId;
            }
        }

        var createPayload = JsonSerializer.Serialize(new
        {
            name = backupFolderName,
            mimeType = "application/vnd.google-apps.folder",
        });
        using var createResponse = await CloudProviderHttpHelpers.SendAuthorizedAsync(
            HttpClient,
            authState.AccessToken,
            HttpMethod.Post,
            $"{GoogleDriveApiBase}/files?fields=id",
            new StringContent(createPayload, Encoding.UTF8, "application/json"),
            cancellationToken);
        if (!createResponse.IsSuccessStatusCode)
        {
            throw new CloudSyncException(
                await CloudProviderHttpHelpers.ParseCloudErrorAsync(createResponse, cancellationToken),
                (int)createResponse.StatusCode);
        }

        using var createResult = await CloudProviderHttpHelpers.ReadJsonDocumentAsync(createResponse, cancellationToken);
        var folderId = CloudProviderHttpHelpers.GetString(createResult.RootElement, "id");
        if (string.IsNullOrWhiteSpace(folderId))
        {
            throw new CloudSyncException("Impossible de créer le dossier cloud.", (int)HttpStatusCode.BadGateway);
        }

        return folderId;
    }

    private async Task<GoogleDriveFile?> FindBackupFileAsync(
        CloudAuthState authState,
        string folderId,
        string fileName,
        CancellationToken cancellationToken)
    {
        var query = string.Join(" and ", new[]
        {
            $"'{CloudProviderHttpHelpers.EscapeGoogleQuery(folderId)}' in parents",
            $"name='{CloudProviderHttpHelpers.EscapeGoogleQuery(fileName)}'",
            "trashed=false",
        });
        var searchParams = new Dictionary<string, string?>
        {
            ["q"] = query,
            ["spaces"] = "drive",
            ["fields"] = "files(id,name,modifiedTime)",
            ["pageSize"] = "1",
        };

        using var response = await CloudProviderHttpHelpers.SendAuthorizedAsync(
            HttpClient,
            authState.AccessToken,
            HttpMethod.Get,
            $"{GoogleDriveApiBase}/files{QueryString.Create(searchParams)}",
            null,
            cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            throw new CloudSyncException(
                await CloudProviderHttpHelpers.ParseCloudErrorAsync(response, cancellationToken),
                (int)response.StatusCode);
        }

        using var payload = await CloudProviderHttpHelpers.ReadJsonDocumentAsync(response, cancellationToken);
        if (!CloudProviderHttpHelpers.TryGetFirstArrayItem(payload.RootElement, "files", out var firstFile))
        {
            return null;
        }

        var id = CloudProviderHttpHelpers.GetString(firstFile, "id");
        if (string.IsNullOrWhiteSpace(id))
        {
            return null;
        }

        return new GoogleDriveFile(id, CloudProviderHttpHelpers.GetString(firstFile, "modifiedTime"));
    }

    private sealed record GoogleDriveFile(string Id, string? ModifiedTime);
}
