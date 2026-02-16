namespace BikeVoyager.Api.Cloud.Providers;

public interface ICloudProviderClientResolver
{
    ICloudProviderClient Resolve(CloudProviderKind provider);
}
