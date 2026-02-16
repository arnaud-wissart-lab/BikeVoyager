using BikeVoyager.Infrastructure.Pois;

namespace BikeVoyager.UnitTests;

public class OverpassGeometryHelperTests
{
    [Fact]
    public void HaversineDistanceMeters_RetourneZeroPourDeuxPointsIdentiques()
    {
        var distance = OverpassGeometryHelper.HaversineDistanceMeters(45.0, 6.0, 45.0, 6.0);

        Assert.Equal(0d, distance, 6);
    }

    [Fact]
    public void ExpandBounds_RespecteLesLimitesDuMonde()
    {
        var bounds = new OverpassBounds(-89.9, -179.9, 89.9, 179.9);

        var expanded = OverpassGeometryHelper.ExpandBounds(bounds, 50_000);

        Assert.Equal(-90d, expanded.MinLat, 6);
        Assert.Equal(-180d, expanded.MinLon, 6);
        Assert.Equal(90d, expanded.MaxLat, 6);
        Assert.Equal(180d, expanded.MaxLon, 6);
    }

    [Fact]
    public void ComputeRouteProjection_AvecGeometrieWay_RetourneUnPointProjeteSurLaGeometrie()
    {
        var route = new List<double[]>
        {
            new[] { 0.0, 0.0 },
            new[] { 0.02, 0.0 },
        };

        var geometry = new List<OverpassGeometryPoint>
        {
            new(0.00020, 0.00520),
            new(0.00020, 0.00590),
        };

        var projection = OverpassGeometryHelper.ComputeRouteProjection(route, 0.0500, 0.0500, geometry);

        Assert.True(projection.DistanceToRouteMeters < 30);
        Assert.InRange(projection.DistanceAlongRouteMeters, 500, 700);
        Assert.InRange(projection.PoiLat, 0.00015, 0.00025);
        Assert.InRange(projection.PoiLon, 0.00515, 0.00595);
    }
}
