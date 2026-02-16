using BikeVoyager.Api.Cloud.Providers;
using Microsoft.Extensions.Options;

namespace BikeVoyager.Api.Cloud;

public sealed class CloudSyncService(
    ICloudProviderClientResolver providerResolver,
    IOptions<CloudSyncOptions> options)
{
    public string BuildAuthorizationUrl(
        CloudProviderKind provider,
        CloudOAuthPendingState pendingState,
        string codeChallenge)
    {
        var providerClient = providerResolver.Resolve(provider);
        if (!providerClient.IsConfigured())
        {
            throw new CloudSyncException("Client ID cloud non configuré.");
        }

        return providerClient.BuildAuthorizationUrl(pendingState, codeChallenge);
    }

    public bool IsProviderConfigured(CloudProviderKind provider)
    {
        return providerResolver.Resolve(provider).IsConfigured();
    }

    public string GetBackupFolderName()
    {
        var folderName = options.Value.BackupFolderName?.Trim();
        return string.IsNullOrWhiteSpace(folderName) ? "BikeVoyager" : folderName;
    }

    public async Task<CloudTokenPayload> ExchangeAuthorizationCodeAsync(
        CloudOAuthPendingState pendingState,
        string code,
        CancellationToken cancellationToken)
    {
        var providerClient = providerResolver.Resolve(pendingState.Provider);
        if (!providerClient.IsConfigured())
        {
            throw new CloudSyncException("Client ID cloud non configuré.");
        }

        var token = await providerClient.ExchangeAuthorizationCodeAsync(
            pendingState,
            code,
            cancellationToken);
        if (string.IsNullOrWhiteSpace(token.AccessToken))
        {
            throw new CloudSyncException("Réponse OAuth cloud invalide.", StatusCodes.Status502BadGateway);
        }

        return token;
    }

    public async Task<CloudAuthState> BuildAuthStateAsync(
        CloudProviderKind provider,
        CloudTokenPayload token,
        CancellationToken cancellationToken)
    {
        var providerClient = providerResolver.Resolve(provider);
        var account = await providerClient.FetchAccountAsync(token.AccessToken, cancellationToken);
        var now = DateTimeOffset.UtcNow;
        var expiresAt = now.AddSeconds(Math.Max(0, token.ExpiresInSeconds));

        return new CloudAuthState(
            provider,
            token.AccessToken,
            token.RefreshToken,
            string.IsNullOrWhiteSpace(token.TokenType) ? "Bearer" : token.TokenType,
            string.IsNullOrWhiteSpace(token.Scope) ? null : token.Scope,
            expiresAt,
            account.Email,
            account.Name,
            now);
    }

    public async Task<(CloudAuthState AuthState, string ModifiedAt)> UploadBackupAsync(
        CloudAuthState authState,
        string fileName,
        string content,
        CancellationToken cancellationToken)
    {
        var validatedAuth = await EnsureValidTokenAsync(authState, cancellationToken);
        var providerClient = providerResolver.Resolve(validatedAuth.Provider);
        var modifiedAt = await providerClient.UploadBackupAsync(
            validatedAuth,
            GetBackupFolderName(),
            fileName,
            content,
            cancellationToken);

        return (validatedAuth, modifiedAt);
    }

    public async Task<(CloudAuthState AuthState, string Content, string? ModifiedAt)> RestoreBackupAsync(
        CloudAuthState authState,
        string fileName,
        CancellationToken cancellationToken)
    {
        var validatedAuth = await EnsureValidTokenAsync(authState, cancellationToken);
        var providerClient = providerResolver.Resolve(validatedAuth.Provider);
        var payload = await providerClient.RestoreBackupAsync(
            validatedAuth,
            GetBackupFolderName(),
            fileName,
            cancellationToken);

        return (validatedAuth, payload.Content, payload.ModifiedAt);
    }

    private async Task<CloudAuthState> EnsureValidTokenAsync(
        CloudAuthState authState,
        CancellationToken cancellationToken)
    {
        if (DateTimeOffset.UtcNow < authState.ExpiresAt.AddSeconds(-60))
        {
            return authState;
        }

        return await RefreshCloudTokenAsync(authState, cancellationToken);
    }

    private async Task<CloudAuthState> RefreshCloudTokenAsync(
        CloudAuthState authState,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(authState.RefreshToken))
        {
            throw new CloudSyncException(
                "Le token cloud ne peut pas être rafraîchi.",
                StatusCodes.Status401Unauthorized);
        }

        var providerClient = providerResolver.Resolve(authState.Provider);
        if (!providerClient.IsConfigured())
        {
            throw new CloudSyncException("Client ID cloud non configuré.");
        }

        var token = await providerClient.RefreshTokenAsync(authState, cancellationToken);
        var now = DateTimeOffset.UtcNow;
        return authState with
        {
            AccessToken = token.AccessToken,
            RefreshToken = string.IsNullOrWhiteSpace(token.RefreshToken)
                ? authState.RefreshToken
                : token.RefreshToken,
            TokenType = string.IsNullOrWhiteSpace(token.TokenType)
                ? authState.TokenType
                : token.TokenType,
            Scope = string.IsNullOrWhiteSpace(token.Scope) ? authState.Scope : token.Scope,
            ExpiresAt = now.AddSeconds(Math.Max(0, token.ExpiresInSeconds)),
        };
    }
}
