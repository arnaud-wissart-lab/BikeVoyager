namespace BikeVoyager.Application.Routing;

public interface IRouteService
{
    Task<RouteResponse> ComputeAsync(RouteRequest request, CancellationToken cancellationToken);
}
