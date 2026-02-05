namespace BikeVoyager.Application.Geocoding;

public sealed record PlaceCandidate(
    string Label,
    double Lat,
    double Lon,
    double Score,
    string Source,
    string? Postcode,
    string? City,
    string? Department,
    string? InseeCode);
