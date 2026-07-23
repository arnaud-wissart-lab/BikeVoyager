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
                (ExportRouteRequest request, ILogger<global::Program> logger) =>
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

        exports.MapPost("/tcx",
                (ExportRouteRequest request, ILogger<global::Program> logger) =>
                {
                    if (!TcxExportBuilder.TryBuild(request, out var tcx, out var error))
                    {
                        logger.LogWarning("TcxExportInvalid {Error}", error);
                        return ApiProblemResults.Message(
                            StatusCodes.Status400BadRequest,
                            error ?? "Requête invalide.");
                    }

                    var fileName = TcxExportBuilder.BuildFileName(request.Name);
                    var payload = Encoding.UTF8.GetBytes(tcx);
                    return Results.File(payload, "application/vnd.garmin.tcx+xml", fileName);
                })
            .RequireRateLimiting("export")
            .WithName("ExportTcx");

        return endpoints;
    }
}
