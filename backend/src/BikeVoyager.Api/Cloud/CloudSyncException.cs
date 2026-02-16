namespace BikeVoyager.Api.Cloud;

public sealed class CloudSyncException(string message, int statusCode = StatusCodes.Status400BadRequest)
    : Exception(message)
{
    public int StatusCode { get; } = statusCode;
}
