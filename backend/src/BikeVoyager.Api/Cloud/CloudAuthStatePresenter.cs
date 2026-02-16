namespace BikeVoyager.Api.Cloud;

internal static class CloudAuthStatePresenter
{
    public static object ToPublicAuthState(CloudAuthState authState) => new
    {
        provider = CloudProviderCodec.ToProviderValue(authState.Provider),
        accountEmail = authState.AccountEmail,
        accountName = authState.AccountName,
        connectedAt = authState.ConnectedAt.ToString("O"),
        expiresAt = authState.ExpiresAt.ToString("O"),
    };
}
