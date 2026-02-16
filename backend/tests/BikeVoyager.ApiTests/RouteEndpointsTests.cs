using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using BikeVoyager.Application.Routing;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace BikeVoyager.ApiTests;

public class RouteEndpointsTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly StubRouteService _stubRouteService;

    public RouteEndpointsTests(WebApplicationFactory<Program> factory)
    {
        _stubRouteService = new StubRouteService();
        _factory = factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                services.RemoveAll<IRouteService>();
                services.AddSingleton<IRouteService>(_stubRouteService);
            });
        });
    }

    [Fact]
    public async Task Route_retourne_un_itineraire()
    {
        using var client = _factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/route", new
        {
            from = new { lat = 48.8566, lon = 2.3522, label = "Paris" },
            to = new { lat = 48.8584, lon = 2.2945, label = "Tour Eiffel" },
            mode = "walking",
            options = new { preferCycleways = true, avoidHills = false },
            speedKmh = 5,
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var json = await response.Content.ReadAsStringAsync();
        using var document = JsonDocument.Parse(json);

        Assert.Equal("LineString", document.RootElement.GetProperty("geometry").GetProperty("type").GetString());
        Assert.Equal(1500, document.RootElement.GetProperty("distance_m").GetDouble());
        Assert.Equal(600, document.RootElement.GetProperty("duration_s_engine").GetDouble());
        Assert.Equal(720, document.RootElement.GetProperty("eta_s").GetDouble());
    }

    [Fact]
    public async Task Route_transmet_le_flag_optimize_waypoints()
    {
        using var client = _factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/route", new
        {
            from = new { lat = 48.8566, lon = 2.3522, label = "Paris" },
            to = new { lat = 48.8584, lon = 2.2945, label = "Tour Eiffel" },
            waypoints = new[]
            {
                new { lat = 48.8570, lon = 2.3400, label = "W1" },
            },
            optimizeWaypoints = false,
            mode = "walking",
            options = new { preferCycleways = true, avoidHills = false },
            speedKmh = 5,
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(_stubRouteService.LastRequest);
        Assert.False(_stubRouteService.LastRequest!.OptimizeWaypoints);
    }

    [Fact]
    public async Task Route_transmet_le_niveau_assistance_vae()
    {
        using var client = _factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/route", new
        {
            from = new { lat = 48.8566, lon = 2.3522, label = "Paris" },
            to = new { lat = 48.8584, lon = 2.2945, label = "Tour Eiffel" },
            mode = "ebike",
            options = new { preferCycleways = true, avoidHills = false },
            speedKmh = 20,
            ebikeAssist = "high",
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(_stubRouteService.LastRequest);
        Assert.Equal("high", _stubRouteService.LastRequest!.EbikeAssist);
    }

    [Fact]
    public async Task Route_refuse_un_mode_invalide()
    {
        using var client = _factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/route", new
        {
            from = new { lat = 48.8566, lon = 2.3522, label = "Paris" },
            to = new { lat = 48.8584, lon = 2.2945, label = "Tour Eiffel" },
            mode = "plane",
            options = new { preferCycleways = true, avoidHills = false },
            speedKmh = 5,
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Route_retourne_503_si_valhalla_non_pret()
    {
        var tempValhallaDataPath = Path.Combine(Path.GetTempPath(), "bikevoyager-tests", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(Path.Combine(tempValhallaDataPath, "tiles"));

        var app = _factory.WithWebHostBuilder(builder =>
        {
            builder.UseSetting("Valhalla:DataPath", tempValhallaDataPath);
            builder.UseSetting("Valhalla:BaseUrl", "http://127.0.0.1:1");
        });

        using var client = app.CreateClient();
        using var response = await client.PostAsJsonAsync("/api/route", new
        {
            from = new { lat = 48.8566, lon = 2.3522, label = "Paris" },
            to = new { lat = 48.8584, lon = 2.2945, label = "Tour Eiffel" },
            mode = "walking",
            options = new { preferCycleways = true, avoidHills = false },
            speedKmh = 5,
        });

        var payload = await response.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        Assert.Contains("moteur d'itinéraire n'est pas prêt", payload);
    }

    private sealed class StubRouteService : IRouteService
    {
        public RouteRequest? LastRequest { get; private set; }

        public Task<RouteResponse> ComputeAsync(RouteRequest request, CancellationToken cancellationToken)
        {
            LastRequest = request;
            var geometry = new GeoJsonLineString(
                "LineString",
                new List<double[]>
                {
                    new[] { 2.3522, 48.8566 },
                    new[] { 2.2945, 48.8584 },
                });

            var response = new RouteResponse(
                geometry,
                1500,
                600,
                720,
                new List<RouteInstruction>
                {
                    new("Continuer tout droit", 500, 200, 1),
                    new("Tourner a droite", 1000, 400, 2),
                },
                Array.Empty<RouteElevationPoint>());

            return Task.FromResult(response);
        }
    }
}
