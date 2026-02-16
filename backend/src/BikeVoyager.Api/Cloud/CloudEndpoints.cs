namespace BikeVoyager.Api.Cloud;

public static class CloudEndpoints
{
    public static IEndpointRouteBuilder MapCloudEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapCloudSyncEndpoints();
        return endpoints;
    }
}
