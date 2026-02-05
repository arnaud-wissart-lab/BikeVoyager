using BikeVoyager.Application.Geocoding;
using BikeVoyager.Application.Integrations;
using BikeVoyager.Application.Trips;
using BikeVoyager.Infrastructure.Geocoding;
using BikeVoyager.Infrastructure.Integrations;
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
        services.Configure<GeocodingOptions>(configuration.GetSection(GeocodingOptions.SectionName));

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

        services.AddScoped<IGeocodingService, GeocodingService>();

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
}
