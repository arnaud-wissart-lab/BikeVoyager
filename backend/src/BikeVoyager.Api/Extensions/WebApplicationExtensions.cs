using BikeVoyager.Api.Cloud;
using BikeVoyager.Api.Endpoints;
using BikeVoyager.Api.Feedback;
using BikeVoyager.Api.Valhalla;
using Serilog;

namespace BikeVoyager.Api.Extensions;

public static class WebApplicationExtensions
{
    public static WebApplication UseApiPipeline(this WebApplication app, ApiBootstrapOptions options)
    {
        app.UseRouting();

        app.UseCorrelationId();
        app.UseSerilogRequestLogging();
        app.UseExceptionHandler();
        app.UseStatusCodePages();

        if (app.Environment.IsDevelopment())
        {
            app.MapOpenApi();
        }
        else
        {
            app.UseHsts();
            app.UseApiSecurityHeaders();
            app.UseHttpsRedirection();
        }

        if (options.AllowedOrigins.Length > 0)
        {
            app.UseCors("FrontApp");
        }

        app.UseAnonymousApiSession();
        app.UseApiOriginGuard();
        app.UseRateLimiter();

        return app;
    }

    public static WebApplication MapRouteGroups(this WebApplication app, ApiBootstrapOptions options)
    {
        app.MapPlacesEndpoints();
        app.MapPoiEndpoints();
        app.MapRouteEndpoints(options.ValhallaDataPath);
        app.MapLoopEndpoints(options.ValhallaDataPath);
        app.MapExportEndpoints();
        app.MapCloudEndpoints();
        app.MapFeedbackEndpoints();
        app.MapValhallaEndpoints(options.ValhallaDataPath, options.ValhallaBaseUrl);
        app.MapHealthEndpoints();

        return app;
    }

    public static WebApplication MapEndpoints(this WebApplication app, ApiBootstrapOptions options)
    {
        return app.MapRouteGroups(options);
    }
}
