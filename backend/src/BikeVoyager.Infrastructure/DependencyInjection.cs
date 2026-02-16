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
using Microsoft.Extensions.Options;
using Polly;
using Polly.Extensions.Http;

namespace BikeVoyager.Infrastructure;

public static class DependencyInjection
{
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
            .AddPolicyHandler(GetRetryPolicy())
            .AddPolicyHandler(GetCircuitBreakerPolicy());

        services.AddHttpClient<GeoApiGouvGeocodingProvider>((sp, client) =>
            {
                var options = sp.GetRequiredService<IOptions<GeocodingOptions>>().Value;
                client.BaseAddress = new Uri(options.CommuneProvider.BaseUrl);
                client.Timeout = TimeSpan.FromSeconds(options.CommuneProvider.TimeoutSeconds);
            })
            .AddPolicyHandler(GetRetryPolicy())
            .AddPolicyHandler(GetCircuitBreakerPolicy());

        services.AddHttpClient<AddressApiGeocodingProvider>((sp, client) =>
            {
                var options = sp.GetRequiredService<IOptions<GeocodingOptions>>().Value;
                client.BaseAddress = new Uri(options.AddressProvider.BaseUrl);
                client.Timeout = TimeSpan.FromSeconds(options.AddressProvider.TimeoutSeconds);
            })
            .AddPolicyHandler(GetRetryPolicy())
            .AddPolicyHandler(GetCircuitBreakerPolicy());

        services.AddHttpClient<IRouteService, ValhallaRouteService>((sp, client) =>
            {
                var options = sp.GetRequiredService<IOptions<ValhallaOptions>>().Value;
                var baseUrl = options.BaseUrl.TrimEnd('/') + "/";
                client.BaseAddress = new Uri(baseUrl);
                client.Timeout = TimeSpan.FromSeconds(options.TimeoutSeconds);
            })
            .AddPolicyHandler(GetValhallaRetryPolicy());

        services.AddHttpClient<ILoopService, ValhallaLoopService>((sp, client) =>
            {
                var options = sp.GetRequiredService<IOptions<ValhallaOptions>>().Value;
                var baseUrl = options.BaseUrl.TrimEnd('/') + "/";
                client.BaseAddress = new Uri(baseUrl);
                client.Timeout = TimeSpan.FromSeconds(options.TimeoutSeconds);
            })
            .AddPolicyHandler(GetValhallaRetryPolicy());

        services.AddHttpClient<IPoiService, OverpassPoiService>((sp, client) =>
            {
                var options = sp.GetRequiredService<IOptions<OverpassOptions>>().Value;
                var baseUrl = options.BaseUrl.TrimEnd('/') + "/";
                client.BaseAddress = new Uri(baseUrl);
                client.Timeout = TimeSpan.FromSeconds(options.TimeoutSeconds);
                client.DefaultRequestHeaders.UserAgent.ParseAdd("BikeVoyager/1.0");
            })
            .AddPolicyHandler(GetRetryPolicy())
            .AddPolicyHandler(GetCircuitBreakerPolicy());

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

    private static IAsyncPolicy<HttpResponseMessage> GetRetryPolicy() =>
        HttpPolicyExtensions
            .HandleTransientHttpError()
            .WaitAndRetryAsync(3, attempt => TimeSpan.FromMilliseconds(200 * attempt));

    private static IAsyncPolicy<HttpResponseMessage> GetCircuitBreakerPolicy() =>
        HttpPolicyExtensions
            .HandleTransientHttpError()
            .CircuitBreakerAsync(5, TimeSpan.FromSeconds(15));

    private static IAsyncPolicy<HttpResponseMessage> GetValhallaRetryPolicy() =>
        HttpPolicyExtensions
            .HandleTransientHttpError()
            .WaitAndRetryAsync(4, attempt => TimeSpan.FromSeconds(Math.Pow(2, attempt)));
}
