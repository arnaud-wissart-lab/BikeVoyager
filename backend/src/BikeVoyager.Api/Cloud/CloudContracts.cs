namespace BikeVoyager.Api.Cloud;

public sealed record CloudOAuthCallbackRequest(
    string? Code,
    string? State,
    string? Error,
    string? ErrorDescription);

public sealed record CloudUploadRequest(
    string? FileName,
    string? Content);

public sealed record CloudOAuthPendingState(
    CloudProviderKind Provider,
    string State,
    string Verifier,
    string RedirectUri,
    string ReturnHash,
    DateTimeOffset CreatedAt);

public sealed record CloudTokenPayload(
    string AccessToken,
    string? RefreshToken,
    string TokenType,
    string? Scope,
    int ExpiresInSeconds);

public sealed record CloudAuthState(
    CloudProviderKind Provider,
    string AccessToken,
    string? RefreshToken,
    string TokenType,
    string? Scope,
    DateTimeOffset ExpiresAt,
    string? AccountEmail,
    string? AccountName,
    DateTimeOffset ConnectedAt);

public sealed record CloudSessionCacheDiagnostics(
    string DistributedCacheType,
    bool Healthy,
    string? Message);

public enum CloudProviderKind
{
    OneDrive,
    GoogleDrive,
}
