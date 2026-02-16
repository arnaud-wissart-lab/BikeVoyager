namespace BikeVoyager.Infrastructure.Routing;

public sealed class ValhallaOptions
{
    public const string SectionName = "Valhalla";

    public string BaseUrl { get; init; } = "http://localhost:8002";

    public int TimeoutSeconds { get; init; } = 60;

    public string Language { get; init; } = "fr";
}
