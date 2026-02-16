using BikeVoyager.Application.Routing;
using Microsoft.Extensions.Logging;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace BikeVoyager.Infrastructure.Routing;

internal static class ValhallaElevationProfileService
{
    public static async Task<IReadOnlyList<RouteElevationPoint>> TryBuildAsync(
        HttpClient httpClient,
        JsonSerializerOptions serializerOptions,
        IReadOnlyList<double[]> geometryCoordinates,
        ILogger logger,
        CancellationToken cancellationToken)
    {
        var shape = BuildShape(geometryCoordinates);
        if (shape.Count < 2)
        {
            return Array.Empty<RouteElevationPoint>();
        }

        try
        {
            using var response = await httpClient.PostAsJsonAsync(
                "height",
                new ValhallaHeightRequest(shape),
                serializerOptions,
                cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                var payload = await response.Content.ReadAsStringAsync(cancellationToken);
                logger.LogWarning(
                    "Valhalla elevation a répondu {StatusCode} : {Payload}",
                    (int)response.StatusCode,
                    payload);
                return Array.Empty<RouteElevationPoint>();
            }

            var payloadModel = await response.Content.ReadFromJsonAsync<ValhallaHeightResponse>(
                serializerOptions,
                cancellationToken);
            if (payloadModel?.RangeHeight is null || payloadModel.RangeHeight.Count == 0)
            {
                return Array.Empty<RouteElevationPoint>();
            }

            var profile = new List<RouteElevationPoint>(payloadModel.RangeHeight.Count);
            foreach (var sample in payloadModel.RangeHeight)
            {
                if (sample is null || sample.Length < 2)
                {
                    continue;
                }

                var distance = sample[0];
                var elevation = sample[1];
                if (distance is null || elevation is null)
                {
                    continue;
                }

                if (!double.IsFinite(distance.Value) || !double.IsFinite(elevation.Value))
                {
                    continue;
                }

                profile.Add(new RouteElevationPoint(distance.Value, elevation.Value));
            }

            if (profile.Count < 2)
            {
                return Array.Empty<RouteElevationPoint>();
            }

            profile.Sort((left, right) => left.DistanceMeters.CompareTo(right.DistanceMeters));
            return profile;
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            logger.LogDebug("Valhalla elevation timeout/interruption.");
            return Array.Empty<RouteElevationPoint>();
        }
        catch (Exception ex) when (ex is HttpRequestException or JsonException or InvalidOperationException)
        {
            logger.LogWarning(ex, "Valhalla elevation indisponible.");
            return Array.Empty<RouteElevationPoint>();
        }
    }

    private static List<ValhallaHeightPoint> BuildShape(IReadOnlyList<double[]> geometryCoordinates)
    {
        var shape = new List<ValhallaHeightPoint>(geometryCoordinates.Count);
        foreach (var coordinate in geometryCoordinates)
        {
            if (coordinate.Length < 2)
            {
                continue;
            }

            var lon = coordinate[0];
            var lat = coordinate[1];
            if (!double.IsFinite(lat) || !double.IsFinite(lon))
            {
                continue;
            }

            shape.Add(new ValhallaHeightPoint(lat, lon));
        }

        return shape;
    }

    private sealed record ValhallaHeightRequest(
        [property: JsonPropertyName("shape")] IReadOnlyList<ValhallaHeightPoint> Shape,
        [property: JsonPropertyName("range")] bool IncludeRange = true);

    private sealed record ValhallaHeightPoint(
        [property: JsonPropertyName("lat")] double Lat,
        [property: JsonPropertyName("lon")] double Lon);

    private sealed record ValhallaHeightResponse(
        [property: JsonPropertyName("range_height")] List<double?[]>? RangeHeight);
}
