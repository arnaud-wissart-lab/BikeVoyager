namespace BikeVoyager.Api.Cloud;

internal static class CloudBackupFileNameValidator
{
    public static string Normalize(string? value)
    {
        var trimmed = (value ?? string.Empty).Trim();
        if (trimmed.Length == 0 || trimmed.Length > 120)
        {
            throw new CloudSyncException("Nom de fichier de sauvegarde invalide.");
        }

        if (trimmed.Contains('/') || trimmed.Contains('\\') || trimmed.Contains(".."))
        {
            throw new CloudSyncException("Nom de fichier de sauvegarde invalide.");
        }

        if (trimmed.IndexOfAny(Path.GetInvalidFileNameChars()) >= 0)
        {
            throw new CloudSyncException("Nom de fichier de sauvegarde invalide.");
        }

        return trimmed;
    }
}
