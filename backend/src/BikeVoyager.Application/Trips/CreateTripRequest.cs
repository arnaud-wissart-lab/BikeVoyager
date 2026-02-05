namespace BikeVoyager.Application.Trips;

public sealed record CreateTripRequest(
    string Name,
    double DistanceKm,
    DateTime StartDateUtc);
