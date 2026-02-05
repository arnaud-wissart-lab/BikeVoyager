namespace BikeVoyager.Application.Trips;

public sealed record TripDto(
    Guid Id,
    string Name,
    double DistanceKm,
    DateTime StartDateUtc);
