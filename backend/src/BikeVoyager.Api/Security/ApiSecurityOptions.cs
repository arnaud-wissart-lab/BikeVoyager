namespace BikeVoyager.Api.Security;

public sealed class ApiSecurityOptions
{
    public string[] AllowedOrigins { get; set; } = [];
    public int GeneralRequestsPerMinute { get; set; } = 180;
    public int ComputeRequestsPerMinute { get; set; } = 40;
    public int ExportRequestsPerMinute { get; set; } = 60;
    public bool EnforceOriginForUnsafeMethods { get; set; } = true;
    public string AnonymousSessionCookieName { get; set; } = "bv_anon_sid";
    public int AnonymousSessionLifetimeHours { get; set; } = 720;
}
