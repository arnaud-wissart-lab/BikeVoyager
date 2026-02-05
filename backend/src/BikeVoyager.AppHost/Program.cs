using System.Diagnostics;

var options = new DistributedApplicationOptions
{
    Args = args,
    AllowUnsecuredTransport = true,
    EnableResourceLogging = true
};

var builder = DistributedApplication.CreateBuilder(options);

builder.AddProject<Projects.BikeVoyager_Api>("api");

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

Console.WriteLine(
    $"Recherche du frontend sur http://localhost:{frontendPortStart} à http://localhost:{frontendPortEnd}.");

builder.AddExecutable(
        "frontend",
        npmPath,
        frontendPath,
        "run",
        "dev")
    .WithEnvironment("VITE_API_BASE_URL", "https://localhost:7144")
    .WithEnvironment("API_BASE_URL", "https://localhost:7144");

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
            Process.Start(new ProcessStartInfo(frontendUrl)
            {
                UseShellExecute = true
            });
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
