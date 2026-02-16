namespace BikeVoyager.Api.Cloud.OAuth;

public sealed class CloudOAuthFlowService(
    ICloudOAuthCrypto oauthCrypto,
    TimeProvider timeProvider)
    : ICloudOAuthFlowService
{
    public CloudOAuthStartPayload CreateStartPayload(
        CloudProviderKind provider,
        string redirectUri,
        string? returnHash)
    {
        var state = oauthCrypto.CreateRandomBase64Url(24);
        var verifier = oauthCrypto.CreateRandomBase64Url(64);
        var normalizedReturnHash = NormalizeReturnHash(returnHash);
        var createdAt = timeProvider.GetUtcNow();
        var pendingState = new CloudOAuthPendingState(
            provider,
            state,
            verifier,
            redirectUri,
            normalizedReturnHash,
            createdAt);

        var codeChallenge = oauthCrypto.BuildCodeChallenge(verifier);
        return new CloudOAuthStartPayload(pendingState, codeChallenge);
    }

    public CloudOAuthCallbackValidationResult ValidateCallback(
        CloudOAuthPendingState pendingState,
        CloudOAuthCallbackRequest payload)
    {
        if (!string.IsNullOrWhiteSpace(payload.Error))
        {
            var message = string.IsNullOrWhiteSpace(payload.ErrorDescription)
                ? payload.Error.Trim()
                : payload.ErrorDescription.Trim();
            return new CloudOAuthCallbackValidationResult(false, null, message);
        }

        if (string.IsNullOrWhiteSpace(payload.Code))
        {
            return new CloudOAuthCallbackValidationResult(
                false,
                null,
                "Code OAuth manquant.");
        }

        if (string.IsNullOrWhiteSpace(payload.State) ||
            !oauthCrypto.FixedTimeEquals(payload.State.Trim(), pendingState.State))
        {
            return new CloudOAuthCallbackValidationResult(
                false,
                null,
                "État OAuth cloud invalide.");
        }

        return new CloudOAuthCallbackValidationResult(
            true,
            payload.Code.Trim(),
            null);
    }

    private static string NormalizeReturnHash(string? returnHash)
    {
        if (string.IsNullOrWhiteSpace(returnHash))
        {
            return string.Empty;
        }

        var trimmed = returnHash.Trim();
        if (!trimmed.StartsWith('#'))
        {
            trimmed = $"#{trimmed}";
        }

        return trimmed.Length > 256 ? trimmed[..256] : trimmed;
    }
}
