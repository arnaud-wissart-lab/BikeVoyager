namespace BikeVoyager.Api.Valhalla;

public static class ValhallaEndpoints
{
    public static IEndpointRouteBuilder MapValhallaEndpoints(
        this IEndpointRouteBuilder endpoints,
        string? valhallaDataPath,
        string? valhallaBaseUrl)
    {
        var valhalla = endpoints.MapGroup("/api/v1/valhalla");

        valhalla.MapGet("/status",
                async (CancellationToken cancellationToken) =>
                {
                    var activeDataPath = ValhallaRuntime.ResolveActiveDataPath(valhallaDataPath);
                    var ready = ValhallaRuntime.IsReady(valhallaDataPath, out var reason);
                    var hasMarker = ValhallaRuntime.HasReadyMarker(valhallaDataPath);
                    var buildProgress = ValhallaRuntime.ReadBuildProgress(valhallaDataPath, ready);
                    var updateStatus = ValhallaRuntime.ReadUpdateStatus(valhallaDataPath);
                    var buildRunning = string.Equals(buildProgress.State, "running", StringComparison.OrdinalIgnoreCase);
                    var (serviceReachable, serviceError) = ready
                        ? await ValhallaRuntime.ProbeServiceAsync(valhallaBaseUrl, cancellationToken)
                        : (false, (string?)null);

                    var message = !ready
                        ? ValhallaRuntime.BuildNotReadyMessage(buildProgress, reason)
                        : buildRunning
                            ? "Valhalla est prêt. Mise à jour OSM en cours en arrière-plan."
                            : updateStatus.UpdateAvailable
                                ? "Valhalla est prêt. Une mise à jour OSM est disponible."
                                : serviceReachable
                                    ? "Valhalla est prêt."
                                    : "Valhalla est prêt mais le service n'est pas joignable.";

                    return Results.Ok(new
                    {
                        ready,
                        reason = ready ? null : reason,
                        marker_exists = hasMarker,
                        service_reachable = serviceReachable,
                        service_error = serviceError,
                        data_path = valhallaDataPath,
                        active_data_path = activeDataPath,
                        base_url = valhallaBaseUrl,
                        build = new
                        {
                            state = buildProgress.State,
                            phase = buildProgress.Phase,
                            progress_pct = buildProgress.ProgressPct,
                            message = buildProgress.Message,
                            updated_at = buildProgress.UpdatedAt,
                        },
                        update = new
                        {
                            state = updateStatus.State,
                            update_available = updateStatus.UpdateAvailable,
                            reason = updateStatus.Reason,
                            message = updateStatus.Message,
                            checked_at = updateStatus.CheckedAt,
                            next_check_at = updateStatus.NextCheckAt,
                            marker_exists = updateStatus.MarkerExists,
                            remote = updateStatus.Remote,
                        },
                        message,
                    });
                })
            .WithName("ValhallaStatus");

        valhalla.MapPost("/update/start",
                (bool? force, ILogger<global::Program> logger) =>
                {
                    var forceRebuild = force is true;
                    var updateStatus = ValhallaRuntime.ReadUpdateStatus(valhallaDataPath);

                    if (!forceRebuild && !updateStatus.UpdateAvailable)
                    {
                        return Results.BadRequest(new
                        {
                            status = "no_update",
                            reason = updateStatus.Reason,
                            message = "Aucune mise à jour OSM n'est actuellement disponible.",
                        });
                    }

                    var launchResult = ValhallaRuntime.TryStartBuildInBackground(valhallaDataPath, forceRebuild);
                    if (!launchResult.Started)
                    {
                        logger.LogWarning(
                            "Lancement manuel du build Valhalla impossible ({Reason}): {Message}",
                            launchResult.Reason,
                            launchResult.Message);

                        var statusCode = launchResult.Reason switch
                        {
                            "already_running" => StatusCodes.Status409Conflict,
                            "no_script" => StatusCodes.Status503ServiceUnavailable,
                            "no_shell" => StatusCodes.Status503ServiceUnavailable,
                            _ => StatusCodes.Status500InternalServerError,
                        };

                        return Results.Json(
                            new
                            {
                                status = "error",
                                reason = launchResult.Reason,
                                message = launchResult.Message,
                            },
                            statusCode: statusCode);
                    }

                    logger.LogInformation(
                        "Build Valhalla lancé en arrière-plan (pid={Pid}, force={Force}).",
                        launchResult.Pid,
                        forceRebuild);

                    return Results.Accepted(
                        "/api/v1/valhalla/status",
                        new
                        {
                            status = "started",
                            forced = forceRebuild,
                            pid = launchResult.Pid,
                            message = "Mise à jour Valhalla lancée en arrière-plan.",
                        });
                })
            .WithName("StartValhallaUpdate");

        valhalla.MapGet("/ready",
                async (CancellationToken cancellationToken) =>
                {
                    if (!ValhallaRuntime.IsReady(valhallaDataPath, out var reason))
                    {
                        var buildProgress = ValhallaRuntime.ReadBuildProgress(valhallaDataPath, ready: false);
                        return Results.Json(
                            new
                            {
                                status = "not_ready",
                                reason,
                                message = ValhallaRuntime.BuildNotReadyMessage(buildProgress, reason),
                                build = new
                                {
                                    state = buildProgress.State,
                                    phase = buildProgress.Phase,
                                    progress_pct = buildProgress.ProgressPct,
                                    message = buildProgress.Message,
                                    updated_at = buildProgress.UpdatedAt,
                                },
                            },
                            statusCode: StatusCodes.Status503ServiceUnavailable);
                    }

                    var (serviceReachable, serviceError) = await ValhallaRuntime.ProbeServiceAsync(
                        valhallaBaseUrl,
                        cancellationToken);

                    if (!serviceReachable)
                    {
                        return Results.Json(
                            new
                            {
                                status = "not_reachable",
                                reason = serviceError ?? "service_injoignable",
                                message = "Valhalla est préparé mais le service ne répond pas.",
                            },
                            statusCode: StatusCodes.Status503ServiceUnavailable);
                    }

                    return Results.Ok(new { status = "ready" });
                })
            .WithName("ValhallaReady");

        return endpoints;
    }
}
