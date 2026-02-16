using BikeVoyager.Api.Extensions;
using BikeVoyager.Application.Pois;
using BikeVoyager.Application.Routing;
using System.Text.Json;

namespace BikeVoyager.Api.Endpoints;

public static class PoiEndpoints
{
    private static readonly string[] AllowedPoiCategories = { "monuments", "paysages", "commerces", "services" };
    private const int DefaultPoiLimit = 5000;

    public static IEndpointRouteBuilder MapPoiEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var poi = endpoints.MapGroup("/api/poi");

        poi.MapGet("/around-route",
                async (string? geometry,
                    string? categories,
                    double? distance,
                    double? corridor,
                    string? language,
                    int? limit,
                    HttpContext httpContext,
                    IPoiService poiService,
                    ILogger<global::Program> logger,
                    CancellationToken cancellationToken) =>
                {
                    if (!PoiGeometryParser.TryParseGeometry(geometry, out var parsedGeometry, out var geometryError))
                    {
                        return ApiProblemResults.Message(
                            StatusCodes.Status400BadRequest,
                            geometryError);
                    }

                    var categoryList = ParseCategories(categories);
                    if (categories is not null && categoryList.Count == 0)
                    {
                        return ApiProblemResults.Message(
                            StatusCodes.Status400BadRequest,
                            "Les categories sont invalides. Valeurs autorisees: monuments, paysages, commerces, services.");
                    }

                    return await FetchPoisAroundRouteAsync(
                        parsedGeometry!,
                        categoryList,
                        distance,
                        corridor,
                        limit,
                        language,
                        httpContext,
                        poiService,
                        logger,
                        cancellationToken);
                })
            .RequireRateLimiting("compute-heavy")
            .WithName("PoiAroundRoute");

        poi.MapPost("/around-route",
                async (PoiAroundRoutePayload payload,
                    HttpContext httpContext,
                    IPoiService poiService,
                    ILogger<global::Program> logger,
                    CancellationToken cancellationToken) =>
                {
                    var geometryRaw = GetGeometryRaw(payload.Geometry);
                    if (!PoiGeometryParser.TryParseGeometry(geometryRaw, out var parsedGeometry, out var geometryError))
                    {
                        return ApiProblemResults.Message(
                            StatusCodes.Status400BadRequest,
                            geometryError);
                    }

                    var categoryList = ParseCategories(payload.Categories);
                    if (payload.Categories is { Length: > 0 } && categoryList.Count == 0)
                    {
                        return ApiProblemResults.Message(
                            StatusCodes.Status400BadRequest,
                            "Les categories sont invalides. Valeurs autorisees: monuments, paysages, commerces, services.");
                    }

                    return await FetchPoisAroundRouteAsync(
                        parsedGeometry!,
                        categoryList,
                        payload.Distance,
                        payload.Corridor,
                        payload.Limit,
                        payload.Language,
                        httpContext,
                        poiService,
                        logger,
                        cancellationToken);
                })
            .RequireRateLimiting("compute-heavy")
            .WithName("PoiAroundRoutePost");

