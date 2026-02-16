using BikeVoyager.Application.Routing;

namespace BikeVoyager.Infrastructure.Routing;

internal readonly record struct LoopPoint(double Lat, double Lon);

internal sealed record LoopCandidate(LoopPoint PointA, LoopPoint PointB);

internal sealed record LoopRouteSnapshot(
    GeoJsonLineString Geometry,
    double DistanceMeters,
    double EtaSeconds);

internal sealed record LoopCandidateResult(
    GeoJsonLineString Geometry,
    double DistanceMeters,
    double EtaSeconds,
    string OverlapScore,
    int SegmentsCount,
    double OverlapRatio,
    double DistanceErrorKm);
