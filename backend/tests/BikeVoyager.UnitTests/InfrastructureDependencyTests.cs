using BikeVoyager.Application.Pois;
using BikeVoyager.Infrastructure;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace BikeVoyager.UnitTests;

public class InfrastructureDependencyTests
{
    [Fact]
    public void AddInfrastructure_ResoutLeServicePoi()
    {
        var settings = new Dictionary<string, string?>
        {
            ["ExternalPing:BaseUrl"] = "https://example.com",
            ["Geocoding:CommuneProvider:BaseUrl"] = "https://geo.api.gouv.fr",
            ["Geocoding:CommuneProvider:TimeoutSeconds"] = "5",
            ["Geocoding:AddressProvider:Enabled"] = "false",
            ["Geocoding:AddressProvider:BaseUrl"] = "https://api-adresse.data.gouv.fr",
            ["Geocoding:AddressProvider:TimeoutSeconds"] = "5",
            ["Geocoding:Cache:SearchTtlSeconds"] = "300",
            ["Geocoding:Cache:ReverseTtlSeconds"] = "600",
            ["Valhalla:BaseUrl"] = "http://localhost:8002",
            ["Valhalla:TimeoutSeconds"] = "60",
            ["Valhalla:Language"] = "fr-FR",
            ["Overpass:BaseUrl"] = "https://overpass-api.de/api/",
            ["Overpass:TimeoutSeconds"] = "25",
            ["Overpass:Cache:AroundRouteTtlSeconds"] = "300",
        };

        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(settings)
            .Build();

        var services = new ServiceCollection();
        services.AddLogging();
        services.AddInfrastructure(configuration);

        using var provider = services.BuildServiceProvider();
        using var scope = provider.CreateScope();

        var poiService = scope.ServiceProvider.GetRequiredService<IPoiService>();
        Assert.NotNull(poiService);

        var distributedCache = scope.ServiceProvider.GetRequiredService<IDistributedCache>();
        Assert.Equal("MemoryDistributedCache", distributedCache.GetType().Name);
    }

    [Fact]
    public void AddInfrastructure_UtiliseRedisQuandConfigure()
    {
        var settings = new Dictionary<string, string?>
        {
            ["ExternalPing:BaseUrl"] = "https://example.com",
            ["Geocoding:CommuneProvider:BaseUrl"] = "https://geo.api.gouv.fr",
            ["Geocoding:CommuneProvider:TimeoutSeconds"] = "5",
            ["Geocoding:AddressProvider:Enabled"] = "false",
            ["Geocoding:AddressProvider:BaseUrl"] = "https://api-adresse.data.gouv.fr",
            ["Geocoding:AddressProvider:TimeoutSeconds"] = "5",
            ["Geocoding:Cache:SearchTtlSeconds"] = "300",
            ["Geocoding:Cache:ReverseTtlSeconds"] = "600",
            ["Valhalla:BaseUrl"] = "http://localhost:8002",
            ["Valhalla:TimeoutSeconds"] = "60",
            ["Valhalla:Language"] = "fr-FR",
            ["Overpass:BaseUrl"] = "https://overpass-api.de/api/",
            ["Overpass:TimeoutSeconds"] = "25",
            ["Overpass:Cache:AroundRouteTtlSeconds"] = "300",
            ["Cache:Redis:Configuration"] = "localhost:6379,abortConnect=false",
            ["Cache:Redis:InstanceName"] = "bikevoyager-test:",
        };

        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(settings)
            .Build();

        var services = new ServiceCollection();
        services.AddLogging();
        services.AddInfrastructure(configuration);

        using var provider = services.BuildServiceProvider();
        using var scope = provider.CreateScope();

        var distributedCache = scope.ServiceProvider.GetRequiredService<IDistributedCache>();
        Assert.Contains("RedisCache", distributedCache.GetType().Name, StringComparison.Ordinal);
    }
}
