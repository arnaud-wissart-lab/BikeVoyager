using Aspire.Hosting.ApplicationModel;
using System.Diagnostics;
using System.Text.Json;

var options = new DistributedApplicationOptions
{
    Args = args,
    AllowUnsecuredTransport = true,
    EnableResourceLogging = true
};

var builder = DistributedApplication.CreateBuilder(options);

var repoRoot = Path.GetFullPath(
    Path.Combine(builder.AppHostDirectory, "..", "..", ".."));
var valhallaDataPath = Path.GetFullPath(
    Path.Combine(repoRoot, "infra", "valhalla"));
var valhallaUpdateMarkerPath = Path.Combine(valhallaDataPath, ".valhalla_update_available");
var api = builder.AddProject<Projects.BikeVoyager_Api>("api");
var redis = builder.AddRedis("redis");
var cloudGoogleClientId = Environment.GetEnvironmentVariable("CLOUDSYNC_GOOGLEDRIVE_CLIENT_ID")
    ?? Environment.GetEnvironmentVariable("VITE_GOOGLE_DRIVE_CLIENT_ID")
    ?? string.Empty;
var cloudOneDriveClientId = Environment.GetEnvironmentVariable("CLOUDSYNC_ONEDRIVE_CLIENT_ID")
    ?? Environment.GetEnvironmentVariable("VITE_ONEDRIVE_CLIENT_ID")
    ?? string.Empty;
var cloudGoogleClientSecret = Environment.GetEnvironmentVariable("CLOUDSYNC_GOOGLEDRIVE_CLIENT_SECRET")
    ?? string.Empty;
var cloudOneDriveClientSecret = Environment.GetEnvironmentVariable("CLOUDSYNC_ONEDRIVE_CLIENT_SECRET")
    ?? string.Empty;
api.WithReference(redis);
api.WithEnvironment("Valhalla__DataPath", valhallaDataPath);
if (!string.IsNullOrWhiteSpace(cloudGoogleClientId))
{
    api.WithEnvironment("CloudSync__GoogleDrive__ClientId", cloudGoogleClientId);
}

if (!string.IsNullOrWhiteSpace(cloudOneDriveClientId))
{
    api.WithEnvironment("CloudSync__OneDrive__ClientId", cloudOneDriveClientId);
}

if (!string.IsNullOrWhiteSpace(cloudGoogleClientSecret))
{
    api.WithEnvironment("CloudSync__GoogleDrive__ClientSecret", cloudGoogleClientSecret);
}

if (!string.IsNullOrWhiteSpace(cloudOneDriveClientSecret))
{
    api.WithEnvironment("CloudSync__OneDrive__ClientSecret", cloudOneDriveClientSecret);
}
api.WithHttpHealthCheck("/api/v1/health");

var hasValhallaData = HasValidValhallaData(valhallaDataPath, out var valhallaDataReason);
var hasPendingUpdate = File.Exists(valhallaUpdateMarkerPath);
var pendingUpdateReason = hasPendingUpdate
    ? ReadValhallaPendingUpdateReason(valhallaDataPath)
    : null;
var autoBuildEnabled = !IsFalsy(Environment.GetEnvironmentVariable("VALHALLA_AUTO_BUILD"));
var autoApplyPendingUpdate = IsTruthy(Environment.GetEnvironmentVariable("VALHALLA_UPDATE_AUTO_BUILD"));
var updateWatchEnabled = !IsFalsy(Environment.GetEnvironmentVariable("VALHALLA_UPDATE_WATCH"));
var forceRebuild = IsTruthy(Environment.GetEnvironmentVariable("VALHALLA_FORCE_REBUILD"));
var shouldRunValhallaBuild = forceRebuild || (autoBuildEnabled && (!hasValhallaData || (autoApplyPendingUpdate && hasPendingUpdate)));
var valhallaBuild = shouldRunValhallaBuild
    ? AddValhallaBuildResource(builder, repoRoot)
    : null;
var valhallaWatch = updateWatchEnabled
    ? AddValhallaUpdateWatchResource(builder, repoRoot, autoApplyPendingUpdate)
    : null;

if (valhallaWatch is not null)
{
    Console.WriteLine("Valhalla: surveillance des mises à jour activée (resource valhalla-watch).");
    Console.WriteLine(
        autoApplyPendingUpdate
            ? "Valhalla: application automatique des updates OSM activée."
            : "Valhalla: update OSM détectée = notification uniquement (application manuelle).");
}

if (shouldRunValhallaBuild && valhallaBuild is not null)
{
    if (forceRebuild)
    {
        Console.WriteLine("Valhalla: rebuild force active (VALHALLA_FORCE_REBUILD).");
    }
    else if (hasPendingUpdate)
    {
        Console.WriteLine(
            $"Valhalla: mise à jour détectée ({pendingUpdateReason ?? "raison_inconnue"}), build automatique requis.");

        if (IsRemoteFileChangeReason(pendingUpdateReason))
        {
            Console.WriteLine(
                "Valhalla: détection d'un nouveau fichier, retéléchargement de la source OSM.");
        }
    }
    else
    {
        Console.WriteLine($"Valhalla: préparation automatique en cours ({valhallaDataReason}).");
    }
}
else if (hasPendingUpdate && hasValhallaData)
{
    Console.WriteLine(
        $"Valhalla: mise à jour détectée ({pendingUpdateReason ?? "raison_inconnue"}), application manuelle depuis l'aide.");
}

if (!hasValhallaData && valhallaBuild is null)
{
    Console.WriteLine(
        "Valhalla: données non prêtes. Démarrage de l'application sans moteur de routage.");
}

