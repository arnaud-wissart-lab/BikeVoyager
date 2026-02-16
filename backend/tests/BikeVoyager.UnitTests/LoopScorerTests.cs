using BikeVoyager.Application.Routing;
using BikeVoyager.Infrastructure.Routing;

namespace BikeVoyager.UnitTests;

public class LoopScorerTests
{
    [Fact]
    public void CreateResult_CalculeLeScoreEtLEcartDeDistance()
    {
        var snapshot = new LoopRouteSnapshot(
            BuildGeometry(
                new[] { 0d, 0d },
                new[] { 1d, 0d },
                new[] { 1d, 1d },
                new[] { 0d, 1d },
                new[] { 0d, 0d }),
            DistanceMeters: 10_000d,
            EtaSeconds: 1_800d);

        var result = LoopScorer.CreateResult(snapshot, targetKm: 10d);

        Assert.Equal("faible", result.OverlapScore);
        Assert.Equal(4, result.SegmentsCount);
        Assert.Equal(0d, result.OverlapRatio);
        Assert.Equal(0d, result.DistanceErrorKm);
    }

    [Fact]
    public void IsBetter_PrioriseLeRecouvrementLePlusFaible()
    {
        var best = CreateCandidate(overlapRatio: 0.20, distanceErrorKm: 0.10);
        var challenger = CreateCandidate(overlapRatio: 0.15, distanceErrorKm: 5.00);

        var isBetter = LoopScorer.IsBetter(challenger, best);

        Assert.True(isBetter);
    }

    [Fact]
    public void IsBetter_DepartageParDistanceQuandLeRecouvrementEstEquivalent()
    {
        var best = CreateCandidate(overlapRatio: 0.20000, distanceErrorKm: 1.20);
        var challenger = CreateCandidate(overlapRatio: 0.20005, distanceErrorKm: 0.80);
        var tooDifferent = CreateCandidate(overlapRatio: 0.20020, distanceErrorKm: 0.01);

        var isBetterOnTie = LoopScorer.IsBetter(challenger, best);
        var isBetterOutsideTie = LoopScorer.IsBetter(tooDifferent, best);

        Assert.True(isBetterOnTie);
        Assert.False(isBetterOutsideTie);
    }

    private static LoopCandidateResult CreateCandidate(double overlapRatio, double distanceErrorKm)
    {
        return new LoopCandidateResult(
            BuildGeometry(
                new[] { 0d, 0d },
                new[] { 1d, 1d },
                new[] { 0d, 0d }),
            DistanceMeters: 1_000d,
            EtaSeconds: 300d,
            OverlapScore: "faible",
            SegmentsCount: 2,
            OverlapRatio: overlapRatio,
            DistanceErrorKm: distanceErrorKm);
    }

    private static GeoJsonLineString BuildGeometry(params double[][] coordinates)
    {
        return new GeoJsonLineString("LineString", coordinates);
    }
}
