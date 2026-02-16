using BikeVoyager.Application.Pois;
using BikeVoyager.Application.Routing;
using BikeVoyager.Infrastructure.Pois;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Logging.Abstractions;
using System.Net;
using System.Text;
using System.Text.Json;

namespace BikeVoyager.UnitTests;

public class OverpassPoiServiceTests
{
    [Fact]
    public async Task AroundRoute_TrieLesPoisParDistanceLeLongDuTrace()
    {
        const string overpassPayload = """
            {
              "elements": [
                {
                  "type": "node",
                  "id": 1,
                  "lat": 0.0001,
                  "lon": 0.0001,
                  "tags": {
                    "name": "Start Cafe",
                    "amenity": "cafe"
                  }
                },
                {
                  "type": "node",
                  "id": 2,
                  "lat": 0.0001,
                  "lon": 0.0199,
                  "tags": {
                    "name": "End Cafe",
                    "amenity": "cafe"
                  }
                }
              ]
            }
            """;

        using var http = new HttpClient(new StaticJsonHandler(overpassPayload))
        {
            BaseAddress = new Uri("https://overpass-api.de/api/"),
        };
        using var memoryCache = new MemoryCache(new MemoryCacheOptions());

        var service = new OverpassPoiService(
            http,
            memoryCache,
            distributedCache: null,
            Options.Create(new OverpassOptions()),
            NullLogger<OverpassPoiService>.Instance);

        var route = new GeoJsonLineString(
            "LineString",
            new List<double[]>
            {
                new[] { 0.0, 0.0 },
                new[] { 0.02, 0.0 },
            });

        var items = await service.AroundRouteAsync(
            new PoiAroundRouteRequest(route, new[] { "services" }, CorridorMeters: 500, Limit: 10),
            CancellationToken.None);

        Assert.Equal(2, items.Count);
        Assert.Equal("Start Cafe", items[0].Name);
        Assert.Equal("End Cafe", items[1].Name);
        Assert.True(items[0].DistanceMeters < items[1].DistanceMeters);
    }

    [Fact]
    public async Task AroundRoute_PrioriseLeNomLocaliseSelonLaLangue()
    {
        const string overpassPayload = """
            {
              "elements": [
                {
                  "type": "node",
                  "id": 42,
                  "lat": 48.85837,
                  "lon": 2.29448,
                  "tags": {
                    "name": "Eiffel Tower",
                    "name:fr": "Tour Eiffel",
                    "tourism": "attraction"
                  }
                }
              ]
            }
            """;

        using var http = new HttpClient(new StaticJsonHandler(overpassPayload))
        {
            BaseAddress = new Uri("https://overpass-api.de/api/"),
        };
        using var memoryCache = new MemoryCache(new MemoryCacheOptions());

        var service = new OverpassPoiService(
            http,
            memoryCache,
            distributedCache: null,
            Options.Create(new OverpassOptions()),
            NullLogger<OverpassPoiService>.Instance);

        var route = new GeoJsonLineString(
            "LineString",
            new List<double[]>
            {
                new[] { 2.29300, 48.85750 },
                new[] { 2.29600, 48.85920 },
            });

        var french = await service.AroundRouteAsync(
            new PoiAroundRouteRequest(route, new[] { "monuments" }, CorridorMeters: 600, Limit: 10, Language: "fr"),
            CancellationToken.None);

        var english = await service.AroundRouteAsync(
            new PoiAroundRouteRequest(route, new[] { "monuments" }, CorridorMeters: 600, Limit: 10, Language: "en"),
            CancellationToken.None);

        Assert.Single(french);
        Assert.Single(english);
        Assert.Equal("Tour Eiffel", french[0].Name);
        Assert.Equal("Eiffel Tower", english[0].Name);
        Assert.Equal("node", french[0].OsmType);
        Assert.Equal(42, french[0].OsmId);
        Assert.NotNull(french[0].Tags);
        Assert.Equal("Tour Eiffel", french[0].Tags!["name:fr"]);
    }

    [Fact]
    public async Task AroundRoute_NeTronquePasALaLimiteHistoriqueDe120()
    {
        var elements = new List<object>();
        for (var index = 0; index < 130; index += 1)
        {
            elements.Add(new
            {
                type = "node",
                id = index + 1,
                lat = 0.0001,
                lon = 0.0001 + (index * 0.0001),
                tags = new Dictionary<string, string>
                {
                    ["name"] = $"Cafe {index + 1}",
                    ["amenity"] = "cafe",
                },
            });
        }

        var overpassPayload = JsonSerializer.Serialize(new { elements });

        using var http = new HttpClient(new StaticJsonHandler(overpassPayload))
        {
            BaseAddress = new Uri("https://overpass-api.de/api/"),
        };
        using var memoryCache = new MemoryCache(new MemoryCacheOptions());

        var service = new OverpassPoiService(
            http,
            memoryCache,
            distributedCache: null,
            Options.Create(new OverpassOptions()),
            NullLogger<OverpassPoiService>.Instance);

        var route = new GeoJsonLineString(
            "LineString",
            new List<double[]>
            {
                new[] { 0.0, 0.0 },
                new[] { 0.02, 0.0 },
            });

        var items = await service.AroundRouteAsync(
            new PoiAroundRouteRequest(route, new[] { "services" }, CorridorMeters: 500, Limit: 5000),
            CancellationToken.None);

        Assert.Equal(130, items.Count);
    }

