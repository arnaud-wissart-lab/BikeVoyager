using BikeVoyager.Api.Middleware;
using BikeVoyager.Api.Security;

namespace BikeVoyager.Api.Extensions;

public static class ApplicationBuilderExtensions
{
    public static IApplicationBuilder UseCorrelationId(this IApplicationBuilder app)
    {
        return app.UseMiddleware<CorrelationIdMiddleware>();
    }

    public static IApplicationBuilder UseApiOriginGuard(this IApplicationBuilder app)
    {
        return app.UseMiddleware<ApiOriginGuardMiddleware>();
    }

    public static IApplicationBuilder UseAnonymousApiSession(this IApplicationBuilder app)
    {
        return app.UseMiddleware<AnonymousApiSessionMiddleware>();
    }
}
