using Microsoft.Extensions.Options;

namespace BikeVoyager.Api.Cloud.Providers;

internal abstract class CloudProviderClientBase(
    HttpClient httpClient,
    IOptions<CloudSyncOptions> options)
    : ICloudProviderClient
{
    protected HttpClient HttpClient { get; } = httpClient;
    protected IOptions<CloudSyncOptions> Options { get; } = options;

    public abstract CloudProviderKind Provider { get; }

    public bool IsConfigured() => !string.IsNullOrWhiteSpace(GetClientId());

    protected string GetClientId()
    {
        var clientOptions = Provider == CloudProviderKind.GoogleDrive
            ? Options.Value.GoogleDrive
            : Options.Value.OneDrive;
        return clientOptions.ClientId?.Trim() ?? string.Empty;
    }

    protected string GetClientSecret()
    {
        var clientOptions = Provider == CloudProviderKind.GoogleDrive
            ? Options.Value.GoogleDrive
            : Options.Value.OneDrive;
        return clientOptions.ClientSecret?.Trim() ?? string.Empty;
    }

    protected static string BuildAuthScope(CloudProviderKind provider) =>
        provider == CloudProviderKind.GoogleDrive
            ? "openid email profile https://www.googleapis.com/auth/drive.file"
            : "offline_access Files.ReadWrite User.Read";

    public abstract string BuildAuthorizationUrl(CloudOAuthPendingState pendingState, string codeChallenge);

    public abstract Task<CloudTokenPayload> ExchangeAuthorizationCodeAsync(
        CloudOAuthPendingState pendingState,
        string code,
        CancellationToken cancellationToken);

    public abstract Task<CloudTokenPayload> RefreshTokenAsync(
        CloudAuthState authState,
        CancellationToken cancellationToken);

    public abstract Task<(string? Email, string? Name)> FetchAccountAsync(
        string accessToken,
        CancellationToken cancellationToken);

    public abstract Task<string> UploadBackupAsync(
        CloudAuthState authState,
        string backupFolderName,
        string fileName,
        string content,
        CancellationToken cancellationToken);

    public abstract Task<(string Content, string? ModifiedAt)> RestoreBackupAsync(
        CloudAuthState authState,
        string backupFolderName,
        string fileName,
        CancellationToken cancellationToken);
}
