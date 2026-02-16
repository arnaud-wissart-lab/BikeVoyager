using System.Net;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.AspNetCore.Http.Extensions;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

namespace BikeVoyager.Api.Cloud;

public static class CloudSyncEndpoints
{
    private const string AuthSessionCookieName = "bv_cloud_auth_sid";
    private const string PendingSessionCookieName = "bv_cloud_pending_sid";
    private const int MaxBackupPayloadBytes = 5 * 1024 * 1024;
    private static readonly TimeSpan AuthSessionCookieLifetime = TimeSpan.FromDays(30);
    private static readonly TimeSpan PendingSessionCookieLifetime = TimeSpan.FromMinutes(10);

    public static IEndpointRouteBuilder MapCloudSyncEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/cloud");

        group.MapGet("/providers",
                (CloudSyncService cloudSync) => Results.Ok(new
                {
                    providers = new
                    {
                        onedrive = cloudSync.IsProviderConfigured(CloudProviderKind.OneDrive),
                        googleDrive = cloudSync.IsProviderConfigured(CloudProviderKind.GoogleDrive),
                    },
                    backupFolderName = cloudSync.GetBackupFolderName(),
                }))
            .WithName("CloudProviders");

        group.MapGet("/session",
                (HttpContext httpContext, CloudSessionStore sessionStore) =>
                {
                    if (!TryResolveAuthSession(httpContext, sessionStore, out _, out var authState))
                    {
                        return Results.Ok(new { connected = false });
                    }

                    return Results.Ok(new
                    {
                        connected = true,
                        authState = ToPublicAuthState(authState),
                    });
                })
            .WithName("CloudSession");