        return endpoints;
    }

    private static async Task<IResult> FetchPoisAroundRouteAsync(
        GeoJsonLineString geometry,
        IReadOnlyList<string> categoryList,
        double? distance,
        double? corridor,
        int? limit,
        string? language,
        HttpContext httpContext,
        IPoiService poiService,
        Microsoft.Extensions.Logging.ILogger logger,
        CancellationToken cancellationToken)
    {
        var corridorMeters = Math.Clamp(distance ?? corridor ?? 800, 50, 5000);
        var safeLimit = Math.Clamp(limit ?? DefaultPoiLimit, 1, DefaultPoiLimit);
        var preferredLanguage = ResolvePoiLanguage(
            language,
            httpContext.Request.Headers.AcceptLanguage.ToString());
        var request = new PoiAroundRouteRequest(
            geometry,
            categoryList,
            corridorMeters,
            safeLimit,
            preferredLanguage);

        try
        {
            var results = await poiService.AroundRouteAsync(request, cancellationToken);

            logger.LogInformation(
                "PoiFetched {Count} {Categories} {CorridorMeters}m {Language}",
                results.Count,
                categoryList.Count == 0 ? "default" : string.Join(',', categoryList),
                corridorMeters,
                preferredLanguage ?? "auto");

            return Results.Ok(results);
        }
        catch (TaskCanceledException ex)
        {
            logger.LogWarning(ex, "Timeout Overpass.");
            return ApiProblemResults.Message(
                StatusCodes.Status504GatewayTimeout,
                "Le service POI a mis trop de temps à répondre.");
        }
        catch (HttpRequestException ex)
        {
            logger.LogWarning(ex, "Echec de l'appel Overpass.");
            return ApiProblemResults.Message(
                StatusCodes.Status502BadGateway,
                "Le service POI est temporairement indisponible.");
        }
        catch (InvalidOperationException ex)
        {
            logger.LogWarning(ex, "Reponse Overpass invalide.");
            return ApiProblemResults.Message(
                StatusCodes.Status502BadGateway,
                "Le service POI a retourné une réponse invalide.");
        }
        catch (JsonException ex)
        {
            logger.LogWarning(ex, "Reponse Overpass non lisible.");
            return ApiProblemResults.Message(
                StatusCodes.Status502BadGateway,
                "Le service POI a retourné une réponse illisible.");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Erreur inattendue lors du chargement des POI.");
            return ApiProblemResults.Message(
                StatusCodes.Status500InternalServerError,
                "Erreur interne lors du chargement des POI.");
        }
    }

    private static string? GetGeometryRaw(JsonElement geometry)
    {
        if (geometry.ValueKind is JsonValueKind.Undefined or JsonValueKind.Null)
        {
            return null;
        }

        return geometry.ValueKind == JsonValueKind.String
            ? geometry.GetString()
            : geometry.GetRawText();
    }

    private static IReadOnlyList<string> ParseCategories(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return Array.Empty<string>();
        }

        return raw.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(category => AllowedPoiCategories.Contains(category, StringComparer.OrdinalIgnoreCase))
            .Select(category => category.ToLowerInvariant())
            .Distinct()
            .ToList();
    }

    private static IReadOnlyList<string> ParseCategories(string[]? raw)
    {
        if (raw is null || raw.Length == 0)
        {
            return Array.Empty<string>();
        }

        return raw
            .Where(category => !string.IsNullOrWhiteSpace(category))
            .Select(category => category.Trim())
            .Where(category => AllowedPoiCategories.Contains(category, StringComparer.OrdinalIgnoreCase))
            .Select(category => category.ToLowerInvariant())
            .Distinct()
            .ToList();
    }

    private static string? ResolvePoiLanguage(string? requestedLanguage, string? acceptLanguage)
    {
        var normalizedRequested = NormalizePoiLanguage(requestedLanguage);
        if (normalizedRequested is not null)
        {
            return normalizedRequested;
        }

        if (string.IsNullOrWhiteSpace(acceptLanguage))
        {
            return null;
        }

        var segments = acceptLanguage.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        foreach (var segment in segments)
        {
            var token = segment.Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)[0];
            var normalized = NormalizePoiLanguage(token);
            if (normalized is not null)
            {
                return normalized;
            }
        }

        return null;
    }

    private static string? NormalizePoiLanguage(string? language)
    {
        if (string.IsNullOrWhiteSpace(language))
        {
            return null;
        }

        var trimmed = language.Trim();
        if (trimmed.StartsWith("fr", StringComparison.OrdinalIgnoreCase))
        {
            return "fr";
        }

        if (trimmed.StartsWith("en", StringComparison.OrdinalIgnoreCase))
        {
            return "en";
        }

        return null;
    }

    private sealed record PoiAroundRoutePayload(
        JsonElement Geometry,
        string[]? Categories,
        double? Distance,
        double? Corridor,
        string? Language,
        int? Limit);
}
