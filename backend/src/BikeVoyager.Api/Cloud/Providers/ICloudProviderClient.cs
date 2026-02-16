namespace BikeVoyager.Api.Cloud.Providers;

public interface ICloudProviderClient
{
    CloudProviderKind Provider { get; }
    bool IsConfigured();
    string BuildAuthorizationUrl(CloudOAuthPendingState pendingState, string codeChallenge);
    Task<CloudTokenPayload> ExchangeAuthorizationCodeAsync(
        CloudOAuthPendingState pendingState,
        string code,
        CancellationToken cancellationToken);
    Task<CloudTokenPayload> RefreshTokenAsync(
        CloudAuthState authState,
        CancellationToken cancellationToken);
    Task<(string? Email, string? Name)> FetchAccountAsync(
        string accessToken,
        CancellationToken cancellationToken);
    Task<string> UploadBackupAsync(
        CloudAuthState authState,
        string backupFolderName,
        string fileName,
        string content,
        CancellationToken cancellationToken);
    Task<(string Content, string? ModifiedAt)> RestoreBackupAsync(
        CloudAuthState authState,
        string backupFolderName,
        string fileName,
        CancellationToken cancellationToken);
}
