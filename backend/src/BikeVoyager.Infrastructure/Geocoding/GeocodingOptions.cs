namespace BikeVoyager.Infrastructure.Geocoding;

public sealed class GeocodingOptions
{
    public const string SectionName = "Geocoding";

    public ProviderOptions CommuneProvider { get; init; } = new();

    public AddressProviderOptions AddressProvider { get; init; } = new();

    public CacheOptions Cache { get; init; } = new();

    public sealed class ProviderOptions
    {
        public string BaseUrl { get; init; } = "https://geo.api.gouv.fr";

        public int TimeoutSeconds { get; init; } = 5;
    }

    public sealed class AddressProviderOptions
    {
        public bool Enabled { get; init; }

        public string BaseUrl { get; init; } = "https://api-adresse.data.gouv.fr";

        public string? ApiKey { get; init; }

        public int TimeoutSeconds { get; init; } = 5;
    }

    public sealed class CacheOptions
    {
        public int SearchTtlSeconds { get; init; } = 300;

        public int ReverseTtlSeconds { get; init; } = 600;
    }
}
