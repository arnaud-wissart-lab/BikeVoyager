using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;

namespace BikeVoyager.ApiTests;

public class ValhallaStatusEndpointsTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public ValhallaStatusEndpointsTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Ready_retourne_503_si_donnees_absentes()
    {
        var tempValhallaDataPath = CreateTempValhallaPath();
        var app = CreateFactoryWithValhallaSettings(tempValhallaDataPath);
        using var client = app.CreateClient();
        using var response = await client.GetAsync("/api/v1/valhalla/ready");
        var payload = await response.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        Assert.Contains("moteur d'itinéraire n'est pas prêt", payload);
    }

    [Fact]
    public async Task Status_expose_la_raison_si_non_pret()
    {
        var tempValhallaDataPath = CreateTempValhallaPath();
        var app = CreateFactoryWithValhallaSettings(tempValhallaDataPath);
        using var client = app.CreateClient();
        using var response = await client.GetAsync("/api/v1/valhalla/status");
        var payload = await response.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains("\"ready\":false", payload);
        Assert.True(
            payload.Contains("dossier des tuiles absent", StringComparison.Ordinal) ||
            payload.Contains("fichier valhalla.json absent ou vide", StringComparison.Ordinal) ||
            payload.Contains("aucune tuile .gph detectee", StringComparison.Ordinal));
    }

    [Fact]
    public async Task Status_expose_le_bloc_update()
    {
        var tempValhallaDataPath = CreateTempValhallaPath();
        var updateStatusPath = Path.Combine(tempValhallaDataPath, "update-status.json");
        var updateMarkerPath = Path.Combine(tempValhallaDataPath, ".valhalla_update_available");

        await File.WriteAllTextAsync(
            updateStatusPath,
            "{\"state\":\"update_available\",\"update_available\":true,\"reason\":\"etag_modifie\",\"message\":\"Mise à jour disponible.\",\"checked_at\":\"2026-02-06T10:00:00Z\",\"next_check_at\":\"2026-02-06T13:00:00Z\",\"remote\":{\"available\":true}}");
        await File.WriteAllTextAsync(updateMarkerPath, "2026-02-06T10:00:00Z");

        var app = CreateFactoryWithValhallaSettings(tempValhallaDataPath);
        using var client = app.CreateClient();
        using var response = await client.GetAsync("/api/v1/valhalla/status");
        var payload = await response.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains("\"update_available\":true", payload);
        Assert.Contains("\"marker_exists\":true", payload);
    }

    [Fact]
    public async Task Status_utilise_legacy_si_live_est_vide()
    {
        var tempValhallaDataPath = CreateTempValhallaPath();
        Directory.CreateDirectory(Path.Combine(tempValhallaDataPath, "live"));
        CreateReadyLegacyArtifacts(tempValhallaDataPath);

        var app = CreateFactoryWithValhallaSettings(tempValhallaDataPath);
        using var client = app.CreateClient();
        using var response = await client.GetAsync("/api/v1/valhalla/status");
        var payload = await response.Content.ReadAsStringAsync();
        using var document = JsonDocument.Parse(payload);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.True(document.RootElement.GetProperty("ready").GetBoolean());
        Assert.Equal(
            tempValhallaDataPath,
            document.RootElement.GetProperty("active_data_path").GetString());
    }

    [Fact]
    public async Task StartUpdate_retourne_400_si_aucune_update_disponible()
    {
        var tempValhallaDataPath = CreateTempValhallaPath();
        var app = CreateFactoryWithValhallaSettings(tempValhallaDataPath);
        using var client = app.CreateClient();
        using var response = await client.PostAsync("/api/v1/valhalla/update/start", content: null);
        var payload = await response.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("\"status\":\"no_update\"", payload);
    }

    [Fact]
    public async Task StartUpdate_retourne_409_si_un_build_est_deja_en_cours()
    {
        var tempValhallaDataPath = CreateTempValhallaPath();
        var updateStatusPath = Path.Combine(tempValhallaDataPath, "update-status.json");
        var updateMarkerPath = Path.Combine(tempValhallaDataPath, ".valhalla_update_available");
        var buildLockPath = Path.Combine(tempValhallaDataPath, ".build.lock");

        await File.WriteAllTextAsync(
            updateStatusPath,
            "{\"state\":\"update_available\",\"update_available\":true,\"reason\":\"etag_modifie\",\"message\":\"Mise à jour disponible.\",\"checked_at\":\"2026-02-06T10:00:00Z\",\"remote\":{\"available\":true}}");
        await File.WriteAllTextAsync(updateMarkerPath, "2026-02-06T10:00:00Z");
        await File.WriteAllTextAsync(buildLockPath, "2026-02-06T10:01:00Z");

        var app = CreateFactoryWithValhallaSettings(tempValhallaDataPath);
        using var client = app.CreateClient();
        using var response = await client.PostAsync("/api/v1/valhalla/update/start", content: null);
        var payload = await response.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Contains("\"reason\":\"already_running\"", payload);
    }

    private WebApplicationFactory<Program> CreateFactoryWithValhallaSettings(string dataPath)
    {
        return _factory.WithWebHostBuilder(builder =>
        {
            builder.UseSetting("Valhalla:DataPath", dataPath);
            builder.UseSetting("Valhalla:BaseUrl", "http://127.0.0.1:1");
        });
    }

    private static string CreateTempValhallaPath()
    {
        var path = Path.Combine(Path.GetTempPath(), "bikevoyager-tests", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(path);
        return path;
    }

    private static void CreateReadyLegacyArtifacts(string dataPath)
    {
        var tilesPath = Path.Combine(dataPath, "tiles");
        Directory.CreateDirectory(tilesPath);
        File.WriteAllText(Path.Combine(tilesPath, ".valhalla_ready"), DateTimeOffset.UtcNow.ToString("O"));
        File.WriteAllBytes(Path.Combine(tilesPath, "0.gph"), new byte[] { 1, 2, 3, 4 });

        var configPayload = "{\"mjolnir\":{\"tile_dir\":\"/custom_files/tiles\"},\"loki\":{\"actions\":[\"route\"]},\"thor\":{\"logging\":true}}";
        File.WriteAllText(Path.Combine(dataPath, "valhalla.json"), configPayload + new string(' ', 120));

        var adminsPayload = new byte[2048];
        for (var index = 0; index < adminsPayload.Length; index += 1)
        {
            adminsPayload[index] = (byte)(index % 251);
        }

        File.WriteAllBytes(Path.Combine(dataPath, "admins.sqlite"), adminsPayload);
    }
}
