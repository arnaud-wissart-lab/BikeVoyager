using BikeVoyager.Infrastructure.Pois;
using System.Text;
using System.Text.Json;

namespace BikeVoyager.UnitTests;

public class OverpassResponseParserTests
{
    [Fact]
    public async Task ParseAsync_ParseUneReponseTypique()
    {
        var content = new StringContent(
            """
            {
              "elements": [
                {
                  "type": "node",
                  "id": 42,
                  "lat": 48.85837,
                  "lon": 2.29448,
                  "tags": {
                    "name": "Tour Eiffel",
                    "tourism": "attraction"
                  }
                }
              ]
            }
            """,
            Encoding.UTF8,
            "application/json");

        var response = await OverpassResponseParser.ParseAsync(content, CancellationToken.None);

        Assert.NotNull(response.Elements);
        var element = Assert.Single(response.Elements!);
        Assert.Equal("node", element.Type);
        Assert.Equal(42, element.Id);
        Assert.Equal(48.85837, element.Lat);
        Assert.Equal(2.29448, element.Lon);
        Assert.NotNull(element.Tags);
        Assert.Equal("Tour Eiffel", element.Tags!["name"]);
    }

    [Fact]
    public async Task ParseAsync_RetourneUneListeVideQuandElementsEstAbsent()
    {
        var content = new StringContent("{}", Encoding.UTF8, "application/json");

        var response = await OverpassResponseParser.ParseAsync(content, CancellationToken.None);

        Assert.NotNull(response.Elements);
        Assert.Empty(response.Elements!);
    }

    [Fact]
    public async Task ParseAsync_LeveUneExceptionQuandLeJsonEstMalforme()
    {
        var content = new StringContent("{\"elements\":[", Encoding.UTF8, "application/json");

        await Assert.ThrowsAsync<JsonException>(
            () => OverpassResponseParser.ParseAsync(content, CancellationToken.None));
    }
}
