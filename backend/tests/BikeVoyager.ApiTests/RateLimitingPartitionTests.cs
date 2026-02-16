using System.Net;
using BikeVoyager.Api.Extensions;
using Microsoft.AspNetCore.Http;

namespace BikeVoyager.ApiTests;

public class RateLimitingPartitionTests
{
    [Fact]
    public void BuildRateLimitPartitionKey_ignore_le_header_x_forwarded_for_non_truste()
    {
        var remoteIp = IPAddress.Parse("10.20.30.40");

        var firstContext = new DefaultHttpContext();
        firstContext.Connection.RemoteIpAddress = remoteIp;
        firstContext.Request.Headers["X-Forwarded-For"] = "203.0.113.1";

        var secondContext = new DefaultHttpContext();
        secondContext.Connection.RemoteIpAddress = remoteIp;
        secondContext.Request.Headers["X-Forwarded-For"] = "198.51.100.2";

        var firstKey = ApiRequestIdentity.BuildRateLimitPartitionKey(firstContext);
        var secondKey = ApiRequestIdentity.BuildRateLimitPartitionKey(secondContext);

        Assert.Equal(remoteIp.ToString(), firstKey);
        Assert.Equal(firstKey, secondKey);
    }
}
