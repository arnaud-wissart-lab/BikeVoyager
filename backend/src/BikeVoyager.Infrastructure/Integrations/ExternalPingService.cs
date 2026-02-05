using BikeVoyager.Application.Integrations;

namespace BikeVoyager.Infrastructure.Integrations;

public sealed class ExternalPingService : IExternalPingService
{
    private readonly HttpClient _httpClient;

    public ExternalPingService(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    public async Task<bool> PingAsync(CancellationToken cancellationToken)
    {
        using var response = await _httpClient.GetAsync("/", cancellationToken);
        return response.IsSuccessStatusCode;
    }
}
