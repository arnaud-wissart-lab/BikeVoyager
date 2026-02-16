using System.Diagnostics;
using System.Text.Json;

namespace BikeVoyager.Api.Valhalla;

internal static partial class ValhallaRuntime
{
    private static readonly object ValhallaBuildLaunchLock = new();
    private static Process? ValhallaBuildBackgroundProcess;

    public static void TryStartAutomaticUpdateIfAvailable(
        string? dataPath,
        Microsoft.Extensions.Logging.ILogger logger)
    {
        try
        {
            var ready = IsReady(dataPath, out _);
            var buildProgress = ReadBuildProgress(dataPath, ready);
            var buildRunning = string.Equals(buildProgress.State, "running", StringComparison.OrdinalIgnoreCase);
            if (buildRunning)
            {
                return;
            }

            var updateStatus = ReadUpdateStatus(dataPath);
            if (!updateStatus.UpdateAvailable)
            {
                return;
            }

            var launchResult = TryStartBuildInBackground(dataPath, forceRebuild: false);
            if (launchResult.Started)
            {
                logger.LogInformation(
                    "Mise à jour Valhalla lancée automatiquement en arrière-plan (pid={Pid}).",
                    launchResult.Pid);
                return;
            }

            logger.LogWarning(
                "Mise à jour Valhalla disponible, mais lancement automatique impossible ({Reason}): {Message}",
                launchResult.Reason,
                launchResult.Message);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Échec du déclenchement automatique de la mise à jour Valhalla.");
        }
    }

    public static string BuildNotReadyMessage(ValhallaBuildProgress buildProgress, string? reason = null)
    {
        if (string.Equals(buildProgress.State, "running", StringComparison.OrdinalIgnoreCase))
        {
            return $"Le moteur d'itinéraire est en cours de préparation ({buildProgress.ProgressPct}%).";
        }

        if (string.Equals(buildProgress.State, "failed", StringComparison.OrdinalIgnoreCase))
        {
            return "La préparation automatique de Valhalla a échoué. Nouvelle tentative au prochain démarrage.";
        }

        if (!string.IsNullOrWhiteSpace(reason))
        {
            return $"Le moteur d'itinéraire n'est pas prêt ({reason}).";
        }

        return "Le moteur d'itinéraire est en cours de préparation. Réessayez dans quelques minutes.";
    }

    public static ValhallaBuildStartResult TryStartBuildInBackground(string? dataPath, bool forceRebuild)
    {
        lock (ValhallaBuildLaunchLock)
        {
            if (ValhallaBuildBackgroundProcess is not null)
            {
                if (!ValhallaBuildBackgroundProcess.HasExited)
                {
                    return new ValhallaBuildStartResult(
                        false,
                        "already_running",
                        "Un build Valhalla est déjà en cours.",
                        null);
                }

                ValhallaBuildBackgroundProcess.Dispose();
                ValhallaBuildBackgroundProcess = null;
            }

            if (string.IsNullOrWhiteSpace(dataPath) || !Directory.Exists(dataPath))
            {
                return new ValhallaBuildStartResult(
                    false,
                    "data_path_invalid",
                    "Chemin des données Valhalla invalide.",
                    null);
            }

            var buildLockPath = Path.Combine(dataPath, ".build.lock");
            if (File.Exists(buildLockPath))
            {
                var lockReleased = TryReleaseStaleBuildLock(dataPath, buildLockPath);
                if (!lockReleased)
                {
                    return new ValhallaBuildStartResult(
                        false,
                        "already_running",
                        "Un build Valhalla est déjà en cours.",
                        null);
                }
            }

            var repoRoot = ResolveRepoRootFromValhallaDataPath(dataPath);
            if (string.IsNullOrWhiteSpace(repoRoot) || !Directory.Exists(repoRoot))
            {
                return new ValhallaBuildStartResult(
                    false,
                    "repo_root_not_found",
                    "Impossible de localiser la racine du dépôt.",
                    null);
            }

            var scriptsDir = Path.Combine(repoRoot, "scripts");
            ProcessStartInfo startInfo;

            if (OperatingSystem.IsWindows())
            {
                var shell = ResolveWindowsShell();
                if (string.IsNullOrWhiteSpace(shell))
                {
                    return new ValhallaBuildStartResult(
                        false,
                        "no_shell",
                        "pwsh/powershell introuvable.",
                        null);
                }

                var scriptPath = Path.Combine(scriptsDir, "valhalla-build-france.ps1");
                if (!File.Exists(scriptPath))
                {
                    return new ValhallaBuildStartResult(
                        false,
                        "no_script",
                        "Script valhalla-build-france.ps1 introuvable.",
                        null);
                }

                startInfo = new ProcessStartInfo
                {
                    FileName = shell,
                    WorkingDirectory = repoRoot,
                    UseShellExecute = false,
                    CreateNoWindow = true,
                };

                startInfo.ArgumentList.Add("-NoProfile");
                startInfo.ArgumentList.Add("-ExecutionPolicy");
                startInfo.ArgumentList.Add("Bypass");
                startInfo.ArgumentList.Add("-File");
                startInfo.ArgumentList.Add(scriptPath);
            }
            else
            {
                var scriptPath = Path.Combine(scriptsDir, "valhalla-build-france.sh");
                if (!File.Exists(scriptPath))
                {
                    return new ValhallaBuildStartResult(
                        false,
                        "no_script",
                        "Script valhalla-build-france.sh introuvable.",
                        null);
                }

                startInfo = new ProcessStartInfo
                {
                    FileName = "/bin/sh",
                    WorkingDirectory = repoRoot,
                    UseShellExecute = false,
                    CreateNoWindow = true,
                };

                startInfo.ArgumentList.Add(scriptPath);
            }

            if (forceRebuild)
            {
                startInfo.Environment["VALHALLA_FORCE_REBUILD"] = "true";
            }

            Process? process;
            try
            {
                process = Process.Start(startInfo);
            }
            catch (Exception ex)
            {
                return new ValhallaBuildStartResult(
                    false,
                    "start_failed",
                    ex.Message,
                    null);
            }

            if (process is null)
            {
                return new ValhallaBuildStartResult(
                    false,
                    "start_failed",
                    "Le processus de build n'a pas pu être démarré.",
                    null);
            }

            ValhallaBuildBackgroundProcess = process;
            return new ValhallaBuildStartResult(
                true,
                "started",
                "Build Valhalla lancé.",
                process.Id);
        }
    }

