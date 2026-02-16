namespace BikeVoyager.Api.Cloud.OAuth;

public interface ICloudOAuthFlowService
{
    CloudOAuthStartPayload CreateStartPayload(
        CloudProviderKind provider,
        string redirectUri,
        string? returnHash);

    CloudOAuthCallbackValidationResult ValidateCallback(
        CloudOAuthPendingState pendingState,
        CloudOAuthCallbackRequest payload);
}

public sealed record CloudOAuthStartPayload(
    CloudOAuthPendingState PendingState,
    string CodeChallenge);

public sealed record CloudOAuthCallbackValidationResult(
    bool IsValid,
    string? Code,
    string? ErrorMessage);
