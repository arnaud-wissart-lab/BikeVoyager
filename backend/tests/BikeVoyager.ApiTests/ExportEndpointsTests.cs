using Microsoft.AspNetCore.Mvc.Testing;
using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using System.Xml.Linq;

namespace BikeVoyager.ApiTests;

public class ExportEndpointsTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public ExportEndpointsTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    [Theory]
    [InlineData("gpx", "application/gpx+xml", ".gpx")]
    [InlineData("tcx", "application/vnd.garmin.tcx+xml", ".tcx")]
    public async Task Export_route_retourne_un_fichier_compatible(
        string format,
        string contentType,
        string extension)
    {
        using var client = _factory.CreateClient();
        using var response = await client.PostAsJsonAsync($"/api/v1/export/{format}", CreateRequest());

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(contentType, response.Content.Headers.ContentType?.MediaType);
        Assert.EndsWith(
            extension,
            response.Content.Headers.ContentDisposition?.FileName?.Trim('"'),
            StringComparison.OrdinalIgnoreCase);
        Assert.NotEmpty(await response.Content.ReadAsByteArrayAsync());
    }

    [Fact]
    public async Task Export_tcx_conserve_la_geometrie_la_distance_et_altitude()
    {
        using var client = _factory.CreateClient();
        using var response = await client.PostAsJsonAsync("/api/v1/export/tcx", CreateRequest());
        var payload = await response.Content.ReadAsStringAsync();
        var document = XDocument.Parse(payload);
        XNamespace tcx = "http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2";
        var points = document.Descendants(tcx + "Trackpoint").ToList();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("Trajet test", document.Descendants(tcx + "Name").Single().Value);
        Assert.Equal(2, points.Count);
        Assert.Equal(
            48.85,
            double.Parse(
                points[0].Descendants(tcx + "LatitudeDegrees").Single().Value,
                CultureInfo.InvariantCulture),
            precision: 6);
        Assert.Equal(
            2.35,
            double.Parse(
                points[0].Descendants(tcx + "LongitudeDegrees").Single().Value,
                CultureInfo.InvariantCulture),
            precision: 6);
        Assert.Equal(
            100,
            double.Parse(
                points[0].Element(tcx + "AltitudeMeters")!.Value,
                CultureInfo.InvariantCulture),
            precision: 2);
        Assert.Equal(
            0,
            double.Parse(
                points[0].Element(tcx + "DistanceMeters")!.Value,
                CultureInfo.InvariantCulture),
            precision: 2);
        Assert.True(
            double.Parse(
                points[1].Element(tcx + "DistanceMeters")!.Value,
                CultureInfo.InvariantCulture) > 0);
    }

    private static object CreateRequest() => new
    {
        geometry = new
        {
            type = "LineString",
            coordinates = new[]
            {
                new[] { 2.35, 48.85 },
                new[] { 2.36, 48.86 },
            },
        },
        elevation_profile = new[]
        {
            new
            {
                distance_m = 0,
                elevation_m = 100,
            },
            new
            {
                distance_m = 2000,
                elevation_m = 120,
            },
        },
        name = "Trajet test",
    };
}
