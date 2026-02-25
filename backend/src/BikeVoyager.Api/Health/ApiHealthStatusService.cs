using System.Reflection;
using BikeVoyager.Api.Valhalla;

namespace BikeVoyager.Api.Health;

internal sealed class ApiHealthStatusService
{
    public async Task<ApiHealthStatusResponse> BuildAsync(
        string? valhallaDataPath,
        string? valhallaBaseUrl,
        IValhallaProbeClient probeClient,
        CancellationToken cancellationToken)
    {
        var ready = ValhallaRuntime.IsReady(valhallaDataPath, out var notReadyReason);
        var buildProgress = ValhallaRuntime.ReadBuildProgress(valhallaDataPath, ready);
        var (serviceReachable, serviceError) = ready
            ? await ValhallaRuntime.ProbeServiceAsync(valhallaBaseUrl, probeClient, cancellationToken)
            : (false, (string?)null);

        var snapshot = new ApiHealthStatusSnapshot(
            ready,
            notReadyReason,
            buildProgress.State,
            buildProgress.Phase,
            buildProgress.ProgressPct,
            buildProgress.Message,
            buildProgress.UpdatedAt,
            serviceReachable,
            serviceError);

        var versionInfo = ResolveVersionInfo();
        return BuildFromSnapshot(snapshot, versionInfo);
    }

    internal ApiHealthStatusResponse BuildFromSnapshot(
        ApiHealthStatusSnapshot snapshot,
        ApiHealthVersionInfo versionInfo)
    {
        var valhalla = BuildValhallaStatus(snapshot);
        var globalStatus = string.Equals(valhalla.Status, "UP", StringComparison.OrdinalIgnoreCase)
            ? "OK"
            : "DEGRADED";

        return new ApiHealthStatusResponse(
            globalStatus,
            valhalla,
            versionInfo.Version,
            versionInfo.Commit,
            DateTimeOffset.UtcNow.ToString("O"));
    }

    internal static ApiHealthVersionInfo ResolveVersionInfo()
    {
        var assemblyVersion = typeof(Program).Assembly
            .GetCustomAttribute<AssemblyInformationalVersionAttribute>()?
            .InformationalVersion;
        var version = Environment.GetEnvironmentVariable("BIKEVOYAGER_VERSION")
            ?? assemblyVersion;
        var commit = Environment.GetEnvironmentVariable("BIKEVOYAGER_COMMIT")
            ?? Environment.GetEnvironmentVariable("GIT_COMMIT")
            ?? TryExtractCommitFromVersion(assemblyVersion);

        return new ApiHealthVersionInfo(version, commit);
    }

    private static ApiHealthValhallaStatus BuildValhallaStatus(ApiHealthStatusSnapshot snapshot)
    {
        if (!snapshot.Ready)
        {
            var isBuilding = string.Equals(snapshot.BuildState, "running", StringComparison.OrdinalIgnoreCase);
            var status = isBuilding ? "BUILDING" : "DOWN";
            var message = ValhallaRuntime.BuildNotReadyMessage(
                new ValhallaBuildProgress(
                    snapshot.BuildState ?? "unknown",
                    snapshot.BuildPhase ?? "initialisation",
                    snapshot.BuildProgressPct,
                    snapshot.BuildMessage ?? "Préparation en cours.",
                    snapshot.BuildUpdatedAt),
                snapshot.NotReadyReason);

            return new ApiHealthValhallaStatus(
                status,
                message,
                snapshot.NotReadyReason,
                null,
                null,
                new ApiHealthBuildStatus(
                    snapshot.BuildState ?? "unknown",
                    snapshot.BuildPhase ?? "initialisation",
                    snapshot.BuildProgressPct,
                    snapshot.BuildMessage ?? "Préparation en cours.",
                    snapshot.BuildUpdatedAt));
        }

        if (snapshot.ServiceReachable)
        {
            return new ApiHealthValhallaStatus(
                "UP",
                "Valhalla est prêt et joignable.",
                null,
                true,
                null,
                new ApiHealthBuildStatus(
                    snapshot.BuildState ?? "completed",
                    snapshot.BuildPhase ?? "ready",
                    Math.Clamp(snapshot.BuildProgressPct, 0, 100),
                    snapshot.BuildMessage ?? "Valhalla est prêt.",
                    snapshot.BuildUpdatedAt));
        }

        return new ApiHealthValhallaStatus(
            "DOWN",
            "Valhalla est préparé mais le service ne répond pas.",
            snapshot.ServiceError ?? "service_injoignable",
            false,
            snapshot.ServiceError,
            new ApiHealthBuildStatus(
                snapshot.BuildState ?? "completed",
                snapshot.BuildPhase ?? "ready",
                Math.Clamp(snapshot.BuildProgressPct, 0, 100),
                snapshot.BuildMessage ?? "Valhalla est prêt.",
                snapshot.BuildUpdatedAt));
    }

    private static string? TryExtractCommitFromVersion(string? version)
    {
        if (string.IsNullOrWhiteSpace(version))
        {
            return null;
        }

        var separatorIndex = version.IndexOf('+', StringComparison.Ordinal);
        if (separatorIndex < 0 || separatorIndex == version.Length - 1)
        {
            return null;
        }

        return version[(separatorIndex + 1)..];
    }
}

internal sealed record ApiHealthStatusSnapshot(
    bool Ready,
    string? NotReadyReason,
    string? BuildState,
    string? BuildPhase,
    int BuildProgressPct,
    string? BuildMessage,
    string? BuildUpdatedAt,
    bool ServiceReachable,
    string? ServiceError);

internal sealed record ApiHealthVersionInfo(
    string? Version,
    string? Commit);

internal sealed record ApiHealthStatusResponse(
    string Status,
    ApiHealthValhallaStatus Valhalla,
    string? Version,
    string? Commit,
    string CheckedAt);

internal sealed record ApiHealthValhallaStatus(
    string Status,
    string Message,
    string? Reason,
    bool? ServiceReachable,
    string? ServiceError,
    ApiHealthBuildStatus Build);

internal sealed record ApiHealthBuildStatus(
    string State,
    string Phase,
    int ProgressPct,
    string Message,
    string? UpdatedAt);
