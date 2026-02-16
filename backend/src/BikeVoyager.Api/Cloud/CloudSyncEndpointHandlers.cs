using BikeVoyager.Api.Cloud.OAuth;

namespace BikeVoyager.Api.Cloud;

public sealed class CloudSyncEndpointHandlers(
    ICloudSessionStore sessionStore,
    ICloudSessionCookies sessionCookies,
    ICloudOAuthFlowService oauthFlowService,
    ICloudOAuthRedirectPolicy redirectPolicy,
    CloudSyncService cloudSync,
    ILogger<CloudSyncEndpointHandlers> logger)
{
    private const int MaxBackupPayloadBytes = 5 * 1024 * 1024;

    public IResult GetProviders()
    {
        return Results.Ok(new
        {
            providers = new
            {
                onedrive = cloudSync.IsProviderConfigured(CloudProviderKind.OneDrive),
                googleDrive = cloudSync.IsProviderConfigured(CloudProviderKind.GoogleDrive),
            },
            backupFolderName = cloudSync.GetBackupFolderName(),
        });
    }

    public IResult GetSession(HttpContext httpContext)
    {
        if (!TryResolveAuthSession(httpContext, out _, out var authState))
        {
            return Results.Ok(new { connected = false });
        }

        return Results.Ok(new
        {
            connected = true,
            authState = CloudAuthStatePresenter.ToPublicAuthState(authState),
        });
    }

    public async Task<IResult> GetStatusAsync(HttpContext httpContext, CancellationToken cancellationToken)
    {
        var hasAuthSession = TryResolveAuthSession(httpContext, out _, out var authState);
        var cacheDiagnostics = await sessionStore.ProbeDistributedCacheAsync(cancellationToken);
        object session = hasAuthSession
            ? new
            {
                connected = true,
                authState = CloudAuthStatePresenter.ToPublicAuthState(authState),
            }
            : new
            {
                connected = false,
            };

        return Results.Ok(new
        {
            providers = new
            {
                onedrive = cloudSync.IsProviderConfigured(CloudProviderKind.OneDrive),
                googleDrive = cloudSync.IsProviderConfigured(CloudProviderKind.GoogleDrive),
            },
            session,
            cache = new
            {
                distributedCacheType = cacheDiagnostics.DistributedCacheType,
                healthy = cacheDiagnostics.Healthy,
                message = cacheDiagnostics.Message,
                fallback = "memory-cache",
            },
            serverTimeUtc = DateTimeOffset.UtcNow.ToString("O"),
        });
    }

    public IResult StartOAuth(
        string? provider,
        string? redirectUri,
        string? returnHash,
        HttpContext httpContext)
    {
        if (!CloudProviderCodec.TryParse(provider, out var parsedProvider))
        {
            return Results.BadRequest(new { message = "Cloud provider invalide." });
        }

        if (!cloudSync.IsProviderConfigured(parsedProvider))
        {
            return Results.BadRequest(new { message = "Client ID cloud non configuré." });
        }

        var resolvedRedirectUri = redirectPolicy.ResolveRedirectUri(httpContext, redirectUri);
        if (!redirectPolicy.IsRedirectUriAllowed(httpContext, resolvedRedirectUri))
        {
            return Results.BadRequest(new { message = "Redirect URI invalide." });
        }

        var startPayload = oauthFlowService.CreateStartPayload(parsedProvider, resolvedRedirectUri, returnHash);
        var pendingSessionId = sessionStore.CreatePending(startPayload.PendingState);
        sessionCookies.SetPendingSessionId(httpContext, pendingSessionId);
        var authorizationUrl = cloudSync.BuildAuthorizationUrl(
            parsedProvider,
            startPayload.PendingState,
            startPayload.CodeChallenge);

        return Results.Ok(new { authorizationUrl });
    }

    public async Task<IResult> HandleOAuthCallbackAsync(
        CloudOAuthCallbackRequest payload,
        HttpContext httpContext,
        CancellationToken cancellationToken)
    {
        if (!TryResolvePendingState(httpContext, out var pendingSessionId, out var pendingState))
        {
            return Results.BadRequest(new { message = "Requête OAuth cloud absente ou expirée." });
        }

        var validation = oauthFlowService.ValidateCallback(pendingState, payload);
        if (!validation.IsValid)
        {
            sessionStore.RemovePending(pendingSessionId);
            sessionCookies.DeletePendingSessionId(httpContext);
            return Results.BadRequest(new { message = validation.ErrorMessage });
        }

        try
        {
            var token = await cloudSync.ExchangeAuthorizationCodeAsync(
                pendingState,
                validation.Code!,
                cancellationToken);
            var authState = await cloudSync.BuildAuthStateAsync(
                pendingState.Provider,
                token,
                cancellationToken);

            if (!sessionCookies.TryGetAuthSessionId(httpContext, out var existingAuthSessionId))
            {
                existingAuthSessionId = sessionStore.CreateAuth(authState);
            }
            else
            {
                sessionStore.SetAuth(existingAuthSessionId, authState);
            }

            sessionCookies.SetAuthSessionId(httpContext, existingAuthSessionId);
            sessionStore.RemovePending(pendingSessionId);
            sessionCookies.DeletePendingSessionId(httpContext);

            return Results.Ok(new
            {
                authState = CloudAuthStatePresenter.ToPublicAuthState(authState),
                returnHash = pendingState.ReturnHash,
            });
        }
        catch (CloudSyncException ex)
        {
            logger.LogWarning(ex, "OAuth cloud callback failed");
            sessionStore.RemovePending(pendingSessionId);
            sessionCookies.DeletePendingSessionId(httpContext);
            return Results.Json(new { message = ex.Message }, statusCode: ex.StatusCode);
        }
    }

    public IResult Disconnect(HttpContext httpContext)
    {
        if (sessionCookies.TryGetAuthSessionId(httpContext, out var authSessionId))
        {
            sessionStore.RemoveAuth(authSessionId);
        }

        if (sessionCookies.TryGetPendingSessionId(httpContext, out var pendingSessionId))
        {
            sessionStore.RemovePending(pendingSessionId);
        }

        sessionCookies.DeleteAuthSessionId(httpContext);
        sessionCookies.DeletePendingSessionId(httpContext);

        return Results.Ok(new { disconnected = true });
    }

    public async Task<IResult> UploadBackupAsync(
        CloudUploadRequest payload,
        HttpContext httpContext,
        CancellationToken cancellationToken)
    {
        if (!TryResolveAuthSession(httpContext, out var authSessionId, out var authState))
        {
            return Results.Json(
                new { message = "Connexion cloud requise." },
                statusCode: StatusCodes.Status401Unauthorized);
        }

        string fileName;
        try
        {
            fileName = CloudBackupFileNameValidator.Normalize(payload.FileName);
        }
        catch (CloudSyncException ex)
        {
            return Results.Json(new { message = ex.Message }, statusCode: ex.StatusCode);
        }

        var content = payload.Content ?? string.Empty;
        if (System.Text.Encoding.UTF8.GetByteCount(content) > MaxBackupPayloadBytes)
        {
            return Results.BadRequest(new { message = "La sauvegarde dépasse la taille autorisée." });
        }

        try
        {
            var result = await cloudSync.UploadBackupAsync(
                authState,
                fileName,
                content,
                cancellationToken);
            sessionStore.SetAuth(authSessionId, result.AuthState);
            sessionCookies.SetAuthSessionId(httpContext, authSessionId);

            return Results.Ok(new
            {
                authState = CloudAuthStatePresenter.ToPublicAuthState(result.AuthState),
                modifiedAt = result.ModifiedAt,
            });
        }
        catch (CloudSyncException ex)
        {
            if (ex.StatusCode is StatusCodes.Status401Unauthorized or StatusCodes.Status403Forbidden)
            {
                sessionStore.RemoveAuth(authSessionId);
                sessionCookies.DeleteAuthSessionId(httpContext);
            }

            return Results.Json(new { message = ex.Message }, statusCode: ex.StatusCode);
        }
    }

    public async Task<IResult> RestoreBackupAsync(
        string? fileName,
        HttpContext httpContext,
        CancellationToken cancellationToken)
    {
        if (!TryResolveAuthSession(httpContext, out var authSessionId, out var authState))
        {
            return Results.Json(
                new { message = "Connexion cloud requise." },
                statusCode: StatusCodes.Status401Unauthorized);
        }

        string normalizedFileName;
        try
        {
            normalizedFileName = CloudBackupFileNameValidator.Normalize(fileName);
        }
        catch (CloudSyncException ex)
        {
            return Results.Json(new { message = ex.Message }, statusCode: ex.StatusCode);
        }

        try
        {
            var result = await cloudSync.RestoreBackupAsync(
                authState,
                normalizedFileName,
                cancellationToken);
            sessionStore.SetAuth(authSessionId, result.AuthState);
            sessionCookies.SetAuthSessionId(httpContext, authSessionId);

            return Results.Ok(new
            {
                authState = CloudAuthStatePresenter.ToPublicAuthState(result.AuthState),
                content = result.Content,
                modifiedAt = result.ModifiedAt,
            });
        }
        catch (CloudSyncException ex)
        {
            if (ex.StatusCode is StatusCodes.Status401Unauthorized or StatusCodes.Status403Forbidden)
            {
                sessionStore.RemoveAuth(authSessionId);
                sessionCookies.DeleteAuthSessionId(httpContext);
            }

            return Results.Json(new { message = ex.Message }, statusCode: ex.StatusCode);
        }
    }

    private bool TryResolvePendingState(
        HttpContext httpContext,
        out string pendingSessionId,
        out CloudOAuthPendingState pendingState)
    {
        pendingSessionId = string.Empty;
        pendingState = default!;

        if (!sessionCookies.TryGetPendingSessionId(httpContext, out var rawSessionId))
        {
            return false;
        }

        if (!sessionStore.TryGetPending(rawSessionId, out var resolvedState))
        {
            sessionCookies.DeletePendingSessionId(httpContext);
            return false;
        }

        pendingSessionId = rawSessionId;
        pendingState = resolvedState;
        return true;
    }

    private bool TryResolveAuthSession(
        HttpContext httpContext,
        out string authSessionId,
        out CloudAuthState authState)
    {
        authSessionId = string.Empty;
        authState = default!;

        if (!sessionCookies.TryGetAuthSessionId(httpContext, out var rawSessionId))
        {
            return false;
        }

        if (!sessionStore.TryGetAuth(rawSessionId, out var resolvedState))
        {
            sessionCookies.DeleteAuthSessionId(httpContext);
            return false;
        }

        authSessionId = rawSessionId;
        authState = resolvedState;
        return true;
    }
}
