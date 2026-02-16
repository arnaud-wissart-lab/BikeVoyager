using BikeVoyager.Infrastructure.Pois;

namespace BikeVoyager.UnitTests;

public class PoiDeduplicatorTests
{
    [Fact]
    public void MergeSemanticDuplicates_FusionneLesDoublonsSemantiquesProches()
    {
        var source = new[]
        {
            CreateMatch(
                id: "node/101",
                name: "NIVEAU DU GLACIER",
                lat: 45.00020,
                lon: 6.00000,
                category: "monuments",
                kind: "historic:memorial",
                osmType: "node",
                osmId: 101,
                tags: new Dictionary<string, string>
                {
                    ["name"] = "NIVEAU DU GLACIER",
                    ["historic"] = "memorial",
                },
                distanceToRouteMeters: 30,
                distanceAlongRouteMeters: 1000),
            CreateMatch(
                id: "way/202",
                name: "Niveau du glacier",
                lat: 45.00018,
                lon: 6.00002,
                category: "monuments",
                kind: "historic:memorial",
                osmType: "way",
                osmId: 202,
                tags: new Dictionary<string, string>
                {
                    ["name"] = "Niveau du glacier",
                    ["historic"] = "memorial",
                    ["wikipedia"] = "fr:Niveau du Glacier",
                },
                distanceToRouteMeters: 8,
                distanceAlongRouteMeters: 1010),
        };

        var deduplicated = PoiDeduplicator.MergeSemanticDuplicates(source);

        var poi = Assert.Single(deduplicated);
        Assert.Equal("way/202", poi.Id);
        Assert.Equal("Niveau du glacier", poi.Name);
    }

    [Fact]
    public void MergeSemanticDuplicates_ConserveLesHomonymesEloignesLeLongDuTrace()
    {
        var source = new[]
        {
            CreateMatch(
                id: "node/301",
                name: "Belvedere",
                lat: 45.00010,
                lon: 6.00000,
                category: "paysages",
                kind: "tourism:viewpoint",
                osmType: "node",
                osmId: 301,
                tags: new Dictionary<string, string>
                {
                    ["name"] = "Belvedere",
                    ["tourism"] = "viewpoint",
                },
                distanceToRouteMeters: 10,
                distanceAlongRouteMeters: 100),
            CreateMatch(
                id: "node/302",
                name: "Belvedere",
                lat: 45.00010,
                lon: 6.01000,
                category: "paysages",
                kind: "tourism:viewpoint",
                osmType: "node",
                osmId: 302,
                tags: new Dictionary<string, string>
                {
                    ["name"] = "Belvedere",
                    ["tourism"] = "viewpoint",
                },
                distanceToRouteMeters: 12,
                distanceAlongRouteMeters: 5000),
        };

        var deduplicated = PoiDeduplicator.MergeSemanticDuplicates(source);

        Assert.Equal(2, deduplicated.Count);
        Assert.Contains(deduplicated, poi => poi.Id == "node/301");
        Assert.Contains(deduplicated, poi => poi.Id == "node/302");
    }

    private static PoiMatch CreateMatch(
        string id,
        string name,
        double lat,
        double lon,
        string category,
        string? kind,
        string osmType,
        long osmId,
        IReadOnlyDictionary<string, string>? tags,
        double distanceToRouteMeters,
        double distanceAlongRouteMeters)
    {
        return new PoiMatch(
            id,
            name,
            lat,
            lon,
            category,
            kind,
            osmType,
            osmId,
            tags,
            distanceToRouteMeters,
            distanceAlongRouteMeters);
    }
}
