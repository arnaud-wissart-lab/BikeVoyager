namespace BikeVoyager.Api.Cloud;

public static class CloudSyncEndpoints
{
    public static IEndpointRouteBuilder MapCloudSyncEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/cloud");

        group.MapGet("/providers",
                (CloudSyncEndpointHandlers handlers) => handlers.GetProviders())
            .WithName("CloudProviders");

        group.MapGet("/session",
                (HttpContext httpContext, CloudSyncEndpointHandlers handlers) =>
                    handlers.GetSession(httpContext))
            .WithName("CloudSession");

        group.MapGet("/status",
                (HttpContext httpContext, CloudSyncEndpointHandlers handlers, CancellationToken cancellationToken) =>
                    handlers.GetStatusAsync(httpContext, cancellationToken))
            .WithName("CloudStatus");

        group.MapGet("/oauth/start",
                (string? provider,
                    string? redirectUri,
                    string? returnHash,
                    HttpContext httpContext,
                    CloudSyncEndpointHandlers handlers) =>
                    handlers.StartOAuth(provider, redirectUri, returnHash, httpContext))
            .WithName("CloudOAuthStart");

        group.MapPost("/oauth/callback",
                (CloudOAuthCallbackRequest payload,
                    HttpContext httpContext,
                    CloudSyncEndpointHandlers handlers,
                    CancellationToken cancellationToken) =>
                    handlers.HandleOAuthCallbackAsync(payload, httpContext, cancellationToken))
            .WithName("CloudOAuthCallback");

        group.MapPost("/disconnect",
                (HttpContext httpContext, CloudSyncEndpointHandlers handlers) =>
                    handlers.Disconnect(httpContext))
            .WithName("CloudDisconnect");

        group.MapPost("/backup/upload",
                (CloudUploadRequest payload,
                    HttpContext httpContext,
                    CloudSyncEndpointHandlers handlers,
                    CancellationToken cancellationToken) =>
                    handlers.UploadBackupAsync(payload, httpContext, cancellationToken))
            .WithName("CloudUploadBackup");

        group.MapGet("/backup/restore",
                (string? fileName,
                    HttpContext httpContext,
                    CloudSyncEndpointHandlers handlers,
                    CancellationToken cancellationToken) =>
                    handlers.RestoreBackupAsync(fileName, httpContext, cancellationToken))
            .WithName("CloudRestoreBackup");

        return endpoints;
    }
}
