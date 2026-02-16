using System.Net.Http.Json;
using System.Text.Json;

namespace BikeVoyager.Infrastructure.Pois;

internal static class OverpassResponseParser
{
    private static readonly JsonSerializerOptions SerializerOptions = new(JsonSerializerDefaults.Web);

    public static async Task<OverpassResponse> ParseAsync(
        HttpContent content,
        CancellationToken cancellationToken)
    {
        var payloadModel = await content.ReadFromJsonAsync<OverpassResponse>(
            SerializerOptions,
            cancellationToken);

        if (payloadModel is null)
        {
            return new OverpassResponse([]);
        }

        if (payloadModel.Elements is null)
        {
            return payloadModel with { Elements = [] };
        }

        return payloadModel;
    }
}
