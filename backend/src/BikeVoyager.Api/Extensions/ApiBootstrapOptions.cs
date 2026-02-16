namespace BikeVoyager.Api.Extensions;

public sealed record ApiBootstrapOptions(
    string[] AllowedOrigins,
    string? ValhallaDataPath,
    string? ValhallaBaseUrl);