        group.MapGet("/status",
                async (HttpContext httpContext,
                    CloudSessionStore sessionStore,
                    CloudSyncService cloudSync,
                    CancellationToken cancellationToken) =>
                {
                    var hasAuthSession = TryResolveAuthSession(httpContext, sessionStore, out _, out var authState);
                    var cacheDiagnostics = await sessionStore.ProbeDistributedCacheAsync(cancellationToken);
                    object session = hasAuthSession
                        ? new
                        {
                            connected = true,
                            authState = ToPublicAuthState(authState),
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
                })
            .WithName("CloudStatus");

        group.MapGet("/oauth/start",
                (string? provider,
                    string? redirectUri,
                    string? returnHash,
                    HttpContext httpContext,
                    CloudSessionStore sessionStore,
                    CloudSyncService cloudSync) =>
                {
                    if (!TryParseProvider(provider, out var parsedProvider))
                    {
                        return Results.BadRequest(new { message = "Cloud provider invalide." });
                    }

                    if (!cloudSync.IsProviderConfigured(parsedProvider))
                    {
                        return Results.BadRequest(new { message = "Client ID cloud non configuré." });
                    }

                    var resolvedRedirectUri = ResolveRedirectUri(httpContext, redirectUri);
                    if (!IsRedirectUriAllowed(httpContext, resolvedRedirectUri))
                    {
                        return Results.BadRequest(new { message = "Redirect URI invalide." });
                    }

                    var normalizedReturnHash = NormalizeReturnHash(returnHash);
                    var state = CreateRandomBase64Url(24);
                    var verifier = CreateRandomBase64Url(64);
                    var pendingState = new CloudOAuthPendingState(
                        parsedProvider,
                        state,
                        verifier,
                        resolvedRedirectUri,
                        normalizedReturnHash,
                        DateTimeOffset.UtcNow);

                    var pendingSessionId = sessionStore.CreatePending(pendingState);
                    SetCookie(httpContext, PendingSessionCookieName, pendingSessionId, PendingSessionCookieLifetime);
                    var authorizationUrl = cloudSync.BuildAuthorizationUrl(
                        parsedProvider,
                        pendingState,
                        BuildCodeChallenge(verifier));

                    return Results.Ok(new { authorizationUrl });
                })
            .WithName("CloudOAuthStart");

        group.MapPost("/oauth/callback",
                async (CloudOAuthCallbackRequest payload,
                    HttpContext httpContext,
                    CloudSessionStore sessionStore,
                    CloudSyncService cloudSync,
                    ILoggerFactory loggerFactory,
                    CancellationToken cancellationToken) =>
                {
                    var logger = loggerFactory.CreateLogger("CloudOAuthCallback");
                    if (!TryResolvePendingState(httpContext, sessionStore, out var pendingSessionId, out var pendingState))
                    {
                        return Results.BadRequest(new { message = "Requête OAuth cloud absente ou expirée." });
                    }

                    if (!string.IsNullOrWhiteSpace(payload.Error))
                    {
                        sessionStore.RemovePending(pendingSessionId);
                        DeleteCookie(httpContext, PendingSessionCookieName);
                        return Results.BadRequest(new
                        {
                            message = string.IsNullOrWhiteSpace(payload.ErrorDescription)
                                ? payload.Error.Trim()
                                : payload.ErrorDescription.Trim(),
                        });
                    }

                    if (string.IsNullOrWhiteSpace(payload.Code))
                    {
                        sessionStore.RemovePending(pendingSessionId);
                        DeleteCookie(httpContext, PendingSessionCookieName);
                        return Results.BadRequest(new { message = "Code OAuth manquant." });
                    }

                    if (string.IsNullOrWhiteSpace(payload.State) ||
                        !FixedTimeEquals(payload.State.Trim(), pendingState.State))
                    {
                        sessionStore.RemovePending(pendingSessionId);
                        DeleteCookie(httpContext, PendingSessionCookieName);
                        return Results.BadRequest(new { message = "État OAuth cloud invalide." });
                    }

                    try
                    {
                        var token = await cloudSync.ExchangeAuthorizationCodeAsync(
                            pendingState,
                            payload.Code.Trim(),
                            cancellationToken);
                        var authState = await cloudSync.BuildAuthStateAsync(
                            pendingState.Provider,
                            token,
                            cancellationToken);

                        if (!TryGetCookieValue(httpContext, AuthSessionCookieName, out var existingAuthSessionId))
                        {
                            existingAuthSessionId = sessionStore.CreateAuth(authState);
                        }
                        else
                        {
                            sessionStore.SetAuth(existingAuthSessionId, authState);
                        }

                        SetCookie(httpContext, AuthSessionCookieName, existingAuthSessionId, AuthSessionCookieLifetime);
                        sessionStore.RemovePending(pendingSessionId);
                        DeleteCookie(httpContext, PendingSessionCookieName);

                        return Results.Ok(new
                        {
                            authState = ToPublicAuthState(authState),
                            returnHash = pendingState.ReturnHash,
                        });
                    }
                    catch (CloudSyncException ex)
                    {
                        logger.LogWarning(ex, "OAuth cloud callback failed");
                        sessionStore.RemovePending(pendingSessionId);
                        DeleteCookie(httpContext, PendingSessionCookieName);
                        return Results.Json(new { message = ex.Message }, statusCode: ex.StatusCode);
                    }
                })
            .WithName("CloudOAuthCallback");

        group.MapPost("/disconnect",
                (HttpContext httpContext, CloudSessionStore sessionStore) =>
                {
                    if (TryGetCookieValue(httpContext, AuthSessionCookieName, out var authSessionId))
                    {
                        sessionStore.RemoveAuth(authSessionId);
                    }

                    if (TryGetCookieValue(httpContext, PendingSessionCookieName, out var pendingSessionId))
                    {
                        sessionStore.RemovePending(pendingSessionId);
                    }

                    DeleteCookie(httpContext, AuthSessionCookieName);
                    DeleteCookie(httpContext, PendingSessionCookieName);

                    return Results.Ok(new { disconnected = true });
                })
            .WithName("CloudDisconnect");

        group.MapPost("/backup/upload",
                async (CloudUploadRequest payload,
                    HttpContext httpContext,
                    CloudSessionStore sessionStore,
                    CloudSyncService cloudSync,
                    CancellationToken cancellationToken) =>
                {
                    if (!TryResolveAuthSession(httpContext, sessionStore, out var authSessionId, out var authState))
                    {
                        return Results.Json(
                            new { message = "Connexion cloud requise." },
                            statusCode: StatusCodes.Status401Unauthorized);
                    }

                    string fileName;
                    try
                    {
                        fileName = NormalizeBackupFileName(payload.FileName);
                    }
                    catch (CloudSyncException ex)
                    {
                        return Results.Json(new { message = ex.Message }, statusCode: ex.StatusCode);
                    }

                    var content = payload.Content ?? string.Empty;
                    if (Encoding.UTF8.GetByteCount(content) > MaxBackupPayloadBytes)
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
                        SetCookie(httpContext, AuthSessionCookieName, authSessionId, AuthSessionCookieLifetime);

                        return Results.Ok(new
                        {
                            authState = ToPublicAuthState(result.AuthState),
                            modifiedAt = result.ModifiedAt,
                        });
                    }
                    catch (CloudSyncException ex)
                    {
                        if (ex.StatusCode is StatusCodes.Status401Unauthorized or StatusCodes.Status403Forbidden)
                        {
                            sessionStore.RemoveAuth(authSessionId);
                            DeleteCookie(httpContext, AuthSessionCookieName);
                        }

                        return Results.Json(new { message = ex.Message }, statusCode: ex.StatusCode);
                    }
                })
            .WithName("CloudUploadBackup");

        group.MapGet("/backup/restore",
                async (string? fileName,
                    HttpContext httpContext,
                    CloudSessionStore sessionStore,
                    CloudSyncService cloudSync,
                    CancellationToken cancellationToken) =>
                {
                    if (!TryResolveAuthSession(httpContext, sessionStore, out var authSessionId, out var authState))
                    {
                        return Results.Json(
                            new { message = "Connexion cloud requise." },
                            statusCode: StatusCodes.Status401Unauthorized);
                    }

                    string normalizedFileName;
                    try
                    {
                        normalizedFileName = NormalizeBackupFileName(fileName);
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
                        SetCookie(httpContext, AuthSessionCookieName, authSessionId, AuthSessionCookieLifetime);

                        return Results.Ok(new
                        {
                            authState = ToPublicAuthState(result.AuthState),
                            content = result.Content,
                            modifiedAt = result.ModifiedAt,
                        });
                    }
                    catch (CloudSyncException ex)
                    {
                        if (ex.StatusCode is StatusCodes.Status401Unauthorized or StatusCodes.Status403Forbidden)
                        {
                            sessionStore.RemoveAuth(authSessionId);
                            DeleteCookie(httpContext, AuthSessionCookieName);
                        }

                        return Results.Json(new { message = ex.Message }, statusCode: ex.StatusCode);
                    }
                })
            .WithName("CloudRestoreBackup");

