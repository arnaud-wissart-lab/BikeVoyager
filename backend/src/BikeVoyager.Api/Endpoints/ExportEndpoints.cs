using BikeVoyager.Api.Exports;
using BikeVoyager.Api.Extensions;
using System.Text;

namespace BikeVoyager.Api.Endpoints;

public static class ExportEndpoints
{
    public static IEndpointRouteBuilder MapExportEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var exports = endpoints.MapGroup("/api/v1/export");

        exports.MapPost("/gpx",
                (ExportGpxRequest request, ILogger<global::Program> logger) =>
                {
                    if (!GpxExportBuilder.TryBuild(request, out var gpx, out var error))
                    {
                        logger.LogWarning("GpxExportInvalid {Error}", error);
                        return ApiProblemResults.Message(
                            StatusCodes.Status400BadRequest,
                            error ?? "Requête invalide.");
                    }

                    var fileName = GpxExportBuilder.BuildFileName(request.Name);
                    var payload = Encoding.UTF8.GetBytes(gpx);
                    return Results.File(payload, "application/gpx+xml", fileName);
                })
            .RequireRateLimiting("export")
            .WithName("ExportGpx");

        return endpoints;
    }
}
