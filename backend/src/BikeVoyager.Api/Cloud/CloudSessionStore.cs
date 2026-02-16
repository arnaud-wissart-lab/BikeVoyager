using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Caching.Memory;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace BikeVoyager.Api.Cloud;

public sealed class CloudSessionStore(
    IDistributedCache distributedCache,
    IMemoryCache localCache,
    ILogger<CloudSessionStore> logger)
    : ICloudSessionStore
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
