using System.Text.Json;

namespace BikeVoyager.Api.Valhalla;

internal static partial class ValhallaRuntime
{
    public static ValhallaBuildProgress ReadBuildProgress(string? dataPath, bool ready)
    {
        if (string.IsNullOrWhiteSpace(dataPath))
        {
            return ready
                ? new ValhallaBuildProgress("completed", "ready", 100, "Valhalla est prêt.", null)
                : new ValhallaBuildProgress("unknown", "initialisation", 0, "Préparation en attente.", null);
        }

        var statusPath = Path.Combine(dataPath, "build-status.json");
        if (!File.Exists(statusPath))
        {
            return ready
                ? new ValhallaBuildProgress("completed", "ready", 100, "Valhalla est prêt.", null)
                : new ValhallaBuildProgress("unknown", "initialisation", 0, "Préparation en attente.", null);
        }

        try
        {
            using var document = JsonDocument.Parse(File.ReadAllText(statusPath));
            var root = document.RootElement;

            var state = root.TryGetProperty("state", out var stateElement)
                ? stateElement.GetString()
                : null;
            var phase = root.TryGetProperty("phase", out var phaseElement)
                ? phaseElement.GetString()
                : null;
            var progress = root.TryGetProperty("progress_pct", out var progressElement) && progressElement.TryGetInt32(out var parsedProgress)
                ? Math.Clamp(parsedProgress, 0, 100)
                : 0;
            var message = root.TryGetProperty("message", out var messageElement)
                ? messageElement.GetString()
                : null;
            var updatedAt = root.TryGetProperty("updated_at", out var updatedAtElement)
                ? updatedAtElement.GetString()
                : null;

            if (ready)
            {
                return new ValhallaBuildProgress(
                    "completed",
                    "ready",
                    100,
                    "Valhalla est prêt.",
                    updatedAt);
            }

            return new ValhallaBuildProgress(
                state ?? "unknown",
                phase ?? "initialisation",
                progress,
                message ?? "Préparation en cours.",
                updatedAt);
        }
        catch
        {
            return ready
                ? new ValhallaBuildProgress("completed", "ready", 100, "Valhalla est prêt.", null)
                : new ValhallaBuildProgress("unknown", "initialisation", 0, "Préparation en cours.", null);
        }
    }

    public static ValhallaUpdateStatus ReadUpdateStatus(string? dataPath)
    {
        if (string.IsNullOrWhiteSpace(dataPath))
        {
            return new ValhallaUpdateStatus(
                "unknown",
                false,
                "data_path_absent",
                "Chemin des données Valhalla absent.",
                null,
                null,
                false,
                new ValhallaUpdateRemote(null, null, null, null, false, null));
        }

        var markerPath = Path.Combine(dataPath, ".valhalla_update_available");
        var markerExists = File.Exists(markerPath);
        var statusPath = Path.Combine(dataPath, "update-status.json");

        if (!File.Exists(statusPath))
        {
            return new ValhallaUpdateStatus(
                "unknown",
                markerExists,
                "status_absent",
                markerExists
                    ? "Une mise à jour est signalée mais le statut détaillé est absent."
                    : "Aucun statut de mise à jour disponible.",
                null,
                null,
                markerExists,
                new ValhallaUpdateRemote(null, null, null, null, false, null));
        }

        try
        {
            using var document = JsonDocument.Parse(File.ReadAllText(statusPath));
            var root = document.RootElement;
            var remote = root.TryGetProperty("remote", out var remoteElement) ? remoteElement : default;

            var state = root.TryGetProperty("state", out var stateElement)
                ? stateElement.GetString()
                : null;
            var updateAvailable = root.TryGetProperty("update_available", out var updateAvailableElement)
                ? updateAvailableElement.GetBoolean()
                : markerExists;
            var reason = root.TryGetProperty("reason", out var reasonElement)
                ? reasonElement.GetString()
                : null;
            var message = root.TryGetProperty("message", out var messageElement)
                ? messageElement.GetString()
                : null;
            var checkedAt = root.TryGetProperty("checked_at", out var checkedAtElement)
                ? checkedAtElement.GetString()
                : null;
            var nextCheckAt = root.TryGetProperty("next_check_at", out var nextCheckAtElement)
                ? nextCheckAtElement.GetString()
                : null;

            var remoteSnapshot = new ValhallaUpdateRemote(
                remote.ValueKind == JsonValueKind.Object && remote.TryGetProperty("etag", out var remoteEtagElement)
                    ? remoteEtagElement.GetString()
                    : null,
                remote.ValueKind == JsonValueKind.Object && remote.TryGetProperty("last_modified", out var remoteLastModifiedElement)
                    ? remoteLastModifiedElement.GetString()
                    : null,
                remote.ValueKind == JsonValueKind.Object && remote.TryGetProperty("content_length", out var remoteContentLengthElement) && remoteContentLengthElement.TryGetInt64(out var parsedContentLength)
                    ? parsedContentLength
                    : null,
                remote.ValueKind == JsonValueKind.Object && remote.TryGetProperty("checked_at", out var remoteCheckedAtElement)
                    ? remoteCheckedAtElement.GetString()
                    : null,
                remote.ValueKind == JsonValueKind.Object && remote.TryGetProperty("available", out var remoteAvailableElement) && remoteAvailableElement.ValueKind == JsonValueKind.True,
                remote.ValueKind == JsonValueKind.Object && remote.TryGetProperty("error", out var remoteErrorElement)
                    ? remoteErrorElement.GetString()
                    : null);

            return new ValhallaUpdateStatus(
                state ?? "unknown",
                updateAvailable || markerExists,
                reason ?? "unknown",
                message ?? "Statut de mise à jour indisponible.",
                checkedAt,
                nextCheckAt,
                markerExists,
                remoteSnapshot);
        }
        catch
        {
            return new ValhallaUpdateStatus(
                "unknown",
                markerExists,
                "status_invalide",
                "Le fichier update-status.json est invalide.",
                null,
                null,
                markerExists,
                new ValhallaUpdateRemote(null, null, null, null, false, null));
        }
    }

