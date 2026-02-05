using BikeVoyager.Api.Middleware;

namespace BikeVoyager.Api.Extensions;

public static class ApplicationBuilderExtensions
{
    public static IApplicationBuilder UseCorrelationId(this IApplicationBuilder app)
    {
        return app.UseMiddleware<CorrelationIdMiddleware>();
    }
}
