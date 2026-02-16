using BikeVoyager.Api.Extensions;
using BikeVoyager.Application.Geocoding;

namespace BikeVoyager.Api.Endpoints;

public static class PlacesEndpoints
{
    public static IEndpointRouteBuilder MapPlacesEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var places = endpoints.MapGroup("/api/places");

        places.MapGet("/search",
                async (string? q, int? limit, string? mode, IGeocodingService geocoding, CancellationToken cancellationToken) =>
                {
                    if (string.IsNullOrWhiteSpace(q) || q.Trim().Length < 2)
                    {
                        return ApiProblemResults.Message(
                            StatusCodes.Status400BadRequest,
                            "Le paramètre 'q' est obligatoire (minimum 2 caractères).");
                    }

                    var resolvedLimit = Math.Clamp(limit ?? 8, 1, 20);
                    var searchMode = GeocodingSearchMode.Auto;
                    if (!string.IsNullOrWhiteSpace(mode)
                        && Enum.TryParse<GeocodingSearchMode>(mode, true, out var parsedMode))
                    {
                        searchMode = parsedMode;
                    }

                    var results = await geocoding.SearchAsync(q, resolvedLimit, searchMode, cancellationToken);
                    return Results.Ok(results);
                })
            .WithName("SearchPlaces");

        places.MapGet("/reverse",
                async (double? lat, double? lon, IGeocodingService geocoding, CancellationToken cancellationToken) =>
                {
                    if (lat is null || lon is null)
                    {
                        return ApiProblemResults.Message(
                            StatusCodes.Status400BadRequest,
                            "Les paramètres 'lat' et 'lon' sont obligatoires.");
                    }

                    if (lat is < -90 or > 90 || lon is < -180 or > 180)
                    {
                        return ApiProblemResults.Message(
                            StatusCodes.Status400BadRequest,
                            "Les paramètres 'lat' et 'lon' sont invalides.");
                    }

                    var result = await geocoding.ReverseAsync(lat.Value, lon.Value, cancellationToken);
                    return result is null ? Results.NotFound() : Results.Ok(result);
                })
            .WithName("ReversePlace");

        return endpoints;
    }
}
