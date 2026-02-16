namespace BikeVoyager.Api.Cloud.OAuth;

public interface ICloudOAuthCrypto
{
    string CreateRandomBase64Url(int size);
    string BuildCodeChallenge(string verifier);
    bool FixedTimeEquals(string left, string right);
}
