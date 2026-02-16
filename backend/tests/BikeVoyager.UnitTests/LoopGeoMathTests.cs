using BikeVoyager.Application.Routing;
using BikeVoyager.Infrastructure.Routing;

namespace BikeVoyager.UnitTests;

public class LoopGeoMathTests
{
    [Fact]
    public void HaversineKm_RetourneUneDistanceCoherente()
    {
        var distance = LoopGeoMath.HaversineKm(48.8566, 2.3522, 45.7640, 4.8357);
        var distanceInverse = LoopGeoMath.HaversineKm(45.7640, 4.8357, 48.8566, 2.3522);

        Assert.InRange(distance, 390d, 395d);
        Assert.Equal(distance, distanceInverse, 6);
    }

    [Fact]
    public void Offset_AvecDistanceNulle_ConserveLePointInitial()
    {
        var start = new RoutePoint(48.8566, 2.3522, "start");

        var result = LoopGeoMath.Offset(start, 0d, 120d);

        Assert.Equal(start.Lat, result.Lat, 6);
        Assert.Equal(start.Lon, result.Lon, 6);
    }

    [Fact]
    public void Offset_NormaliseLaLongitude_LorsDuPassageAntimeridien()
    {
        var start = new RoutePoint(0d, 179.9d, "start");

        var result = LoopGeoMath.Offset(start, 30d, 90d);

        Assert.InRange(result.Lon, -180d, 180d);
        Assert.True(result.Lon < -179.7d);
    }
}