        return endpoints;
    }

    private static bool TryResolvePendingState(
        HttpContext httpContext,
        CloudSessionStore sessionStore,
        out string pendingSessionId,
        out CloudOAuthPendingState pendingState)
    {
        pendingSessionId = string.Empty;
        pendingState = default!;

        if (!TryGetCookieValue(httpContext, PendingSessionCookieName, out var rawSessionId))
        {
            return false;
        }

        if (!sessionStore.TryGetPending(rawSessionId, out var resolvedState))
        {
            DeleteCookie(httpContext, PendingSessionCookieName);
            return false;
        }

        pendingSessionId = rawSessionId;
        pendingState = resolvedState;
        return true;
    }

    private static bool TryResolveAuthSession(
        HttpContext httpContext,
        CloudSessionStore sessionStore,
        out string authSessionId,
        out CloudAuthState authState)
    {
        authSessionId = string.Empty;
        authState = default!;

        if (!TryGetCookieValue(httpContext, AuthSessionCookieName, out var rawSessionId))
        {
            return false;
        }

        if (!sessionStore.TryGetAuth(rawSessionId, out var resolvedState))
        {
            DeleteCookie(httpContext, AuthSessionCookieName);
            return false;
        }

        authSessionId = rawSessionId;
        authState = resolvedState;
        return true;
    }

    private static object ToPublicAuthState(CloudAuthState authState) => new
    {
        provider = ToProviderValue(authState.Provider),
        accountEmail = authState.AccountEmail,
        accountName = authState.AccountName,
        connectedAt = authState.ConnectedAt.ToString("O"),
        expiresAt = authState.ExpiresAt.ToString("O"),
    };

    private static string ResolveRedirectUri(HttpContext httpContext, string? candidate)
    {
        if (!string.IsNullOrWhiteSpace(candidate))
        {
            return candidate.Trim();
        }

        var request = httpContext.Request;
        var baseUri = $"{request.Scheme}://{request.Host}";
        return $"{baseUri}/";
    }

    private static bool IsRedirectUriAllowed(HttpContext httpContext, string redirectUri)
    {
        if (!Uri.TryCreate(redirectUri, UriKind.Absolute, out var parsedRedirectUri))
        {
            return false;
        }

        if (parsedRedirectUri.Scheme is not ("https" or "http"))
        {
            return false;
        }

        var origin = httpContext.Request.Headers.Origin.ToString();
        if (!string.IsNullOrWhiteSpace(origin) &&
            Uri.TryCreate(origin, UriKind.Absolute, out var originUri))
        {
            return string.Equals(originUri.Scheme, parsedRedirectUri.Scheme, StringComparison.OrdinalIgnoreCase) &&
                   string.Equals(originUri.Host, parsedRedirectUri.Host, StringComparison.OrdinalIgnoreCase) &&
                   originUri.Port == parsedRedirectUri.Port;
        }

        return true;
    }

    private static string NormalizeReturnHash(string? returnHash)
    {
        if (string.IsNullOrWhiteSpace(returnHash))
        {
            return string.Empty;
        }

        var trimmed = returnHash.Trim();
        if (!trimmed.StartsWith('#'))
        {
            trimmed = $"#{trimmed}";
        }

        return trimmed.Length > 256 ? trimmed[..256] : trimmed;
    }

    private static string NormalizeBackupFileName(string? value)
    {
        var trimmed = (value ?? string.Empty).Trim();
        if (trimmed.Length == 0 || trimmed.Length > 120)
        {
            throw new CloudSyncException("Nom de fichier de sauvegarde invalide.");
        }

        if (trimmed.Contains('/') || trimmed.Contains('\\') || trimmed.Contains(".."))
        {
            throw new CloudSyncException("Nom de fichier de sauvegarde invalide.");
        }

        if (trimmed.IndexOfAny(Path.GetInvalidFileNameChars()) >= 0)
        {
            throw new CloudSyncException("Nom de fichier de sauvegarde invalide.");
        }

        return trimmed;
    }

    private static bool TryGetCookieValue(
        HttpContext httpContext,
        string cookieName,
        out string value)
    {
        value = string.Empty;
        if (!httpContext.Request.Cookies.TryGetValue(cookieName, out var rawValue))
        {
            return false;
        }

        var trimmed = rawValue?.Trim();
        if (string.IsNullOrWhiteSpace(trimmed))
        {
            return false;
        }

        value = trimmed;
        return true;
    }

    private static void SetCookie(
        HttpContext httpContext,
        string cookieName,
        string value,
        TimeSpan lifetime)
    {
        httpContext.Response.Cookies.Append(cookieName, value, new CookieOptions
        {
            HttpOnly = true,
            Secure = httpContext.Request.IsHttps,
            SameSite = SameSiteMode.Lax,
            IsEssential = true,
            Path = "/",
            Expires = DateTimeOffset.UtcNow.Add(lifetime),
        });
    }

    private static void DeleteCookie(HttpContext httpContext, string cookieName)
    {
        httpContext.Response.Cookies.Delete(cookieName, new CookieOptions
        {
            HttpOnly = true,
            Secure = httpContext.Request.IsHttps,
            SameSite = SameSiteMode.Lax,
            IsEssential = true,
            Path = "/",
        });
    }

    private static bool TryParseProvider(string? value, out CloudProviderKind provider)
    {
        provider = default;
        if (string.IsNullOrWhiteSpace(value))
        {
            return false;
        }

        var normalized = value.Trim().ToLowerInvariant();
        if (normalized == "onedrive")
        {
            provider = CloudProviderKind.OneDrive;
            return true;
        }

        if (normalized == "google-drive")
        {
            provider = CloudProviderKind.GoogleDrive;
            return true;
        }

        return false;
    }

    private static string ToProviderValue(CloudProviderKind provider) =>
        provider == CloudProviderKind.GoogleDrive ? "google-drive" : "onedrive";

    private static string BuildCodeChallenge(string verifier)
    {
        var verifierBytes = Encoding.UTF8.GetBytes(verifier);
        var digest = SHA256.HashData(verifierBytes);
        return ToBase64Url(digest);
    }

    private static string CreateRandomBase64Url(int size)
    {
        var bytes = RandomNumberGenerator.GetBytes(size);
        return ToBase64Url(bytes);
    }

    private static string ToBase64Url(ReadOnlySpan<byte> value) =>
        Convert.ToBase64String(value)
            .Replace('+', '-')
            .Replace('/', '_')
            .TrimEnd('=');

    private static bool FixedTimeEquals(string left, string right)
    {
        var leftBytes = Encoding.UTF8.GetBytes(left);
        var rightBytes = Encoding.UTF8.GetBytes(right);
        return leftBytes.Length == rightBytes.Length &&
               CryptographicOperations.FixedTimeEquals(leftBytes, rightBytes);
    }
}

