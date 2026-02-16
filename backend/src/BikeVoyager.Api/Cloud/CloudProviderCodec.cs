namespace BikeVoyager.Api.Cloud;

internal static class CloudProviderCodec
{
    public static bool TryParse(string? value, out CloudProviderKind provider)
    {
        provider = default;
        if (string.IsNullOrWhiteSpace(value))
        {
            return false;
        }

        var normalized = value.Trim().ToLowerInvariant();
        if (normalized == "onedrive")
        {
            provider = CloudProviderKind.OneDrive;
            return true;
        }

        if (normalized == "google-drive")
        {
            provider = CloudProviderKind.GoogleDrive;
            return true;
        }

        return false;
    }

    public static string ToProviderValue(CloudProviderKind provider) =>
        provider == CloudProviderKind.GoogleDrive ? "google-drive" : "onedrive";
}