    public static bool HasReadyMarker(string? dataPath)
    {
        if (string.IsNullOrWhiteSpace(dataPath))
        {
            return false;
        }

        var activePath = ResolveActiveDataPath(dataPath);
        var markerPath = Path.Combine(activePath, "tiles", ".valhalla_ready");
        return File.Exists(markerPath);
    }

    public static bool IsReady(string? dataPath, out string reason)
    {
        reason = string.Empty;

        if (string.IsNullOrWhiteSpace(dataPath))
        {
            return true;
        }

        var activePath = ResolveActiveDataPath(dataPath);
        var tilesDir = Path.Combine(activePath, "tiles");
        var configPath = Path.Combine(activePath, "valhalla.json");
        var adminsPath = Path.Combine(activePath, "admins.sqlite");

        if (!Directory.Exists(tilesDir))
        {
            reason = "dossier des tuiles absent";
            return false;
        }

        var configFile = new FileInfo(configPath);
        if (!configFile.Exists || configFile.Length < 100)
        {
            reason = "fichier valhalla.json absent ou vide";
            return false;
        }

        var adminsFile = new FileInfo(adminsPath);
        if (!adminsFile.Exists || adminsFile.Length < 1024)
        {
            reason = "fichier admins.sqlite absent ou trop petit";
            return false;
        }

        var hasAnyTile = Directory.EnumerateFiles(tilesDir, "*.gph", SearchOption.AllDirectories)
            .Any();
        if (!hasAnyTile)
        {
            reason = "aucune tuile .gph detectee";
            return false;
        }

        return true;
    }

    public static string ResolveActiveDataPath(string? dataPath)
    {
        if (string.IsNullOrWhiteSpace(dataPath))
        {
            return string.Empty;
        }

        var livePath = Path.Combine(dataPath, "live");
        var liveConfigPath = Path.Combine(livePath, "valhalla.json");
        var liveConfig = new FileInfo(liveConfigPath);
        return liveConfig.Exists && liveConfig.Length > 0 ? livePath : dataPath;
    }

    public static async Task<(bool Reachable, string? Error)> ProbeServiceAsync(
        string? baseUrl,
        IValhallaProbeClient probeClient,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(baseUrl))
        {
            return (false, "base_url_absente");
        }

        if (!Uri.TryCreate(baseUrl, UriKind.Absolute, out var parsedBaseUrl))
        {
            return (false, "base_url_invalide");
        }

        try
        {
            using var response = await probeClient.GetStatusAsync(parsedBaseUrl, cancellationToken);
            if (response.IsSuccessStatusCode)
            {
                return (true, null);
            }

            return (false, $"http_{(int)response.StatusCode}");
        }
        catch (OperationCanceledException)
        {
            return (false, "timeout");
        }
        catch (HttpRequestException ex)
        {
            return (false, ex.GetType().Name);
        }
    }
}