public sealed class CloudSyncOptions
{
    public string BackupFolderName { get; set; } = "BikeVoyager";
    public CloudProviderClientOptions GoogleDrive { get; set; } = new();
    public CloudProviderClientOptions OneDrive { get; set; } = new();
}

public sealed class CloudProviderClientOptions
{
    public string ClientId { get; set; } = string.Empty;
    public string ClientSecret { get; set; } = string.Empty;
}

public sealed class CloudSessionStore(
    IDistributedCache distributedCache,
    IMemoryCache localCache,
    ILogger<CloudSessionStore> logger)
{
    private static readonly JsonSerializerOptions SessionSerializerOptions = new(JsonSerializerDefaults.Web);
    private static readonly TimeSpan PendingLifetime = TimeSpan.FromMinutes(10);
    private static readonly TimeSpan AuthSlidingLifetime = TimeSpan.FromHours(12);
    private static readonly TimeSpan AuthAbsoluteLifetime = TimeSpan.FromDays(30);
    private const string PendingPrefix = "cloud:pending";
    private const string AuthPrefix = "cloud:auth";

    public string CreatePending(CloudOAuthPendingState pendingState)
    {
        var sessionId = CreateSessionId();
        SetValue(
            BuildKey(PendingPrefix, sessionId),
            pendingState,
            new DistributedCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = PendingLifetime,
            },
            new MemoryCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = PendingLifetime,
            },
            "pending");

        return sessionId;
    }

    public bool TryGetPending(string sessionId, out CloudOAuthPendingState pendingState)
    {
        return TryGetValue(BuildKey(PendingPrefix, sessionId), out pendingState, "pending");
    }

    public void RemovePending(string sessionId) =>
        RemoveValue(BuildKey(PendingPrefix, sessionId), "pending");

    public string CreateAuth(CloudAuthState authState)
    {
        var sessionId = CreateSessionId();
        SetAuth(sessionId, authState);
        return sessionId;
    }

    public void SetAuth(string sessionId, CloudAuthState authState)
    {
        SetValue(
            BuildKey(AuthPrefix, sessionId),
            authState,
            new DistributedCacheEntryOptions
            {
                SlidingExpiration = AuthSlidingLifetime,
                AbsoluteExpirationRelativeToNow = AuthAbsoluteLifetime,
            },
            new MemoryCacheEntryOptions
            {
                SlidingExpiration = AuthSlidingLifetime,
                AbsoluteExpirationRelativeToNow = AuthAbsoluteLifetime,
            },
            "auth");
    }

    public bool TryGetAuth(string sessionId, out CloudAuthState authState)
    {
        return TryGetValue(BuildKey(AuthPrefix, sessionId), out authState, "auth");
    }

    public void RemoveAuth(string sessionId) =>
        RemoveValue(BuildKey(AuthPrefix, sessionId), "auth");

    public async Task<CloudSessionCacheDiagnostics> ProbeDistributedCacheAsync(
        CancellationToken cancellationToken = default)
    {
        var probeKey = BuildKey("cloud:diag", CreateSessionId());
        var probePayload = Encoding.UTF8.GetBytes("ok");

        try
        {
            await distributedCache.SetAsync(
                probeKey,
                probePayload,
                new DistributedCacheEntryOptions
                {
                    AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(1),
                },
                cancellationToken);
            var roundTripPayload = await distributedCache.GetAsync(probeKey, cancellationToken);
            if (roundTripPayload is { Length: > 0 })
            {
                return new CloudSessionCacheDiagnostics(
                    distributedCache.GetType().FullName ?? distributedCache.GetType().Name,
                    true,
                    null);
            }

            return new CloudSessionCacheDiagnostics(
                distributedCache.GetType().FullName ?? distributedCache.GetType().Name,
                false,
                "Probe distribuée vide.");
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Cloud session distributed cache probe failed.");
            return new CloudSessionCacheDiagnostics(
                distributedCache.GetType().FullName ?? distributedCache.GetType().Name,
                false,
                "Cache distribué indisponible. Repli mémoire locale actif.");
        }
        finally
        {
            try
            {
                await distributedCache.RemoveAsync(probeKey, cancellationToken);
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception ex)
            {
                logger.LogDebug(ex, "Cloud session distributed cache probe cleanup failed.");
            }
        }
    }

    private static string BuildKey(string prefix, string sessionId) =>
        $"{prefix}:{sessionId}";

    private static string CreateSessionId()
    {
        var bytes = RandomNumberGenerator.GetBytes(32);
        return Convert.ToBase64String(bytes)
            .Replace('+', '-')
            .Replace('/', '_')
            .TrimEnd('=');
    }

    private bool TryGetValue<T>(
        string key,
        out T value,
        string sessionKind)
    {
        try
        {
            var payload = distributedCache.Get(key);
            if (payload is { Length: > 0 })
            {
                var parsed = JsonSerializer.Deserialize<T>(payload, SessionSerializerOptions);
                if (parsed is not null)
                {
                    value = parsed;
                    localCache.Set(
                        key,
                        parsed,
                        new MemoryCacheEntryOptions
                        {
                            AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(30),
                        });
                    return true;
                }

                distributedCache.Remove(key);
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Cloud session {SessionKind} read failed from distributed cache.", sessionKind);
        }

        if (localCache.TryGetValue<T>(key, out var localValue) && localValue is not null)
        {
            value = localValue;
            return true;
        }

        value = default!;
        return false;
    }

    private void SetValue<T>(
        string key,
        T value,
        DistributedCacheEntryOptions distributedOptions,
        MemoryCacheEntryOptions localOptions,
        string sessionKind)
    {
        localCache.Set(key, value, localOptions);
        try
        {
            var payload = JsonSerializer.SerializeToUtf8Bytes(value, SessionSerializerOptions);
            distributedCache.Set(key, payload, distributedOptions);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Cloud session {SessionKind} write failed in distributed cache.", sessionKind);
        }
    }

    private void RemoveValue(string key, string sessionKind)
    {
        localCache.Remove(key);
        try
        {
            distributedCache.Remove(key);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Cloud session {SessionKind} remove failed in distributed cache.", sessionKind);
        }
    }
}

