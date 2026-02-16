namespace BikeVoyager.Api.Cloud.Providers;

public sealed class CloudProviderClientResolver(IEnumerable<ICloudProviderClient> clients)
    : ICloudProviderClientResolver
{
    private readonly IReadOnlyDictionary<CloudProviderKind, ICloudProviderClient> _clients =
        clients.ToDictionary(client => client.Provider);

    public ICloudProviderClient Resolve(CloudProviderKind provider)
    {
        if (_clients.TryGetValue(provider, out var client))
        {
            return client;
        }

        throw new CloudSyncException("Cloud provider invalide.");
    }
}
