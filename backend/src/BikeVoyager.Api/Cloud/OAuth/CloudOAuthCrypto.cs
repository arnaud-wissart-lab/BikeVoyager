using System.Security.Cryptography;
using System.Text;

namespace BikeVoyager.Api.Cloud.OAuth;

public sealed class CloudOAuthCrypto : ICloudOAuthCrypto
{
    public string CreateRandomBase64Url(int size)
    {
        var bytes = RandomNumberGenerator.GetBytes(size);
        return ToBase64Url(bytes);
    }

    public string BuildCodeChallenge(string verifier)
    {
        var verifierBytes = Encoding.UTF8.GetBytes(verifier);
        var digest = SHA256.HashData(verifierBytes);
        return ToBase64Url(digest);
    }

    public bool FixedTimeEquals(string left, string right)
    {
        var leftBytes = Encoding.UTF8.GetBytes(left);
        var rightBytes = Encoding.UTF8.GetBytes(right);
        return leftBytes.Length == rightBytes.Length &&
               CryptographicOperations.FixedTimeEquals(leftBytes, rightBytes);
    }

    private static string ToBase64Url(ReadOnlySpan<byte> value) =>
        Convert.ToBase64String(value)
            .Replace('+', '-')
            .Replace('/', '_')
            .TrimEnd('=');
}
