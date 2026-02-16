using BikeVoyager.Application.Routing;

namespace BikeVoyager.UnitTests;

public class LoopOverlapScorerTests
{
    [Fact]
    public void Score_retourne_faible_quand_aucun_recouvrement()
    {
        var coordinates = new List<double[]>
        {
            new[] { 0d, 0d },
            new[] { 1d, 0d },
            new[] { 1d, 1d },
            new[] { 0d, 1d },
            new[] { 0d, 0d },
        };

        var result = LoopOverlapScorer.Compute(coordinates);

        Assert.Equal("faible", result.Score);
        Assert.Equal(4, result.SegmentsCount);
        Assert.Equal(0, result.OverlapSegmentsCount);
    }

    [Fact]
    public void Score_retourne_moyen_quand_recouvrement_modere()
    {
        var coordinates = new List<double[]>
        {
            new[] { 0d, 0d },
            new[] { 0d, 1d },
            new[] { 1d, 1d },
            new[] { 0d, 1d },
            new[] { 0d, 2d },
            new[] { 1d, 2d },
            new[] { 2d, 2d },
            new[] { 2d, 1d },
            new[] { 2d, 0d },
            new[] { 0d, 0d },
        };

        var result = LoopOverlapScorer.Compute(coordinates);

        Assert.Equal("moyen", result.Score);
        Assert.Equal(9, result.SegmentsCount);
        Assert.Equal(1, result.OverlapSegmentsCount);
    }

    [Fact]
    public void Score_retourne_eleve_quand_recouvrement_fort()
    {
        var coordinates = new List<double[]>
        {
            new[] { 0d, 0d },
            new[] { 0d, 1d },
            new[] { 0d, 0d },
            new[] { 0d, 1d },
            new[] { 0d, 0d },
        };

        var result = LoopOverlapScorer.Compute(coordinates);

        Assert.Equal("élevé", result.Score);
        Assert.Equal(4, result.SegmentsCount);
        Assert.Equal(3, result.OverlapSegmentsCount);
    }
}
