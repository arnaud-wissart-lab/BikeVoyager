namespace BikeVoyager.Application.Routing;

public interface ILoopService
{
    Task<LoopResponse> ComputeAsync(LoopRequest request, CancellationToken cancellationToken);
}
