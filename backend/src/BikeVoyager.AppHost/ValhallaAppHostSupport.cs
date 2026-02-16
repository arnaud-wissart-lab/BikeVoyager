using Aspire.Hosting.ApplicationModel;
using System.Text.Json;

internal static class ValhallaAppHostSupport
{
    public static bool IsFalsy(string? value) =>
        string.Equals(value, "0", StringComparison.OrdinalIgnoreCase) ||
        string.Equals(value, "false", StringComparison.OrdinalIgnoreCase) ||
        string.Equals(value, "no", StringComparison.OrdinalIgnoreCase);

    public static bool IsTruthy(string? value) =>
        string.Equals(value, "1", StringComparison.OrdinalIgnoreCase) ||
        string.Equals(value, "true", StringComparison.OrdinalIgnoreCase) ||
        string.Equals(value, "yes", StringComparison.OrdinalIgnoreCase);

    public static IResourceBuilder<ExecutableResource>? AddValhallaBuildResource(
        IDistributedApplicationBuilder builder,
        string repoRoot)
    {
        var scriptsDir = Path.Combine(repoRoot, "scripts");
        var windowsScript = Path.Combine(scriptsDir, "valhalla-build-france.ps1");
        var unixScript = Path.Combine(scriptsDir, "valhalla-build-france.sh");

        if (OperatingSystem.IsWindows())
        {
            var shell = ResolveWindowsShell();
            if (string.IsNullOrWhiteSpace(shell))
            {
                Console.WriteLine("Valhalla: pwsh/powershell introuvable pour auto-build.");
                return null;
            }

            if (!File.Exists(windowsScript))
            {
                Console.WriteLine("Valhalla: script Windows introuvable.");
                return null;
            }

            return builder.AddExecutable(
                "valhalla-build",
                shell,
                repoRoot,
                "-NoProfile",
                "-ExecutionPolicy",
                "Bypass",
                "-File",
                windowsScript);
        }

        if (!File.Exists(unixScript))
        {
            Console.WriteLine("Valhalla: script Unix introuvable.");
            return null;
        }

        return builder.AddExecutable("valhalla-build", "/bin/sh", repoRoot, unixScript);
    }

    public static IResourceBuilder<ExecutableResource>? AddValhallaUpdateWatchResource(
        IDistributedApplicationBuilder builder,
        string repoRoot,
        bool autoBuildOnDetect)
    {
        var scriptsDir = Path.Combine(repoRoot, "scripts");
        var windowsScript = Path.Combine(scriptsDir, "valhalla-watch-updates.ps1");
        var unixScript = Path.Combine(scriptsDir, "valhalla-watch-updates.sh");

        if (OperatingSystem.IsWindows())
        {
            var shell = ResolveWindowsShell();
            if (string.IsNullOrWhiteSpace(shell))
            {
                Console.WriteLine("Valhalla: pwsh/powershell introuvable pour valhalla-watch.");
                return null;
            }

            if (!File.Exists(windowsScript))
            {
                Console.WriteLine("Valhalla: script Windows valhalla-watch introuvable.");
                return null;
            }

            return builder.AddExecutable(
                "valhalla-watch",
                shell,
                repoRoot,
                "-NoProfile",
                "-ExecutionPolicy",
                "Bypass",
                "-File",
                windowsScript)
                .WithEnvironment("VALHALLA_UPDATE_AUTO_BUILD", autoBuildOnDetect ? "true" : "false");
        }

        if (!File.Exists(unixScript))
        {
            Console.WriteLine("Valhalla: script Unix valhalla-watch introuvable.");
            return null;
        }

        return builder.AddExecutable("valhalla-watch", "/bin/sh", repoRoot, unixScript)
            .WithEnvironment("VALHALLA_UPDATE_AUTO_BUILD", autoBuildOnDetect ? "true" : "false");
    }

    public static bool HasValidValhallaData(string dataPath, out string reason)
    {
        reason = "ok";

        if (string.IsNullOrWhiteSpace(dataPath))
        {
            reason = "data_path_absent";
            return false;
        }

        if (!Directory.Exists(dataPath))
        {
            reason = "dossier_valhalla_absent";
            return false;
        }

        var activeDataPath = ResolveValhallaActiveDataPath(dataPath);
        var tilesDir = Path.Combine(activeDataPath, "tiles");
        if (!Directory.Exists(tilesDir))
        {
            reason = "dossier_tuiles_absent";
            return false;
        }

        var configPath = Path.Combine(activeDataPath, "valhalla.json");
        var configFile = new FileInfo(configPath);
        if (!configFile.Exists || configFile.Length < 100)
        {
            reason = "config_absente_ou_vide";
            return false;
        }

        var adminsPath = Path.Combine(activeDataPath, "admins.sqlite");
        var adminsFile = new FileInfo(adminsPath);
        if (!adminsFile.Exists || adminsFile.Length < 1024)
        {
            reason = "admins_absent_ou_vide";
            return false;
        }

        var hasAnyTile = Directory.EnumerateFiles(tilesDir, "*.gph", SearchOption.AllDirectories)
            .Any();
        if (!hasAnyTile)
        {
            reason = "aucune_tuile_gph_detectee";
            return false;
        }

        return true;
    }

    public static string? ReadValhallaPendingUpdateReason(string dataPath)
    {
        if (string.IsNullOrWhiteSpace(dataPath))
        {
            return null;
        }

        var updateStatusPath = Path.Combine(dataPath, "update-status.json");
        if (!File.Exists(updateStatusPath))
        {
            return null;
        }

        try
        {
            using var document = JsonDocument.Parse(File.ReadAllText(updateStatusPath));
            if (document.RootElement.TryGetProperty("reason", out var reasonElement))
            {
                return reasonElement.GetString();
            }
        }
        catch
        {
            // Ignore les payloads de statut invalides.
        }

        return null;
    }

    public static bool IsRemoteFileChangeReason(string? reason) =>
        string.Equals(reason, "taille_locale_differe", StringComparison.OrdinalIgnoreCase) ||
        string.Equals(reason, "etag_modifie", StringComparison.OrdinalIgnoreCase) ||
        string.Equals(reason, "content_length_modifie", StringComparison.OrdinalIgnoreCase) ||
        string.Equals(reason, "last_modified_plus_recent", StringComparison.OrdinalIgnoreCase);

    private static string ResolveValhallaActiveDataPath(string dataPath)
    {
        var livePath = Path.Combine(dataPath, "live");
        var liveConfigPath = Path.Combine(livePath, "valhalla.json");
        var liveConfig = new FileInfo(liveConfigPath);
        return liveConfig.Exists && liveConfig.Length > 0 ? livePath : dataPath;
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
