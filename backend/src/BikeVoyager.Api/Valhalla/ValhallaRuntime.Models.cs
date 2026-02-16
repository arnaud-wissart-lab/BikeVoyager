namespace BikeVoyager.Api.Valhalla;

internal sealed record ValhallaBuildProgress(
    string State,
    string Phase,
    int ProgressPct,
    string Message,
    string? UpdatedAt);

internal sealed record ValhallaBuildStartResult(
    bool Started,
    string Reason,
    string Message,
    int? Pid);

internal sealed record ValhallaUpdateStatus(
    string State,
    bool UpdateAvailable,
    string Reason,
    string Message,
    string? CheckedAt,
    string? NextCheckAt,
    bool MarkerExists,
    ValhallaUpdateRemote Remote);

internal sealed record ValhallaUpdateRemote(
    string? Etag,
    string? LastModified,
    long? ContentLength,
    string? CheckedAt,
    bool Available,
    string? Error);
