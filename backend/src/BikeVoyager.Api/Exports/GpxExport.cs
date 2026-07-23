using System.Globalization;
using System.Xml.Linq;

namespace BikeVoyager.Api.Exports;

public static class GpxExportBuilder
{
    private static readonly XNamespace GpxNamespace = "http://www.topografix.com/GPX/1/1";
    private static readonly XNamespace XsiNamespace = "http://www.w3.org/2001/XMLSchema-instance";
    private const string SchemaLocation =
        "http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd";

    public static bool TryBuild(ExportRouteRequest request, out string gpx, out string? error)
    {
        gpx = string.Empty;
        if (!RouteExportDataBuilder.TryBuild(request, out var data, out error) || data is null)
        {
            return false;
        }

        var trackSegment = new XElement(GpxNamespace + "trkseg");
        foreach (var pointData in data.Points)
        {
            var point = new XElement(
                GpxNamespace + "trkpt",
                new XAttribute("lat", FormatCoordinate(pointData.Lat)),
                new XAttribute("lon", FormatCoordinate(pointData.Lon)));

            if (pointData.Altitude is not null)
            {
                point.Add(new XElement(GpxNamespace + "ele", FormatElevation(pointData.Altitude.Value)));
            }

            trackSegment.Add(point);
        }

        var document = new XDocument(
            new XDeclaration("1.0", "utf-8", "yes"),
            new XElement(
                GpxNamespace + "gpx",
                new XAttribute("version", "1.1"),
                new XAttribute("creator", "BikeVoyager"),
                new XAttribute(XNamespace.Xmlns + "xsi", XsiNamespace),
                new XAttribute(XsiNamespace + "schemaLocation", SchemaLocation),
                new XElement(
                    GpxNamespace + "trk",
                    new XElement(GpxNamespace + "name", data.Name),
                    trackSegment)));

        gpx = document.ToString(SaveOptions.DisableFormatting);
        return true;
    }

    public static string BuildFileName(string? name) =>
        RouteExportDataBuilder.BuildFileName(name, "gpx");

    private static string FormatCoordinate(double value) =>
        value.ToString("0.######", CultureInfo.InvariantCulture);

    private static string FormatElevation(double value) =>
        value.ToString("0.##", CultureInfo.InvariantCulture);
}