    private static string? ResolveRepoRootFromValhallaDataPath(string? dataPath)
    {
        if (string.IsNullOrWhiteSpace(dataPath))
        {
            return null;
        }

        var infraDir = Directory.GetParent(dataPath);
        var repoDir = infraDir?.Parent;
        return repoDir?.FullName;
    }

    private static bool TryReleaseStaleBuildLock(string dataPath, string buildLockPath)
    {
        if (!File.Exists(buildLockPath))
        {
            return true;
        }

        const int staleAfterMinutes = 5;
        if (!IsBuildStatusStale(dataPath, staleAfterMinutes))
        {
            return false;
        }

        try
        {
            File.Delete(buildLockPath);
            return true;
        }
        catch
        {
            return false;
        }
    }

    private static bool IsBuildStatusStale(string dataPath, int staleAfterMinutes)
    {
        var statusPath = Path.Combine(dataPath, "build-status.json");
        if (!File.Exists(statusPath))
        {
            var lockInfo = new FileInfo(Path.Combine(dataPath, ".build.lock"));
            return DateTime.UtcNow - lockInfo.LastWriteTimeUtc >= TimeSpan.FromMinutes(staleAfterMinutes);
        }

        try
        {
            using var document = JsonDocument.Parse(File.ReadAllText(statusPath));
            var root = document.RootElement;
            var state = root.TryGetProperty("state", out var stateElement)
                ? stateElement.GetString()
                : null;
            var updatedAtRaw = root.TryGetProperty("updated_at", out var updatedAtElement)
                ? updatedAtElement.GetString()
                : null;

            if (!string.Equals(state, "running", StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }

            if (DateTimeOffset.TryParse(updatedAtRaw, out var updatedAt))
            {
                return DateTimeOffset.UtcNow - updatedAt >= TimeSpan.FromMinutes(staleAfterMinutes);
            }

            return true;
        }
        catch
        {
            return true;
        }
    }

    private static string? ResolveWindowsShell()
    {
        var systemPath = Environment.GetEnvironmentVariable("PATH") ?? string.Empty;
        var paths = systemPath.Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries);

        foreach (var folder in paths)
        {
            var pwsh = Path.Combine(folder, "pwsh.exe");
            if (File.Exists(pwsh))
            {
                return pwsh;
            }
        }

        foreach (var folder in paths)
        {
            var powershell = Path.Combine(folder, "powershell.exe");
            if (File.Exists(powershell))
            {
                return powershell;
            }
        }

        return null;
    }
}
