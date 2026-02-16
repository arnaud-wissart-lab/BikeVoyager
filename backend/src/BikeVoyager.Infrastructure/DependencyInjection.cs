using BikeVoyager.Application.Geocoding;
using BikeVoyager.Application.Integrations;
using BikeVoyager.Application.Pois;
using BikeVoyager.Application.Routing;
using BikeVoyager.Application.Trips;
using BikeVoyager.Infrastructure.Geocoding;
using BikeVoyager.Infrastructure.Integrations;
using BikeVoyager.Infrastructure.Pois;
using BikeVoyager.Infrastructure.Routing;
using BikeVoyager.Infrastructure.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Http.Resilience;
using Microsoft.Extensions.Options;
using Polly;
using System.Net;

namespace BikeVoyager.Infrastructure;

public static class DependencyInjection
{
    private static readonly PredicateBuilder<HttpResponseMessage> TransientHttpPredicate =
        new PredicateBuilder<HttpResponseMessage>()
            .Handle<HttpRequestException>()
            .HandleResult(static response =>
                response.StatusCode == HttpStatusCode.RequestTimeout ||
                (int)response.StatusCode >= 500);

    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddSingleton<ITripService, InMemoryTripService>();
        services.AddMemoryCache();
        var redisConfiguration =
            configuration["Cache:Redis:Configuration"]
            ?? configuration.GetConnectionString("redis")
            ?? configuration.GetConnectionString("Redis");

        if (!string.IsNullOrWhiteSpace(redisConfiguration))
        {
            services.AddStackExchangeRedisCache(options =>
            {
                options.Configuration = redisConfiguration;
                options.InstanceName = configuration["Cache:Redis:InstanceName"] ?? "bikevoyager:";
            });
        }
        else
        {
            services.AddDistributedMemoryCache();
        }
        services.Configure<GeocodingOptions>(configuration.GetSection(GeocodingOptions.SectionName));
        services.Configure<ValhallaOptions>(configuration.GetSection(ValhallaOptions.SectionName));
        services.Configure<OverpassOptions>(configuration.GetSection(OverpassOptions.SectionName));

        services.AddHttpClient<IExternalPingService, ExternalPingService>(client =>
            {
                client.BaseAddress = new Uri(configuration["ExternalPing:BaseUrl"] ?? "https://example.com");
                client.Timeout = TimeSpan.FromSeconds(5);
            })
            .AddSharedHttpResilience();

        services.AddHttpClient<GeoApiGouvGeocodingProvider>((sp, client) =>
            {
                var options = sp.GetRequiredService<IOptions<GeocodingOptions>>().Value;
                client.BaseAddress = new Uri(options.CommuneProvider.BaseUrl);
                client.Timeout = TimeSpan.FromSeconds(options.CommuneProvider.TimeoutSeconds);
            })
            .AddSharedHttpResilience();

        services.AddHttpClient<AddressApiGeocodingProvider>((sp, client) =>
            {
                var options = sp.GetRequiredService<IOptions<GeocodingOptions>>().Value;
                client.BaseAddress = new Uri(options.AddressProvider.BaseUrl);
                client.Timeout = TimeSpan.FromSeconds(options.AddressProvider.TimeoutSeconds);
            })
            .AddSharedHttpResilience();

        services.AddHttpClient<IRouteService, ValhallaRouteService>((sp, client) =>
            {
                var options = sp.GetRequiredService<IOptions<ValhallaOptions>>().Value;
                var baseUrl = options.BaseUrl.TrimEnd('/') + "/";
                client.BaseAddress = new Uri(baseUrl);
                client.Timeout = TimeSpan.FromSeconds(options.TimeoutSeconds);
            })
            .AddValhallaHttpResilience();

        services.AddHttpClient<ILoopService, ValhallaLoopService>((sp, client) =>
            {
                var options = sp.GetRequiredService<IOptions<ValhallaOptions>>().Value;
                var baseUrl = options.BaseUrl.TrimEnd('/') + "/";
                client.BaseAddress = new Uri(baseUrl);
                client.Timeout = TimeSpan.FromSeconds(options.TimeoutSeconds);
            })
            .AddValhallaHttpResilience();

        services.AddHttpClient<IPoiService, OverpassPoiService>((sp, client) =>
            {
                var options = sp.GetRequiredService<IOptions<OverpassOptions>>().Value;
                var baseUrl = options.BaseUrl.TrimEnd('/') + "/";
                client.BaseAddress = new Uri(baseUrl);
                client.Timeout = TimeSpan.FromSeconds(options.TimeoutSeconds);
                client.DefaultRequestHeaders.UserAgent.ParseAdd("BikeVoyager/1.0");
            })
            .AddSharedHttpResilience();

        services.AddScoped<IGeocodingService>(sp =>
            new GeocodingService(
                sp.GetRequiredService<GeoApiGouvGeocodingProvider>(),
                sp.GetRequiredService<AddressApiGeocodingProvider>(),
                sp.GetRequiredService<Microsoft.Extensions.Caching.Memory.IMemoryCache>(),
                sp.GetService<Microsoft.Extensions.Caching.Distributed.IDistributedCache>(),
                sp.GetRequiredService<IOptions<GeocodingOptions>>(),
                sp.GetRequiredService<Microsoft.Extensions.Logging.ILogger<GeocodingService>>()));

        return services;
    }

    private static IHttpClientBuilder AddSharedHttpResilience(this IHttpClientBuilder builder)
    {
        builder.AddResilienceHandler("shared-http-resilience", pipeline =>
            pipeline
                .AddRetry(new HttpRetryStrategyOptions
                {
                    ShouldHandle = TransientHttpPredicate,
                    MaxRetryAttempts = 3,
                    Delay = TimeSpan.FromMilliseconds(200),
                    BackoffType = DelayBackoffType.Linear,
                    UseJitter = false,
                    ShouldRetryAfterHeader = false,
                })
                .AddCircuitBreaker(new HttpCircuitBreakerStrategyOptions
                {
                    ShouldHandle = TransientHttpPredicate,
                    MinimumThroughput = 5,
                    FailureRatio = 1d,
                    SamplingDuration = TimeSpan.FromSeconds(30),
                    BreakDuration = TimeSpan.FromSeconds(15),
                }));

        return builder;
    }

    private static IHttpClientBuilder AddValhallaHttpResilience(this IHttpClientBuilder builder)
    {
        builder.AddResilienceHandler("valhalla-http-resilience", pipeline =>
            pipeline.AddRetry(new HttpRetryStrategyOptions
            {
                ShouldHandle = TransientHttpPredicate,
                MaxRetryAttempts = 4,
                Delay = TimeSpan.FromSeconds(2),
                BackoffType = DelayBackoffType.Exponential,
                UseJitter = false,
                ShouldRetryAfterHeader = false,
            }));

        return builder;
    }
}
