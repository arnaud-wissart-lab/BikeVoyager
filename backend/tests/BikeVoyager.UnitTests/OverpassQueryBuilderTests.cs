using BikeVoyager.Infrastructure.Pois;

namespace BikeVoyager.UnitTests;

public class OverpassQueryBuilderTests
{
    [Fact]
    public void BuildQuery_ContientLesFiltresEtLaBoundingBoxAttendus()
    {
        var query = OverpassQueryBuilder.BuildQuery(
            ["services", "paysages"],
            new OverpassBounds(45.1234567, 6.1234567, 45.7654321, 6.7654321));

        Assert.Contains("[out:json][timeout:25];", query);
        Assert.Contains("[\"amenity\"~\"cafe|restaurant|fast_food|toilets|pharmacy|drinking_water|bicycle_repair_station|shelter|fuel|bank|atm|parking\"]", query);
        Assert.Contains("[\"tourism\"=\"viewpoint\"]", query);
        Assert.Contains("(45.123457,6.123457,45.765432,6.765432)", query);
    }

    [Fact]
    public void NormalizeCategories_RetourneLesCategoriesParDefautSiAucuneNestValide()
    {
        var categories = OverpassQueryBuilder.NormalizeCategories(["inconnue", " "]);

        Assert.Equal(OverpassPoiCatalog.DefaultCategories, categories);
    }

    [Fact]
    public void NormalizeCategories_NettoieDedoublonneEtIgnoreLesInconnues()
    {
        var categories = OverpassQueryBuilder.NormalizeCategories([" services ", "SERVICES", "paysages", "inconnue"]);

        Assert.Equal(["services", "paysages"], categories);
    }
}
