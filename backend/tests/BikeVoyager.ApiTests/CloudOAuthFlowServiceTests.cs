using BikeVoyager.Api.Cloud;
using BikeVoyager.Api.Cloud.OAuth;

namespace BikeVoyager.ApiTests;

public class CloudOAuthFlowServiceTests
{
    [Fact]
    public void CreateStartPayload_genere_state_verifier_pkce_et_hash_normalise()
    {
        var now = DateTimeOffset.Parse("2026-02-16T10:00:00Z");
        var crypto = new FakeOAuthCrypto("state-123", "verifier-456");
        var service = new CloudOAuthFlowService(crypto, new FixedTimeProvider(now));

        var payload = service.CreateStartPayload(
            CloudProviderKind.GoogleDrive,
            "https://app.example/callback",
            "planner");

        Assert.Equal("state-123", payload.PendingState.State);
        Assert.Equal("verifier-456", payload.PendingState.Verifier);
        Assert.Equal("https://app.example/callback", payload.PendingState.RedirectUri);
        Assert.Equal("#planner", payload.PendingState.ReturnHash);
        Assert.Equal(now, payload.PendingState.CreatedAt);
        Assert.Equal("challenge-verifier-456", payload.CodeChallenge);
    }

    [Fact]
    public void ValidateCallback_accepte_le_happy_path()
    {
        var service = CreateService();
        var pending = new CloudOAuthPendingState(
            CloudProviderKind.OneDrive,
            "state-ok",
            "verifier",
            "https://app.example/callback",
            "#map",
            DateTimeOffset.UtcNow);

        var result = service.ValidateCallback(
            pending,
            new CloudOAuthCallbackRequest("  auth-code  ", "state-ok", null, null));

        Assert.True(result.IsValid);
        Assert.Equal("auth-code", result.Code);
        Assert.Null(result.ErrorMessage);
    }

    [Fact]
    public void ValidateCallback_refuse_une_erreur_fournisseur()
    {
        var service = CreateService();
        var pending = new CloudOAuthPendingState(
            CloudProviderKind.OneDrive,
            "state-ok",
            "verifier",
            "https://app.example/callback",
            string.Empty,
            DateTimeOffset.UtcNow);

        var result = service.ValidateCallback(
            pending,
            new CloudOAuthCallbackRequest(null, "state-ok", "access_denied", "  autorisation refusee  "));

        Assert.False(result.IsValid);
        Assert.Equal("autorisation refusee", result.ErrorMessage);
    }

    [Fact]
    public void ValidateCallback_refuse_un_code_absent()
    {
        var service = CreateService();
        var pending = new CloudOAuthPendingState(
            CloudProviderKind.OneDrive,
            "state-ok",
            "verifier",
            "https://app.example/callback",
            string.Empty,
            DateTimeOffset.UtcNow);

        var result = service.ValidateCallback(
            pending,
            new CloudOAuthCallbackRequest(null, "state-ok", null, null));

        Assert.False(result.IsValid);
        Assert.Equal("Code OAuth manquant.", result.ErrorMessage);
    }

    [Fact]
    public void ValidateCallback_refuse_un_etat_invalide()
    {
        var service = CreateService();
        var pending = new CloudOAuthPendingState(
            CloudProviderKind.OneDrive,
            "state-ok",
            "verifier",
            "https://app.example/callback",
            string.Empty,
            DateTimeOffset.UtcNow);

        var result = service.ValidateCallback(
            pending,
            new CloudOAuthCallbackRequest("auth-code", "state-ko", null, null));

        Assert.False(result.IsValid);
        Assert.Equal("État OAuth cloud invalide.", result.ErrorMessage);
    }

    private static CloudOAuthFlowService CreateService()
    {
        return new CloudOAuthFlowService(
            new FakeOAuthCrypto("state", "verifier"),
            new FixedTimeProvider(DateTimeOffset.Parse("2026-02-16T10:00:00Z")));
    }

    private sealed class FakeOAuthCrypto(params string[] randomValues) : ICloudOAuthCrypto
    {
        private readonly Queue<string> _randomValues = new(randomValues);

        public string CreateRandomBase64Url(int size)
        {
            return _randomValues.Dequeue();
        }

        public string BuildCodeChallenge(string verifier)
        {
            return $"challenge-{verifier}";
        }

        public bool FixedTimeEquals(string left, string right)
        {
            return string.Equals(left, right, StringComparison.Ordinal);
        }
    }

    private sealed class FixedTimeProvider(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
    }
}