    [Fact]
    public async Task AroundRoute_UtiliseLaGeometrieDesWaysPourLeFiltrageEtLePointAffiche()
    {
        const string overpassPayload = """
            {
              "elements": [
                {
                  "type": "way",
                  "id": 500,
                  "center": {
                    "lat": 0.0500,
                    "lon": 0.0500
                  },
                  "geometry": [
                    { "lat": 0.00020, "lon": 0.00520 },
                    { "lat": 0.00020, "lon": 0.00590 }
                  ],
                  "tags": {
                    "name": "River Side Cafe",
                    "amenity": "cafe"
                  }
                }
              ]
            }
            """;

        using var http = new HttpClient(new StaticJsonHandler(overpassPayload))
        {
            BaseAddress = new Uri("https://overpass-api.de/api/"),
        };
        using var memoryCache = new MemoryCache(new MemoryCacheOptions());

        var service = new OverpassPoiService(
            http,
            memoryCache,
            distributedCache: null,
            Options.Create(new OverpassOptions()),
            NullLogger<OverpassPoiService>.Instance);

        var route = new GeoJsonLineString(
            "LineString",
            new List<double[]>
            {
                new[] { 0.0, 0.0 },
                new[] { 0.02, 0.0 },
            });

        var items = await service.AroundRouteAsync(
            new PoiAroundRouteRequest(route, new[] { "services" }, CorridorMeters: 500, Limit: 5000),
            CancellationToken.None);

        Assert.Single(items);
        var poi = items[0];
        Assert.Equal("way/500", poi.Id);
        Assert.True(poi.DistanceToRouteMeters < 500);
        Assert.InRange(poi.Lat, 0.00015, 0.00025);
        Assert.InRange(poi.Lon, 0.00515, 0.00595);
    }

    [Fact]
    public async Task AroundRoute_FusionneLesDoublonsSemantiquesProches()
    {
        const string overpassPayload = """
            {
              "elements": [
                {
                  "type": "node",
                  "id": 101,
                  "lat": 0.00035,
                  "lon": 0.01000,
                  "tags": {
                    "name": "NIVEAU DU GLACIER",
                    "historic": "memorial"
                  }
                },
                {
                  "type": "way",
                  "id": 202,
                  "center": {
                    "lat": 0.00008,
                    "lon": 0.01005
                  },
                  "geometry": [
                    { "lat": 0.00008, "lon": 0.00995 },
                    { "lat": 0.00008, "lon": 0.01015 }
                  ],
                  "tags": {
                    "name": "Niveau du glacier",
                    "historic": "memorial",
                    "wikipedia": "fr:Niveau du Glacier"
                  }
                }
              ]
            }
            """;

        using var http = new HttpClient(new StaticJsonHandler(overpassPayload))
        {
            BaseAddress = new Uri("https://overpass-api.de/api/"),
        };
        using var memoryCache = new MemoryCache(new MemoryCacheOptions());

        var service = new OverpassPoiService(
            http,
            memoryCache,
            distributedCache: null,
            Options.Create(new OverpassOptions()),
            NullLogger<OverpassPoiService>.Instance);

        var route = new GeoJsonLineString(
            "LineString",
            new List<double[]>
            {
                new[] { 0.0, 0.0 },
                new[] { 0.02, 0.0 },
            });

        var items = await service.AroundRouteAsync(
            new PoiAroundRouteRequest(route, new[] { "monuments" }, CorridorMeters: 500, Limit: 20),
            CancellationToken.None);

        Assert.Single(items);
        Assert.Equal("way/202", items[0].Id);
        Assert.Equal("Niveau du glacier", items[0].Name);
    }

    [Fact]
    public async Task AroundRoute_ConserveLesHomonymesEloignesLeLongDuTrace()
    {
        const string overpassPayload = """
            {
              "elements": [
                {
                  "type": "node",
                  "id": 301,
                  "lat": 0.00005,
                  "lon": 0.00200,
                  "tags": {
                    "name": "Belvedere",
                    "tourism": "viewpoint"
                  }
                },
                {
                  "type": "node",
                  "id": 302,
                  "lat": 0.00005,
                  "lon": 0.01800,
                  "tags": {
                    "name": "Belvedere",
                    "tourism": "viewpoint"
                  }
                }
              ]
            }
            """;

        using var http = new HttpClient(new StaticJsonHandler(overpassPayload))
        {
            BaseAddress = new Uri("https://overpass-api.de/api/"),
        };
        using var memoryCache = new MemoryCache(new MemoryCacheOptions());

        var service = new OverpassPoiService(
            http,
            memoryCache,
            distributedCache: null,
            Options.Create(new OverpassOptions()),
            NullLogger<OverpassPoiService>.Instance);

        var route = new GeoJsonLineString(
            "LineString",
            new List<double[]>
            {
                new[] { 0.0, 0.0 },
                new[] { 0.02, 0.0 },
            });

        var items = await service.AroundRouteAsync(
            new PoiAroundRouteRequest(route, new[] { "paysages" }, CorridorMeters: 500, Limit: 20),
            CancellationToken.None);

        Assert.Equal(2, items.Count);
    }

    private sealed class StaticJsonHandler : HttpMessageHandler
    {
        private readonly string _payload;

        public StaticJsonHandler(string payload)
        {
            _payload = payload;
        }

        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            var response = new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(_payload, Encoding.UTF8, "application/json"),
            };

            return Task.FromResult(response);
        }
    }
}
