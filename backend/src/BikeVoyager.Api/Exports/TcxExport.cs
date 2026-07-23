using System.Globalization;
using System.Xml.Linq;

namespace BikeVoyager.Api.Exports;

public static class TcxExportBuilder
{
    private static readonly XNamespace TcxNamespace =
        "http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2";
    private static readonly XNamespace XsiNamespace = "http://www.w3.org/2001/XMLSchema-instance";
    private const string SchemaLocation =
        "http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2 " +
        "http://www.garmin.com/xmlschemas/TrainingCenterDatabasev2.xsd";

    public static bool TryBuild(ExportRouteRequest request, out string tcx, out string? error)
    {
        tcx = string.Empty;
        if (!RouteExportDataBuilder.TryBuild(request, out var data, out error) || data is null)
        {
            return false;
        }

        var track = new XElement(TcxNamespace + "Track");
        foreach (var point in data.Points)
        {
            var trackPoint = new XElement(
                TcxNamespace + "Trackpoint",
                new XElement(
                    TcxNamespace + "Position",
                    new XElement(
                        TcxNamespace + "LatitudeDegrees",
                        FormatCoordinate(point.Lat)),
                    new XElement(
                        TcxNamespace + "LongitudeDegrees",
                        FormatCoordinate(point.Lon))));

            if (point.Altitude is not null)
            {
                trackPoint.Add(
                    new XElement(
                        TcxNamespace + "AltitudeMeters",
                        FormatElevation(point.Altitude.Value)));
            }

            trackPoint.Add(
                new XElement(
                    TcxNamespace + "DistanceMeters",
                    FormatDistance(point.DistanceMeters)));
            track.Add(trackPoint);
        }

        var document = new XDocument(
            new XDeclaration("1.0", "utf-8", "yes"),
            new XElement(
                TcxNamespace + "TrainingCenterDatabase",
                new XAttribute(XNamespace.Xmlns + "xsi", XsiNamespace),
                new XAttribute(XsiNamespace + "schemaLocation", SchemaLocation),
                new XElement(
                    TcxNamespace + "Courses",
                    new XElement(
                        TcxNamespace + "Course",
                        new XElement(TcxNamespace + "Name", data.Name),
                        track))));

        tcx = document.ToString(SaveOptions.DisableFormatting);
        return true;
    }

    public static string BuildFileName(string? name) =>
        RouteExportDataBuilder.BuildFileName(name, "tcx");

    private static string FormatCoordinate(double value) =>
        value.ToString("0.######", CultureInfo.InvariantCulture);

    private static string FormatElevation(double value) =>
        value.ToString("0.##", CultureInfo.InvariantCulture);

    private static string FormatDistance(double value) =>
        value.ToString("0.##", CultureInfo.InvariantCulture);
}