if (hasValhallaData || shouldRunValhallaBuild)
{
    var valhalla = builder.AddContainer("valhalla", "ghcr.io/valhalla/valhalla:latest")
        .WithBindMount(valhallaDataPath, "/custom_files")
        .WithEnvironment("VALHALLA_CONFIG", "/custom_files/live/valhalla.json")
        .WithEntrypoint("/bin/sh")
        .WithArgs("/custom_files/entrypoint.sh")
        .WithHttpEndpoint(targetPort: 8002, port: 8002, name: "http")
        .WithHttpHealthCheck("/status");

    if (valhallaBuild is not null)
    {
        valhalla.WaitForCompletion(valhallaBuild, exitCode: 0);
    }

    api.WithEnvironment("Valhalla__BaseUrl", valhalla.GetEndpoint("http"));
}
else
{
    api.WithEnvironment("Valhalla__BaseUrl", "http://localhost:8002");
}

var frontendPath = Path.GetFullPath(
    Path.Combine(builder.AppHostDirectory, "..", "..", "..", "frontend"));
var npmPath = Path.Combine(
    Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),
    "nodejs",
    "npm.cmd");

if (!File.Exists(npmPath))
{
    npmPath = "npm.cmd";
}

const int frontendPortStart = 5173;
const int frontendPortEnd = 5190;
const int frontendPort = 5173;
const int dashboardPort = 17000;
var dashboardUrl = $"https://localhost:{dashboardPort}";

Console.WriteLine($"Dashboard Aspire disponible sur {dashboardUrl}.");
Console.WriteLine(
    $"Recherche du frontend sur http://localhost:{frontendPortStart} à http://localhost:{frontendPortEnd}.");

builder.AddExecutable(
        "frontend",
        npmPath,
        frontendPath,
        "run",
        "dev")
    .WithHttpEndpoint(targetPort: frontendPort, port: null, name: "http", env: null, isProxied: false)
    .WithEnvironment("VITE_DEV_PORT", frontendPort.ToString())
    .WithEnvironment("VITE_STRICT_PORT", "true")
    .WithEnvironment("VITE_API_BASE_URL", api.GetEndpoint("http"))
    .WithEnvironment("API_BASE_URL", api.GetEndpoint("http"));

_ = Task.Run(() => TryOpenUrl(dashboardUrl));

_ = Task.Run(async () =>
{
    using var http = new HttpClient();
    var frontendUrl = string.Empty;

    for (var attempt = 0; attempt < 30; attempt++)
    {
        frontendUrl = await FindFrontendUrlAsync(
            http,
            frontendPortStart,
            frontendPortEnd);

        if (!string.IsNullOrWhiteSpace(frontendUrl))
        {
            Console.WriteLine($"Frontend détecté sur {frontendUrl}.");
            break;
        }

        await Task.Delay(TimeSpan.FromSeconds(1));
    }

    if (string.IsNullOrWhiteSpace(frontendUrl))
    {
        Console.WriteLine(
            "Le frontend n'a pas répondu après 30 secondes. Vérifiez que `npm install` a été exécuté dans `frontend/`.");
    }
});

builder.Build().Run();

static bool IsFalsy(string? value) =>
    string.Equals(value, "0", StringComparison.OrdinalIgnoreCase) ||
    string.Equals(value, "false", StringComparison.OrdinalIgnoreCase) ||
    string.Equals(value, "no", StringComparison.OrdinalIgnoreCase);

static bool IsTruthy(string? value) =>
    string.Equals(value, "1", StringComparison.OrdinalIgnoreCase) ||
    string.Equals(value, "true", StringComparison.OrdinalIgnoreCase) ||
    string.Equals(value, "yes", StringComparison.OrdinalIgnoreCase);

static IResourceBuilder<ExecutableResource>? AddValhallaBuildResource(
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

static IResourceBuilder<ExecutableResource>? AddValhallaUpdateWatchResource(
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

static bool HasValidValhallaData(string dataPath, out string reason)
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

static string ResolveValhallaActiveDataPath(string dataPath)
{
    var livePath = Path.Combine(dataPath, "live");
    var liveConfigPath = Path.Combine(livePath, "valhalla.json");
    var liveConfig = new FileInfo(liveConfigPath);
    return liveConfig.Exists && liveConfig.Length > 0 ? livePath : dataPath;
}

static string? ReadValhallaPendingUpdateReason(string dataPath)
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

static bool IsRemoteFileChangeReason(string? reason) =>
    string.Equals(reason, "taille_locale_differe", StringComparison.OrdinalIgnoreCase) ||
    string.Equals(reason, "etag_modifie", StringComparison.OrdinalIgnoreCase) ||
    string.Equals(reason, "content_length_modifie", StringComparison.OrdinalIgnoreCase) ||
    string.Equals(reason, "last_modified_plus_recent", StringComparison.OrdinalIgnoreCase);

static string? ResolveWindowsShell()
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

static void TryOpenUrl(string url)
{
    try
    {
        Process.Start(new ProcessStartInfo(url)
        {
            UseShellExecute = true
        });
    }
    catch
    {
        // Ouverture automatique ignoree.
    }
}

static async Task<string> FindFrontendUrlAsync(
    HttpClient http,
    int startPort,
    int endPort)
{
    for (var port = startPort; port <= endPort; port++)
    {
        var url = $"http://localhost:{port}";
        try
        {
            using var response = await http.GetAsync(url);
            if (response.IsSuccessStatusCode)
            {
                return url;
            }
        }
        catch
        {
            // Attente du frontend.
        }
    }

    return string.Empty;
}
