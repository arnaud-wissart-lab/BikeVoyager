namespace BikeVoyager.Application.Integrations;

public interface IExternalPingService
{
    Task<bool> PingAsync(CancellationToken cancellationToken);
}
