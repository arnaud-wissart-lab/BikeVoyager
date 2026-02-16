namespace BikeVoyager.Infrastructure.Pois;

internal static class OverpassPoiCatalog
{
    public static readonly IReadOnlyList<string> DefaultCategories = new[]
    {
        "monuments",
        "paysages",
        "commerces",
        "services",
    };

    public static readonly IReadOnlyDictionary<string, PoiCategoryDefinition> CategoryDefinitions =
        new Dictionary<string, PoiCategoryDefinition>(StringComparer.OrdinalIgnoreCase)
        {
            ["monuments"] = new PoiCategoryDefinition(
                "monuments",
                new[]
                {
                    new TagFilter("historic", ["monument", "memorial", "castle", "ruins", "archaeological_site", "fort"]),
                    new TagFilter("tourism", ["attraction", "museum"]),
                    new TagFilter("amenity", ["place_of_worship"]),
                }),
            ["paysages"] = new PoiCategoryDefinition(
                "paysages",
                new[]
                {
                    new TagFilter("tourism", ["viewpoint"]),
                    new TagFilter("natural", ["peak", "waterfall", "beach", "bay", "spring", "wood", "cave", "cliff"]),
                    new TagFilter("waterway", ["waterfall"]),
                }),
            ["commerces"] = new PoiCategoryDefinition(
                "commerces",
                new[]
                {
                    new TagFilter("shop", ["bicycle", "supermarket", "bakery", "convenience", "farm", "outdoor", "sports"]),
                    new TagFilter("amenity", ["marketplace"]),
                }),
            ["services"] = new PoiCategoryDefinition(
                "services",
                new[]
                {
                    new TagFilter("amenity", new[]
                    {
                        "cafe",
                        "restaurant",
                        "fast_food",
                        "toilets",
                        "pharmacy",
                        "drinking_water",
                        "bicycle_repair_station",
                        "shelter",
                        "fuel",
                        "bank",
                        "atm",
                        "parking",
                    }),
                    new TagFilter("tourism", ["information"]),
                }),
        };

    public static readonly string[] KindPriorityKeys =
    {
        "historic",
        "tourism",
        "natural",
        "amenity",
        "shop",
    };

    public static readonly HashSet<string> GenericPoiNamesForDeduplication =
        new(StringComparer.Ordinal)
        {
            "point d'interet",
            "point dinteret",
            "point of interest",
        };
}
