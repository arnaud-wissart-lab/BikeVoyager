namespace BikeVoyager.Infrastructure.Pois;

public sealed class OverpassOptions
{
    public const string SectionName = "Overpass";

    public string BaseUrl { get; init; } = "https://overpass-api.de/api/";

    public int TimeoutSeconds { get; init; } = 25;

    public CacheOptions Cache { get; init; } = new();

    public sealed class CacheOptions
    {
        public int AroundRouteTtlSeconds { get; init; } = 300;
    }
}
