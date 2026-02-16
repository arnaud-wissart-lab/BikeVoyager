namespace BikeVoyager.Application.Pois;

public interface IPoiService
{
    Task<IReadOnlyList<PoiItem>> AroundRouteAsync(
        PoiAroundRouteRequest request,
        CancellationToken cancellationToken);
}
