using Aspire.Hosting.ApplicationModel;

internal static class AppHostBuilderExtensions
{
    // A bump lors des updates Valhalla (garder aligne avec infra/valhalla.compose.yml).
    private const string ValhallaImageReference =
        "ghcr.io/valhalla/valhalla@sha256:4e287d4e78ee9e44911d282c33b52f6d916381d705f59b0a875d5b71ef565d2a";

    public static IResourceBuilder<ProjectResource> AddApi(
        this IDistributedApplicationBuilder builder,
        string valhallaDataPath)
    {
        var api = builder.AddProject<Projects.BikeVoyager_Api>("api");
        var redis = builder.AddRedis("redis");
        var cloudSync = CloudSyncEnvironmentVariables.ReadFromEnvironment();

        api.WithReference(redis);
        api.WithEnvironment("Valhalla__DataPath", valhallaDataPath);
        cloudSync.ApplyTo(api);
        api.WithHttpHealthCheck("/api/v1/health");

        return api;
    }

    public static void AddValhalla(
        this IDistributedApplicationBuilder builder,
        IResourceBuilder<ProjectResource> api,
        string repoRoot,
        string valhallaDataPath)
    {
        var valhallaUpdateMarkerPath = Path.Combine(valhallaDataPath, ".valhalla_update_available");
        var hasValhallaData = ValhallaAppHostSupport.HasValidValhallaData(valhallaDataPath, out var valhallaDataReason);
        var hasPendingUpdate = File.Exists(valhallaUpdateMarkerPath);
        var pendingUpdateReason = hasPendingUpdate
            ? ValhallaAppHostSupport.ReadValhallaPendingUpdateReason(valhallaDataPath)
            : null;
        var autoBuildEnabled = !ValhallaAppHostSupport.IsFalsy(Environment.GetEnvironmentVariable("VALHALLA_AUTO_BUILD"));
        var autoApplyPendingUpdate = ValhallaAppHostSupport.IsTruthy(Environment.GetEnvironmentVariable("VALHALLA_UPDATE_AUTO_BUILD"));
        var updateWatchEnabled = !ValhallaAppHostSupport.IsFalsy(Environment.GetEnvironmentVariable("VALHALLA_UPDATE_WATCH"));
        var forceRebuild = ValhallaAppHostSupport.IsTruthy(Environment.GetEnvironmentVariable("VALHALLA_FORCE_REBUILD"));
        var shouldRunValhallaBuild = forceRebuild ||
                                     (autoBuildEnabled && (!hasValhallaData || (autoApplyPendingUpdate && hasPendingUpdate)));
        var valhallaBuild = shouldRunValhallaBuild
            ? ValhallaAppHostSupport.AddValhallaBuildResource(builder, repoRoot)
            : null;
        var valhallaWatch = updateWatchEnabled
            ? ValhallaAppHostSupport.AddValhallaUpdateWatchResource(builder, repoRoot, autoApplyPendingUpdate)
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

                if (ValhallaAppHostSupport.IsRemoteFileChangeReason(pendingUpdateReason))
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
            var valhalla = builder.AddContainer("valhalla", ValhallaImageReference)
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
    }

    public static void AddFrontend(
        this IDistributedApplicationBuilder builder,
        IResourceBuilder<ProjectResource> api,
        string frontendPath)
    {
        const int frontendPortStart = 5173;
        const int frontendPortEnd = 5190;
        const int frontendPort = 5173;
        const int dashboardPort = 17000;
        var dashboardUrl = $"https://localhost:{dashboardPort}";
        var npmPath = FrontendAppHostSupport.ResolveNpmPath();

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

        _ = Task.Run(() => FrontendAppHostSupport.TryOpenUrl(dashboardUrl));

        _ = Task.Run(async () =>
        {
            using var http = new HttpClient
            {
                Timeout = TimeSpan.FromSeconds(3),
            };
            var frontendUrl = string.Empty;

            for (var attempt = 0; attempt < 30; attempt++)
            {
                frontendUrl = await FrontendAppHostSupport.FindFrontendUrlAsync(
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
                    "Le frontend n'a pas répondu après 30 secondes. Vérifiez que `npm ci` a été exécuté dans `frontend/`.");
            }
        });
    }

    private sealed record CloudSyncEnvironmentVariables(
        string GoogleClientId,
        string OneDriveClientId,
        string GoogleClientSecret,
        string OneDriveClientSecret)
    {
        public static CloudSyncEnvironmentVariables ReadFromEnvironment()
        {
            var googleClientId = Environment.GetEnvironmentVariable("CLOUDSYNC_GOOGLEDRIVE_CLIENT_ID")
                ?? Environment.GetEnvironmentVariable("VITE_GOOGLE_DRIVE_CLIENT_ID")
                ?? string.Empty;
            var oneDriveClientId = Environment.GetEnvironmentVariable("CLOUDSYNC_ONEDRIVE_CLIENT_ID")
                ?? Environment.GetEnvironmentVariable("VITE_ONEDRIVE_CLIENT_ID")
                ?? string.Empty;
            var googleClientSecret = Environment.GetEnvironmentVariable("CLOUDSYNC_GOOGLEDRIVE_CLIENT_SECRET")
                ?? string.Empty;
            var oneDriveClientSecret = Environment.GetEnvironmentVariable("CLOUDSYNC_ONEDRIVE_CLIENT_SECRET")
                ?? string.Empty;

            return new CloudSyncEnvironmentVariables(
                googleClientId,
                oneDriveClientId,
                googleClientSecret,
                oneDriveClientSecret);
        }

        public void ApplyTo(IResourceBuilder<ProjectResource> api)
        {
            if (!string.IsNullOrWhiteSpace(GoogleClientId))
            {
                api.WithEnvironment("CloudSync__GoogleDrive__ClientId", GoogleClientId);
            }

            if (!string.IsNullOrWhiteSpace(OneDriveClientId))
            {
                api.WithEnvironment("CloudSync__OneDrive__ClientId", OneDriveClientId);
            }

            if (!string.IsNullOrWhiteSpace(GoogleClientSecret))
            {
                api.WithEnvironment("CloudSync__GoogleDrive__ClientSecret", GoogleClientSecret);
            }

            if (!string.IsNullOrWhiteSpace(OneDriveClientSecret))
            {
                api.WithEnvironment("CloudSync__OneDrive__ClientSecret", OneDriveClientSecret);
            }
        }
    }
}
