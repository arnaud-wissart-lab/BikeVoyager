namespace BikeVoyager.Domain.Entities;

public sealed record Trip(
    Guid Id,
    string Name,
    double DistanceKm,
    DateTime StartDateUtc);
