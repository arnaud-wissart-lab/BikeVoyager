using BikeVoyager.Application.Routing;

namespace BikeVoyager.Infrastructure.Routing;

internal static class LoopScorer
{
    public static LoopCandidateResult CreateResult(LoopRouteSnapshot loopSnapshot, double targetKm)
    {
        var distanceKm = loopSnapshot.DistanceMeters / 1000d;
        var overlap = LoopOverlapScorer.Compute(loopSnapshot.Geometry.Coordinates);

        return new LoopCandidateResult(
            loopSnapshot.Geometry,
            loopSnapshot.DistanceMeters,
            loopSnapshot.EtaSeconds,
            overlap.Score,
            overlap.SegmentsCount,
            overlap.Ratio,
            Math.Abs(distanceKm - targetKm));
    }

    public static bool IsBetter(LoopCandidateResult candidateResult, LoopCandidateResult? bestCandidate)
    {
        if (bestCandidate is null)
        {
            return true;
        }

        if (candidateResult.OverlapRatio < bestCandidate.OverlapRatio - 0.0001)
        {
            return true;
        }

        return Math.Abs(candidateResult.OverlapRatio - bestCandidate.OverlapRatio) < 0.0001 &&
               candidateResult.DistanceErrorKm < bestCandidate.DistanceErrorKm;
    }
}
