namespace BikeVoyager.Api.Valhalla;

internal interface IValhallaProbeClient
{
    Task<HttpResponseMessage> GetStatusAsync(Uri baseAddress, CancellationToken cancellationToken);
}
