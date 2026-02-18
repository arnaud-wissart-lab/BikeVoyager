namespace BikeVoyager.Api.Valhalla;

internal sealed class ValhallaProbeClient(HttpClient httpClient) : IValhallaProbeClient
{
    private readonly HttpClient _httpClient = httpClient;

    public Task<HttpResponseMessage> GetStatusAsync(Uri baseAddress, CancellationToken cancellationToken)
    {
        _httpClient.BaseAddress = baseAddress;
        return _httpClient.GetAsync("status", cancellationToken);
    }
}
