namespace BikeVoyager.Api.Cloud;

public sealed class CloudSyncOptions
{
    public string BackupFolderName { get; set; } = "BikeVoyager";
    public CloudProviderClientOptions GoogleDrive { get; set; } = new();
    public CloudProviderClientOptions OneDrive { get; set; } = new();
}

public sealed class CloudProviderClientOptions
{
    public string ClientId { get; set; } = string.Empty;
    public string ClientSecret { get; set; } = string.Empty;
}
