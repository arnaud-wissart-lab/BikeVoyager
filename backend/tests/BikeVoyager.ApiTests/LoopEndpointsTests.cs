using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using BikeVoyager.Application.Routing;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace BikeVoyager.ApiTests;

public class LoopEndpointsTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly StubLoopService _stubLoopService;

    public LoopEndpointsTests(WebApplicationFactory<Program> factory)
    {
        _stubLoopService = new StubLoopService();
        _factory = factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                services.RemoveAll<ILoopService>();
                services.AddSingleton<ILoopService>(_stubLoopService);
            });
        });
    }

    [Fact]
    public async Task Loop_retourne_une_boucle()
    {
        using var client = _factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/v1/loop", new
        {
            start = new { lat = 48.8566, lon = 2.3522, label = "Paris" },
            targetDistanceKm = 50,
            mode = "bicycle",
            speedKmh = 15,
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var json = await response.Content.ReadAsStringAsync();
        using var document = JsonDocument.Parse(json);

        Assert.Equal("LineString", document.RootElement.GetProperty("geometry").GetProperty("type").GetString());
        Assert.Equal(50000, document.RootElement.GetProperty("distance_m").GetDouble());
        Assert.Equal(12000, document.RootElement.GetProperty("eta_s").GetDouble());
        Assert.Equal("faible", document.RootElement.GetProperty("overlapScore").GetString());
        Assert.Equal(42, document.RootElement.GetProperty("segmentsCount").GetInt32());
    }

    [Fact]
    public async Task Loop_refuse_un_mode_invalide()
    {
        using var client = _factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/v1/loop", new
        {
            start = new { lat = 48.8566, lon = 2.3522, label = "Paris" },
            targetDistanceKm = 50,
            mode = "plane",
            speedKmh = 15,
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Loop_transmet_des_waypoints()
    {
        using var client = _factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/v1/loop", new
        {
            start = new { lat = 48.8566, lon = 2.3522, label = "Paris" },
            targetDistanceKm = 50,
            mode = "bicycle",
            speedKmh = 15,
            waypoints = new[]
            {
                new { lat = 48.8610, lon = 2.3400, label = "Louvre" },
                new { lat = 48.8600, lon = 2.3330, label = "Musee d'Orsay" },
            },
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(_stubLoopService.LastRequest);
        Assert.NotNull(_stubLoopService.LastRequest!.Waypoints);
        Assert.Equal(2, _stubLoopService.LastRequest.Waypoints!.Count);
        Assert.Equal("Louvre", _stubLoopService.LastRequest.Waypoints[0].Label);
    }

    [Fact]
    public async Task Loop_transmet_le_niveau_assistance_vae()
    {
        using var client = _factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/v1/loop", new
        {
            start = new { lat = 48.8566, lon = 2.3522, label = "Paris" },
            targetDistanceKm = 30,
            mode = "ebike",
            speedKmh = 20,
            ebikeAssist = "low",
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(_stubLoopService.LastRequest);
        Assert.Equal("low", _stubLoopService.LastRequest!.EbikeAssist);
    }

    [Fact]
    public async Task Loop_retourne_503_si_valhalla_non_pret()
    {
        var tempValhallaDataPath = Path.Combine(Path.GetTempPath(), "bikevoyager-tests", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(Path.Combine(tempValhallaDataPath, "tiles"));

        var app = _factory.WithWebHostBuilder(builder =>
        {
            builder.UseSetting("Valhalla:DataPath", tempValhallaDataPath);
            builder.UseSetting("Valhalla:BaseUrl", "http://127.0.0.1:1");
        });

        using var client = app.CreateClient();
        using var response = await client.PostAsJsonAsync("/api/v1/loop", new
        {
            start = new { lat = 48.8566, lon = 2.3522, label = "Paris" },
            targetDistanceKm = 50,
            mode = "walking",
            speedKmh = 5,
        });

        var payload = await response.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        Assert.Contains("moteur d'itinéraire n'est pas prêt", payload);
    }

    private sealed class StubLoopService : ILoopService
    {
        public LoopRequest? LastRequest { get; private set; }

        public Task<LoopResponse> ComputeAsync(LoopRequest request, CancellationToken cancellationToken)
        {
            LastRequest = request;

            var geometry = new GeoJsonLineString(
                "LineString",
                new List<double[]>
                {
                    new[] { 2.3522, 48.8566 },
                    new[] { 2.3622, 48.8666 },
                    new[] { 2.3522, 48.8566 },
                });

            var response = new LoopResponse(
                geometry,
                50000,
                12000,
                "faible",
                42,
                Array.Empty<RouteElevationPoint>());

            return Task.FromResult(response);
        }
    }
}