public sealed class CloudSyncService(
    HttpClient httpClient,
    IOptions<CloudSyncOptions> options)
{
    private const string GoogleAuthorizeUrl = "https://accounts.google.com/o/oauth2/v2/auth";
    private const string GoogleTokenUrl = "https://oauth2.googleapis.com/token";
    private const string GoogleUserInfoUrl = "https://www.googleapis.com/oauth2/v3/userinfo";
    private const string GoogleDriveApiBase = "https://www.googleapis.com/drive/v3";
    private const string GoogleDriveUploadBase = "https://www.googleapis.com/upload/drive/v3";
    private const string MicrosoftAuthorizeUrl = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
    private const string MicrosoftTokenUrl = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
    private const string MicrosoftGraphApiBase = "https://graph.microsoft.com/v1.0";

    public string BuildAuthorizationUrl(
        CloudProviderKind provider,
        CloudOAuthPendingState pendingState,
        string codeChallenge)
    {
        var clientId = GetClientId(provider);
        if (string.IsNullOrWhiteSpace(clientId))
        {
            throw new CloudSyncException("Client ID cloud non configuré.");
        }

        var query = new Dictionary<string, string?>
        {
            ["client_id"] = clientId,
            ["redirect_uri"] = pendingState.RedirectUri,
            ["response_type"] = "code",
            ["scope"] = BuildAuthScope(provider),
            ["state"] = pendingState.State,
            ["code_challenge"] = codeChallenge,
            ["code_challenge_method"] = "S256",
        };

        if (provider == CloudProviderKind.GoogleDrive)
        {
            query["access_type"] = "offline";
            query["include_granted_scopes"] = "true";
            query["prompt"] = "consent";
            return $"{GoogleAuthorizeUrl}{QueryString.Create(query)}";
        }

        query["prompt"] = "select_account";
        return $"{MicrosoftAuthorizeUrl}{QueryString.Create(query)}";
    }

    public bool IsProviderConfigured(CloudProviderKind provider) =>
        !string.IsNullOrWhiteSpace(GetClientId(provider));

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
        var clientId = GetClientId(pendingState.Provider);
        if (string.IsNullOrWhiteSpace(clientId))
        {
            throw new CloudSyncException("Client ID cloud non configuré.");
        }

        var clientSecret = GetClientSecret(pendingState.Provider);

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

        var tokenUrl = pendingState.Provider == CloudProviderKind.GoogleDrive
            ? GoogleTokenUrl
            : MicrosoftTokenUrl;
        using var response = await httpClient.PostAsync(
            tokenUrl,
            new FormUrlEncodedContent(payload),
            cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            throw new CloudSyncException(
                await ParseCloudErrorAsync(response, cancellationToken),
                (int)HttpStatusCode.BadGateway);
        }

        var token = await ParseTokenPayloadAsync(response, cancellationToken);
        if (string.IsNullOrWhiteSpace(token.AccessToken))
        {
            throw new CloudSyncException("Réponse OAuth cloud invalide.", (int)HttpStatusCode.BadGateway);
        }

        return token;
    }

    public async Task<CloudAuthState> BuildAuthStateAsync(
        CloudProviderKind provider,
        CloudTokenPayload token,
        CancellationToken cancellationToken)
    {
        var account = provider == CloudProviderKind.GoogleDrive
            ? await FetchGoogleAccountAsync(token.AccessToken, cancellationToken)
            : await FetchMicrosoftAccountAsync(token.AccessToken, cancellationToken);
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
        var modifiedAt = validatedAuth.Provider == CloudProviderKind.GoogleDrive
            ? await UploadGoogleBackupAsync(validatedAuth, fileName, content, cancellationToken)
            : await UploadOneDriveBackupAsync(validatedAuth, fileName, content, cancellationToken);

        return (validatedAuth, modifiedAt);
    }

    public async Task<(CloudAuthState AuthState, string Content, string? ModifiedAt)> RestoreBackupAsync(
        CloudAuthState authState,
        string fileName,
        CancellationToken cancellationToken)
    {
        var validatedAuth = await EnsureValidTokenAsync(authState, cancellationToken);
        var payload = validatedAuth.Provider == CloudProviderKind.GoogleDrive
            ? await DownloadGoogleBackupAsync(validatedAuth, fileName, cancellationToken)
            : await DownloadOneDriveBackupAsync(validatedAuth, fileName, cancellationToken);

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
            throw new CloudSyncException("Le token cloud ne peut pas être rafraîchi.", StatusCodes.Status401Unauthorized);
        }

        var clientId = GetClientId(authState.Provider);
        if (string.IsNullOrWhiteSpace(clientId))
        {
            throw new CloudSyncException("Client ID cloud non configuré.");
        }

        var clientSecret = GetClientSecret(authState.Provider);

        var payload = new Dictionary<string, string>
        {
            ["client_id"] = clientId,
            ["grant_type"] = "refresh_token",
            ["refresh_token"] = authState.RefreshToken,
        };
        if (!string.IsNullOrWhiteSpace(clientSecret))
        {
            payload["client_secret"] = clientSecret;
        }
        if (authState.Provider == CloudProviderKind.OneDrive)
        {
            payload["scope"] = BuildAuthScope(authState.Provider);
        }

        var tokenUrl = authState.Provider == CloudProviderKind.GoogleDrive
            ? GoogleTokenUrl
            : MicrosoftTokenUrl;
        using var response = await httpClient.PostAsync(
            tokenUrl,
            new FormUrlEncodedContent(payload),
            cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            throw new CloudSyncException(
                await ParseCloudErrorAsync(response, cancellationToken),
                StatusCodes.Status401Unauthorized);
        }

        var token = await ParseTokenPayloadAsync(response, cancellationToken);
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

    private async Task<(string? Email, string? Name)> FetchGoogleAccountAsync(
        string accessToken,
        CancellationToken cancellationToken)
    {
        using var response = await SendAuthorizedAsync(
            accessToken,
            HttpMethod.Get,
            GoogleUserInfoUrl,
            null,
            cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            return (null, null);
        }

        using var document = await ReadJsonDocumentAsync(response, cancellationToken);
        var root = document.RootElement;
        return (GetString(root, "email"), GetString(root, "name"));
    }

    private async Task<(string? Email, string? Name)> FetchMicrosoftAccountAsync(
        string accessToken,
        CancellationToken cancellationToken)
    {
        using var response = await SendAuthorizedAsync(
            accessToken,
            HttpMethod.Get,
            $"{MicrosoftGraphApiBase}/me?$select=displayName,userPrincipalName,mail",
            null,
            cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            return (null, null);
        }

        using var document = await ReadJsonDocumentAsync(response, cancellationToken);
        var root = document.RootElement;
        var email = GetString(root, "mail") ?? GetString(root, "userPrincipalName");
        return (email, GetString(root, "displayName"));
    }

    private async Task<string> UploadGoogleBackupAsync(
        CloudAuthState authState,
        string fileName,
        string content,
        CancellationToken cancellationToken)
    {
        var folderId = await EnsureGoogleBackupFolderIdAsync(authState, cancellationToken);
        var existing = await FindGoogleBackupFileAsync(authState, folderId, fileName, cancellationToken);

        if (!string.IsNullOrWhiteSpace(existing?.Id))
        {
            using var response = await SendAuthorizedAsync(
                authState.AccessToken,
                HttpMethod.Patch,
                $"{GoogleDriveUploadBase}/files/{existing.Id}?uploadType=media&fields=id,modifiedTime",
                new StringContent(content, Encoding.UTF8, "application/json"),
                cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                throw new CloudSyncException(
                    await ParseCloudErrorAsync(response, cancellationToken),
                    (int)response.StatusCode);
            }

            using var payload = await ReadJsonDocumentAsync(response, cancellationToken);
            return GetString(payload.RootElement, "modifiedTime") ?? DateTimeOffset.UtcNow.ToString("O");
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

        using var createResponse = await SendAuthorizedAsync(
            authState.AccessToken,
            HttpMethod.Post,
            $"{GoogleDriveUploadBase}/files?uploadType=multipart&fields=id,modifiedTime",
            multipartContent,
            cancellationToken);
        if (!createResponse.IsSuccessStatusCode)
        {
            throw new CloudSyncException(
                await ParseCloudErrorAsync(createResponse, cancellationToken),
                (int)createResponse.StatusCode);
        }

        using var createPayload = await ReadJsonDocumentAsync(createResponse, cancellationToken);
        return GetString(createPayload.RootElement, "modifiedTime") ?? DateTimeOffset.UtcNow.ToString("O");
    }

    private async Task<(string Content, string? ModifiedAt)> DownloadGoogleBackupAsync(
        CloudAuthState authState,
        string fileName,
        CancellationToken cancellationToken)
    {
        var folderId = await EnsureGoogleBackupFolderIdAsync(authState, cancellationToken);
        var file = await FindGoogleBackupFileAsync(authState, folderId, fileName, cancellationToken);
        if (file is null || string.IsNullOrWhiteSpace(file.Id))
        {
            throw new CloudSyncException("Sauvegarde cloud introuvable.", StatusCodes.Status404NotFound);
        }

        using var contentResponse = await SendAuthorizedAsync(
            authState.AccessToken,
            HttpMethod.Get,
            $"{GoogleDriveApiBase}/files/{file.Id}?alt=media",
            null,
            cancellationToken);
        if (!contentResponse.IsSuccessStatusCode)
        {
            throw new CloudSyncException(
                await ParseCloudErrorAsync(contentResponse, cancellationToken),
                (int)contentResponse.StatusCode);
        }

        return (await contentResponse.Content.ReadAsStringAsync(cancellationToken), file.ModifiedTime);
    }

    private async Task<string> UploadOneDriveBackupAsync(
        CloudAuthState authState,
        string fileName,
        string content,
        CancellationToken cancellationToken)
    {
        await EnsureOneDriveBackupFolderAsync(authState, cancellationToken);
        var folderName = Uri.EscapeDataString(GetBackupFolderName());
        var escapedFileName = Uri.EscapeDataString(fileName);
        var url = $"{MicrosoftGraphApiBase}/me/drive/root:/{folderName}/{escapedFileName}:/content";

        using var response = await SendAuthorizedAsync(
            authState.AccessToken,
            HttpMethod.Put,
            url,
            new StringContent(content, Encoding.UTF8, "application/json"),
            cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            throw new CloudSyncException(
                await ParseCloudErrorAsync(response, cancellationToken),
                (int)response.StatusCode);
        }

        using var payload = await ReadJsonDocumentAsync(response, cancellationToken);
        return GetString(payload.RootElement, "lastModifiedDateTime") ?? DateTimeOffset.UtcNow.ToString("O");
    }

    private async Task<(string Content, string? ModifiedAt)> DownloadOneDriveBackupAsync(
        CloudAuthState authState,
        string fileName,
        CancellationToken cancellationToken)
    {
        await EnsureOneDriveBackupFolderAsync(authState, cancellationToken);
        var folderName = Uri.EscapeDataString(GetBackupFolderName());
        var escapedFileName = Uri.EscapeDataString(fileName);
        var metadataUrl = $"{MicrosoftGraphApiBase}/me/drive/root:/{folderName}/{escapedFileName}?$select=lastModifiedDateTime";

        using var metadataResponse = await SendAuthorizedAsync(
            authState.AccessToken,
            HttpMethod.Get,
            metadataUrl,
            null,
            cancellationToken);
        if (!metadataResponse.IsSuccessStatusCode)
        {
            throw new CloudSyncException(
                await ParseCloudErrorAsync(metadataResponse, cancellationToken),
                (int)metadataResponse.StatusCode);
        }

        using var metadata = await ReadJsonDocumentAsync(metadataResponse, cancellationToken);
        var modifiedAt = GetString(metadata.RootElement, "lastModifiedDateTime");

        var contentUrl = $"{MicrosoftGraphApiBase}/me/drive/root:/{folderName}/{escapedFileName}:/content";
        using var contentResponse = await SendAuthorizedAsync(
            authState.AccessToken,
            HttpMethod.Get,
            contentUrl,
            null,
            cancellationToken);
        if (!contentResponse.IsSuccessStatusCode)
        {
            throw new CloudSyncException(
                await ParseCloudErrorAsync(contentResponse, cancellationToken),
                (int)contentResponse.StatusCode);
        }

        return (await contentResponse.Content.ReadAsStringAsync(cancellationToken), modifiedAt);
    }

    private async Task EnsureOneDriveBackupFolderAsync(
        CloudAuthState authState,
        CancellationToken cancellationToken)
    {
        var folderName = Uri.EscapeDataString(GetBackupFolderName());
        var folderUrl = $"{MicrosoftGraphApiBase}/me/drive/root:/{folderName}";

        using var response = await SendAuthorizedAsync(
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
                await ParseCloudErrorAsync(response, cancellationToken),
                (int)response.StatusCode);
        }

        var payload = JsonSerializer.Serialize(new Dictionary<string, object?>
        {
            ["name"] = GetBackupFolderName(),
            ["folder"] = new Dictionary<string, object?>(),
            ["@microsoft.graph.conflictBehavior"] = "replace",
        });

        using var createResponse = await SendAuthorizedAsync(
            authState.AccessToken,
            HttpMethod.Post,
            $"{MicrosoftGraphApiBase}/me/drive/root/children",
            new StringContent(payload, Encoding.UTF8, "application/json"),
            cancellationToken);
        if (!createResponse.IsSuccessStatusCode)
        {
            throw new CloudSyncException(
                await ParseCloudErrorAsync(createResponse, cancellationToken),
                (int)createResponse.StatusCode);
        }
    }

    private async Task<string> EnsureGoogleBackupFolderIdAsync(
        CloudAuthState authState,
        CancellationToken cancellationToken)
    {
        var query = string.Join(" and ", new[]
        {
            $"name='{EscapeGoogleQuery(GetBackupFolderName())}'",
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

        using var searchResponse = await SendAuthorizedAsync(
            authState.AccessToken,
            HttpMethod.Get,
            $"{GoogleDriveApiBase}/files{QueryString.Create(searchParams)}",
            null,
            cancellationToken);
        if (!searchResponse.IsSuccessStatusCode)
        {
            throw new CloudSyncException(
                await ParseCloudErrorAsync(searchResponse, cancellationToken),
                (int)searchResponse.StatusCode);
        }

        using var searchPayload = await ReadJsonDocumentAsync(searchResponse, cancellationToken);
        if (TryGetFirstArrayItem(searchPayload.RootElement, "files", out var firstFile))
        {
            var existingId = GetString(firstFile, "id");
            if (!string.IsNullOrWhiteSpace(existingId))
            {
                return existingId;
            }
        }

        var createPayload = JsonSerializer.Serialize(new
        {
            name = GetBackupFolderName(),
            mimeType = "application/vnd.google-apps.folder",
        });
        using var createResponse = await SendAuthorizedAsync(
            authState.AccessToken,
            HttpMethod.Post,
            $"{GoogleDriveApiBase}/files?fields=id",
            new StringContent(createPayload, Encoding.UTF8, "application/json"),
            cancellationToken);
        if (!createResponse.IsSuccessStatusCode)
        {
            throw new CloudSyncException(
                await ParseCloudErrorAsync(createResponse, cancellationToken),
                (int)createResponse.StatusCode);
        }

        using var createResult = await ReadJsonDocumentAsync(createResponse, cancellationToken);
        var folderId = GetString(createResult.RootElement, "id");
        if (string.IsNullOrWhiteSpace(folderId))
        {
            throw new CloudSyncException("Impossible de créer le dossier cloud.", (int)HttpStatusCode.BadGateway);
        }

        return folderId;
    }

    private async Task<GoogleDriveFile?> FindGoogleBackupFileAsync(
        CloudAuthState authState,
        string folderId,
        string fileName,
        CancellationToken cancellationToken)
    {
        var query = string.Join(" and ", new[]
        {
            $"'{EscapeGoogleQuery(folderId)}' in parents",
            $"name='{EscapeGoogleQuery(fileName)}'",
            "trashed=false",
        });
        var searchParams = new Dictionary<string, string?>
        {
            ["q"] = query,
            ["spaces"] = "drive",
            ["fields"] = "files(id,name,modifiedTime)",
            ["pageSize"] = "1",
        };

        using var response = await SendAuthorizedAsync(
            authState.AccessToken,
            HttpMethod.Get,
            $"{GoogleDriveApiBase}/files{QueryString.Create(searchParams)}",
            null,
            cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            throw new CloudSyncException(
                await ParseCloudErrorAsync(response, cancellationToken),
                (int)response.StatusCode);
        }

        using var payload = await ReadJsonDocumentAsync(response, cancellationToken);
        if (!TryGetFirstArrayItem(payload.RootElement, "files", out var firstFile))
        {
            return null;
        }

        var id = GetString(firstFile, "id");
        if (string.IsNullOrWhiteSpace(id))
        {
            return null;
        }

        return new GoogleDriveFile(id, GetString(firstFile, "modifiedTime"));
    }

    private static async Task<string> ParseCloudErrorAsync(
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
            // ignore parse failures and use fallback
        }

        return raw.Length > 240 ? raw[..240] : raw;
    }

    private static async Task<CloudTokenPayload> ParseTokenPayloadAsync(
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

    private async Task<HttpResponseMessage> SendAuthorizedAsync(
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

    private string GetClientId(CloudProviderKind provider)
    {
        var clientId = provider == CloudProviderKind.GoogleDrive
            ? options.Value.GoogleDrive.ClientId
            : options.Value.OneDrive.ClientId;

        return clientId?.Trim() ?? string.Empty;
    }

    private string GetClientSecret(CloudProviderKind provider)
    {
        var clientSecret = provider == CloudProviderKind.GoogleDrive
            ? options.Value.GoogleDrive.ClientSecret
            : options.Value.OneDrive.ClientSecret;

        return clientSecret?.Trim() ?? string.Empty;
    }

    private static string BuildAuthScope(CloudProviderKind provider) =>
        provider == CloudProviderKind.GoogleDrive
            ? "openid email profile https://www.googleapis.com/auth/drive.file"
            : "offline_access Files.ReadWrite User.Read";

    private static string EscapeGoogleQuery(string value) =>
        value.Replace("\\", "\\\\", StringComparison.Ordinal)
            .Replace("'", "\\'", StringComparison.Ordinal);

    private static bool TryGetFirstArrayItem(
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

    private static string? GetString(JsonElement element, string propertyName)
    {
        if (!element.TryGetProperty(propertyName, out var property) ||
            property.ValueKind != JsonValueKind.String)
        {
            return null;
        }

        var value = property.GetString();
        return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }

    private static int? GetInt(JsonElement element, string propertyName)
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

    private static async Task<JsonDocument> ReadJsonDocumentAsync(
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

    private sealed record GoogleDriveFile(string Id, string? ModifiedTime);
}

public sealed class CloudSyncException(string message, int statusCode = StatusCodes.Status400BadRequest)
    : Exception(message)
{
    public int StatusCode { get; } = statusCode;
}

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
