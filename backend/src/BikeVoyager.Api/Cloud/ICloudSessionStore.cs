namespace BikeVoyager.Api.Cloud;

public interface ICloudSessionStore
{
    string CreatePending(CloudOAuthPendingState pendingState);
    bool TryGetPending(string sessionId, out CloudOAuthPendingState pendingState);
    void RemovePending(string sessionId);
    string CreateAuth(CloudAuthState authState);
    void SetAuth(string sessionId, CloudAuthState authState);
    bool TryGetAuth(string sessionId, out CloudAuthState authState);
    void RemoveAuth(string sessionId);
    Task<CloudSessionCacheDiagnostics> ProbeDistributedCacheAsync(CancellationToken cancellationToken = default);
}
