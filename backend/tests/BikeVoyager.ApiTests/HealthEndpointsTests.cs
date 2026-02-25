using System.Net;
using System.Text.Json;
using BikeVoyager.Api.Valhalla;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace BikeVoyager.ApiTests;

public class HealthEndpointsTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public HealthEndpointsTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Health_retourne_DEGRADED_et_BUILDING_si_valhalla_build_en_cours()
    {
        var tempValhallaDataPath = CreateTempValhallaPath();
        await File.WriteAllTextAsync(
            Path.Combine(tempValhallaDataPath, "build-status.json"),
            "{\"state\":\"running\",\"phase\":\"tiles\",\"progress_pct\":55,\"message\":\"Generation des tuiles\",\"updated_at\":\"2026-02-25T10:00:00Z\"}");

        using var client = CreateFactory(tempValhallaDataPath, "http://127.0.0.1:1").CreateClient();
        using var response = await client.GetAsync("/api/v1/health");
        var payload = await response.Content.ReadAsStringAsync();
        using var document = JsonDocument.Parse(payload);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("DEGRADED", document.RootElement.GetProperty("status").GetString());
        Assert.Equal(
            "BUILDING",
            document.RootElement.GetProperty("valhalla").GetProperty("status").GetString());
    }

    [Fact]
    public async Task Health_retourne_OK_et_UP_si_valhalla_pret_et_probe_ok()
    {
        var tempValhallaDataPath = CreateTempValhallaPath();
        CreateReadyArtifacts(tempValhallaDataPath);

        var app = CreateFactory(tempValhallaDataPath, "http://valhalla.local")
            .WithWebHostBuilder(builder =>
            {
                builder.ConfigureServices(services =>
                {
                    services.RemoveAll<IValhallaProbeClient>();
                    services.AddSingleton<IValhallaProbeClient>(new StubValhallaProbeClient(HttpStatusCode.OK));
                });
            });

        using var client = app.CreateClient();
        using var response = await client.GetAsync("/api/v1/health");
        var payload = await response.Content.ReadAsStringAsync();
        using var document = JsonDocument.Parse(payload);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("OK", document.RootElement.GetProperty("status").GetString());
        Assert.Equal("UP", document.RootElement.GetProperty("valhalla").GetProperty("status").GetString());
    }

    private WebApplicationFactory<Program> CreateFactory(string dataPath, string baseUrl)
    {
        return _factory.WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Development");
            builder.UseSetting("Valhalla:DataPath", dataPath);
            builder.UseSetting("Valhalla:BaseUrl", baseUrl);
        });
    }

    private static string CreateTempValhallaPath()
    {
        var path = Path.Combine(Path.GetTempPath(), "bikevoyager-tests", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(path);
        return path;
    }

    private static void CreateReadyArtifacts(string dataPath)
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

    private sealed class StubValhallaProbeClient(HttpStatusCode statusCode) : IValhallaProbeClient
    {
        private readonly HttpStatusCode _statusCode = statusCode;

        public Task<HttpResponseMessage> GetStatusAsync(Uri baseAddress, CancellationToken cancellationToken)
        {
            var response = new HttpResponseMessage(_statusCode)
            {
                RequestMessage = new HttpRequestMessage(HttpMethod.Get, new Uri(baseAddress, "status")),
            };

            return Task.FromResult(response);
        }
    }
}
