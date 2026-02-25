using BikeVoyager.Api.Cloud;
using BikeVoyager.Api.Cloud.OAuth;
using BikeVoyager.Api.Cloud.Providers;
using BikeVoyager.Api.Health;
using BikeVoyager.Api.Feedback;
using BikeVoyager.Api.Middleware;
using BikeVoyager.Api.Security;
using BikeVoyager.Api.Valhalla;
using BikeVoyager.Application.Trips;
using FluentValidation;
using Microsoft.AspNetCore.RateLimiting;
using System.Text.Json;
using System.Threading.RateLimiting;

namespace BikeVoyager.Api.Extensions;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddValidatorsFromAssemblyContaining<CreateTripRequestValidator>();
        return services;
    }

    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        BikeVoyager.Infrastructure.DependencyInjection.AddInfrastructure(services, configuration);
        return services;
    }

    public static ApiBootstrapOptions AddApi(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddProblemDetails(options =>
        {
            options.CustomizeProblemDetails = context =>
            {
                var correlationId = context.HttpContext.Response.Headers[CorrelationIdMiddleware.HeaderName].FirstOrDefault()
                    ?? context.HttpContext.TraceIdentifier;
                context.ProblemDetails.Extensions["correlationId"] = correlationId;
            };
        });

        services.AddEndpointsApiExplorer();
        services.AddOpenApi();
        services.AddDataProtection();
        services.AddSingleton<ApiHealthStatusService>();

        services.Configure<CloudSyncOptions>(configuration.GetSection("CloudSync"));
        services.AddSingleton<TimeProvider>(TimeProvider.System);
        services.AddSingleton<ICloudSessionStore, CloudSessionStore>();
        services.AddSingleton<ICloudOAuthCrypto, CloudOAuthCrypto>();
        services.AddSingleton<ICloudOAuthFlowService, CloudOAuthFlowService>();
        services.AddSingleton<ICloudOAuthRedirectPolicy, CloudOAuthRedirectPolicy>();
        services.AddScoped<ICloudSessionCookies, CloudSessionCookies>();
        services.AddScoped<CloudSyncEndpointHandlers>();
        services.AddHttpClient<IValhallaProbeClient, ValhallaProbeClient>(client =>
        {
            client.Timeout = TimeSpan.FromSeconds(2);
        });
        services.AddHttpClient<GoogleDriveCloudProviderClient>(client =>
        {
            client.Timeout = TimeSpan.FromSeconds(25);
        });
        services.AddHttpClient<OneDriveCloudProviderClient>(client =>
        {
            client.Timeout = TimeSpan.FromSeconds(25);
        });
        services.AddTransient<ICloudProviderClient>(sp => sp.GetRequiredService<GoogleDriveCloudProviderClient>());
        services.AddTransient<ICloudProviderClient>(sp => sp.GetRequiredService<OneDriveCloudProviderClient>());
        services.AddSingleton<ICloudProviderClientResolver, CloudProviderClientResolver>();
        services.AddTransient<CloudSyncService>();

        services.Configure<FeedbackOptions>(configuration.GetSection("Feedback"));
        services.AddSingleton<IFeedbackSender, FeedbackEmailSender>();

        services.Configure<ApiSecurityOptions>(configuration.GetSection("ApiSecurity"));
        var apiSecurity = configuration
            .GetSection("ApiSecurity")
            .Get<ApiSecurityOptions>() ?? new ApiSecurityOptions();
        var allowedOrigins = NormalizeAllowedOrigins(apiSecurity.AllowedOrigins);

        if (allowedOrigins.Length > 0)
        {
            services.AddCors(options =>
            {
                options.AddPolicy("FrontApp", policy =>
                {
                    policy.WithOrigins(allowedOrigins)
                        .AllowAnyHeader()
                        .AllowAnyMethod()
                        .AllowCredentials();
                });
            });
        }

        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            options.OnRejected = async (context, cancellationToken) =>
            {
                context.HttpContext.Response.ContentType = "application/json";
                await context.HttpContext.Response.WriteAsync(
                    JsonSerializer.Serialize(new
                    {
                        message = "Trop de requêtes. Réessayez dans quelques instants.",
                    }),
                    cancellationToken);
            };

            options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(httpContext =>
            {
                var key = ApiRequestIdentity.BuildRateLimitPartitionKey(httpContext);
                return RateLimitPartition.GetSlidingWindowLimiter(
                    key,
                    _ => new SlidingWindowRateLimiterOptions
                    {
                        PermitLimit = Math.Max(10, apiSecurity.GeneralRequestsPerMinute),
                        Window = TimeSpan.FromMinutes(1),
                        SegmentsPerWindow = 6,
                        QueueLimit = 0,
                        AutoReplenishment = true,
                    });
            });

            options.AddPolicy("compute-heavy", httpContext =>
            {
                var key = ApiRequestIdentity.BuildRateLimitPartitionKey(httpContext);
                return RateLimitPartition.GetSlidingWindowLimiter(
                    key,
                    _ => new SlidingWindowRateLimiterOptions
                    {
                        PermitLimit = Math.Max(5, apiSecurity.ComputeRequestsPerMinute),
                        Window = TimeSpan.FromMinutes(1),
                        SegmentsPerWindow = 6,
                        QueueLimit = 0,
                        AutoReplenishment = true,
                    });
            });

            options.AddPolicy("export", httpContext =>
            {
                var key = ApiRequestIdentity.BuildRateLimitPartitionKey(httpContext);
                return RateLimitPartition.GetSlidingWindowLimiter(
                    key,
                    _ => new SlidingWindowRateLimiterOptions
                    {
                        PermitLimit = Math.Max(5, apiSecurity.ExportRequestsPerMinute),
                        Window = TimeSpan.FromMinutes(1),
                        SegmentsPerWindow = 6,
                        QueueLimit = 0,
                        AutoReplenishment = true,
                    });
            });

            options.AddPolicy("feedback", httpContext =>
            {
                var key = ApiRequestIdentity.BuildRateLimitPartitionKey(httpContext);
                return RateLimitPartition.GetSlidingWindowLimiter(
                    $"{key}:feedback",
                    _ => new SlidingWindowRateLimiterOptions
                    {
                        PermitLimit = Math.Max(2, Math.Min(10, apiSecurity.ExportRequestsPerMinute / 4)),
                        Window = TimeSpan.FromMinutes(1),
                        SegmentsPerWindow = 6,
                        QueueLimit = 0,
                        AutoReplenishment = true,
                    });
            });
        });

        return new ApiBootstrapOptions(
            allowedOrigins,
            configuration["Valhalla:DataPath"],
            configuration["Valhalla:BaseUrl"]);
    }

    private static string[] NormalizeAllowedOrigins(IEnumerable<string> origins)
    {
        return origins
            .Where(origin => !string.IsNullOrWhiteSpace(origin))
            .Select(origin => origin.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
    }
}
