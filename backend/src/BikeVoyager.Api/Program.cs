using BikeVoyager.Api.Extensions;
using BikeVoyager.Api.Cloud;
using BikeVoyager.Api.Feedback;
using BikeVoyager.Api.Exports;
using BikeVoyager.Api.Filters;
using BikeVoyager.Api.Middleware;
using BikeVoyager.Api.Security;
using BikeVoyager.Application.Geocoding;
using BikeVoyager.Application.Integrations;
using BikeVoyager.Application.Pois;
using BikeVoyager.Application.Routing;
using BikeVoyager.Application.Trips;
using BikeVoyager.Infrastructure;
using FluentValidation;
using Polly.CircuitBreaker;
using Serilog;
using Serilog.Formatting.Compact;
using System.Diagnostics;
using System.IO;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;

var builder = WebApplication.CreateBuilder(args);

Log.Logger = new LoggerConfiguration()
    .Enrich.FromLogContext()
    .Enrich.WithCorrelationId()
    .WriteTo.Console(new RenderedCompactJsonFormatter())
    .CreateLogger();

builder.Host.UseSerilog((context, _, config) =>
{
    config.ReadFrom.Configuration(context.Configuration)
        .Enrich.FromLogContext()
        .Enrich.WithCorrelationId()
        .WriteTo.Console(new RenderedCompactJsonFormatter());
});

builder.Services.AddProblemDetails(options =>
{
    options.CustomizeProblemDetails = context =>
    {
        var correlationId = context.HttpContext.Response.Headers[CorrelationIdMiddleware.HeaderName].FirstOrDefault()
            ?? context.HttpContext.TraceIdentifier;
        context.ProblemDetails.Extensions["correlationId"] = correlationId;
    };
});

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddOpenApi();
builder.Services.AddDataProtection();

builder.Services.AddValidatorsFromAssemblyContaining<CreateTripRequestValidator>();
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.Configure<CloudSyncOptions>(
    builder.Configuration.GetSection("CloudSync"));
builder.Services.AddSingleton<CloudSessionStore>();
builder.Services.AddHttpClient<CloudSyncService>(client =>
{
    client.Timeout = TimeSpan.FromSeconds(25);
});
builder.Services.Configure<FeedbackOptions>(
    builder.Configuration.GetSection("Feedback"));
builder.Services.AddSingleton<IFeedbackSender, FeedbackEmailSender>();
builder.Services.Configure<ApiSecurityOptions>(
    builder.Configuration.GetSection("ApiSecurity"));

var apiSecurity = builder.Configuration
    .GetSection("ApiSecurity")
    .Get<ApiSecurityOptions>() ?? new ApiSecurityOptions();

var allowedOrigins = apiSecurity.AllowedOrigins
    .Where(origin => !string.IsNullOrWhiteSpace(origin))
    .Select(origin => origin.Trim())
    .Distinct(StringComparer.OrdinalIgnoreCase)
    .ToArray();

if (allowedOrigins.Length > 0)
{
    builder.Services.AddCors(options =>
    {
        options.AddPolicy("FrontApp", policy =>
        {
            policy.WithOrigins(allowedOrigins)
                .AllowAnyHeader()
                .AllowAnyMethod()
                .AllowCredentials();
        });
    });
}

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = async (context, cancellationToken) =>
    {
        context.HttpContext.Response.ContentType = "application/json";
        await context.HttpContext.Response.WriteAsync(
            JsonSerializer.Serialize(new
            {
                message = "Trop de requêtes. Réessayez dans quelques instants.",
            }),
            cancellationToken);
    };

    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(httpContext =>
    {
        var key = BuildRateLimitPartitionKey(httpContext);
        return RateLimitPartition.GetSlidingWindowLimiter(
            key,
            _ => new SlidingWindowRateLimiterOptions
            {
                PermitLimit = Math.Max(10, apiSecurity.GeneralRequestsPerMinute),
                Window = TimeSpan.FromMinutes(1),
                SegmentsPerWindow = 6,
                QueueLimit = 0,
                AutoReplenishment = true,
            });
    });

    options.AddPolicy("compute-heavy", httpContext =>
    {
        var key = BuildRateLimitPartitionKey(httpContext);
        return RateLimitPartition.GetSlidingWindowLimiter(
            key,
            _ => new SlidingWindowRateLimiterOptions
            {
                PermitLimit = Math.Max(5, apiSecurity.ComputeRequestsPerMinute),
                Window = TimeSpan.FromMinutes(1),
                SegmentsPerWindow = 6,
                QueueLimit = 0,
                AutoReplenishment = true,
            });
    });

    options.AddPolicy("export", httpContext =>
    {
        var key = BuildRateLimitPartitionKey(httpContext);
        return RateLimitPartition.GetSlidingWindowLimiter(
            key,
            _ => new SlidingWindowRateLimiterOptions
            {
                PermitLimit = Math.Max(5, apiSecurity.ExportRequestsPerMinute),
                Window = TimeSpan.FromMinutes(1),
                SegmentsPerWindow = 6,
                QueueLimit = 0,
                AutoReplenishment = true,
            });
    });

    options.AddPolicy("feedback", httpContext =>
    {
        var key = BuildRateLimitPartitionKey(httpContext);
        return RateLimitPartition.GetSlidingWindowLimiter(
            $"{key}:feedback",
            _ => new SlidingWindowRateLimiterOptions
            {
                PermitLimit = Math.Max(2, Math.Min(10, apiSecurity.ExportRequestsPerMinute / 4)),
                Window = TimeSpan.FromMinutes(1),
                SegmentsPerWindow = 6,
                QueueLimit = 0,
                AutoReplenishment = true,
            });
    });
});

static string BuildRateLimitPartitionKey(HttpContext context)
{
    if (AnonymousApiSessionContext.TryGetSessionId(context, out var sessionId) &&
        !string.IsNullOrWhiteSpace(sessionId))
    {
        return sessionId;
    }

    var forwardedFor = context.Request.Headers["X-Forwarded-For"].FirstOrDefault();
    if (!string.IsNullOrWhiteSpace(forwardedFor))
    {
        var firstValue = forwardedFor.Split(',')[0].Trim();
        if (!string.IsNullOrWhiteSpace(firstValue))
        {
            return firstValue;
        }
    }

    return context.Connection.RemoteIpAddress?.ToString() ??
           context.TraceIdentifier;
}

static string ResolveRequestSessionId(HttpContext context)
{
    if (AnonymousApiSessionContext.TryGetSessionId(context, out var sessionId) &&
        !string.IsNullOrWhiteSpace(sessionId))
    {
        return sessionId;
    }

    return context.TraceIdentifier;
}

var valhallaDataPath = builder.Configuration["Valhalla:DataPath"];
var valhallaBaseUrl = builder.Configuration["Valhalla:BaseUrl"];

var app = builder.Build();

app.UseCorrelationId();
app.UseSerilogRequestLogging();
app.UseExceptionHandler();
app.UseStatusCodePages();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}
else
{
    app.UseHttpsRedirection();
}

if (allowedOrigins.Length > 0)
{
    app.UseCors("FrontApp");
}

app.UseAnonymousApiSession();
app.UseApiOriginGuard();
app.UseRateLimiter();

var places = app.MapGroup("/api/places");

places.MapGet("/search",
        async (string? q, int? limit, string? mode, IGeocodingService geocoding, CancellationToken cancellationToken) =>
        {
            if (string.IsNullOrWhiteSpace(q) || q.Trim().Length < 2)
            {
                return Results.BadRequest(new { message = "Le paramètre 'q' est obligatoire (minimum 2 caractères)." });
            }

            var resolvedLimit = Math.Clamp(limit ?? 8, 1, 20);
            var searchMode = GeocodingSearchMode.Auto;
            if (!string.IsNullOrWhiteSpace(mode)
                && Enum.TryParse<GeocodingSearchMode>(mode, true, out var parsedMode))
            {
                searchMode = parsedMode;
            }

            var results = await geocoding.SearchAsync(q, resolvedLimit, searchMode, cancellationToken);
            return Results.Ok(results);
        })
    .WithName("SearchPlaces");

places.MapGet("/reverse",
        async (double? lat, double? lon, IGeocodingService geocoding, CancellationToken cancellationToken) =>
        {
            if (lat is null || lon is null)
            {
                return Results.BadRequest(new { message = "Les paramètres 'lat' et 'lon' sont obligatoires." });
            }

            if (lat is < -90 or > 90 || lon is < -180 or > 180)
            {
                return Results.BadRequest(new { message = "Les paramètres 'lat' et 'lon' sont invalides." });
            }

            var result = await geocoding.ReverseAsync(lat.Value, lon.Value, cancellationToken);
            return result is null ? Results.NotFound() : Results.Ok(result);
        })
    .WithName("ReversePlace");

app.MapGet("/api/poi/around-route",
        async (string? geometry,
            string? categories,
            double? distance,
            double? corridor,
            string? language,
            int? limit,
            HttpContext httpContext,
            IPoiService poiService,
            ILogger<Program> logger,
            CancellationToken cancellationToken) =>
        {
            if (!TryParseGeometry(geometry, out var parsedGeometry, out var geometryError))
            {
                return Results.BadRequest(new { message = geometryError });
            }

            var categoryList = ParseCategories(categories);
            if (categories is not null && categoryList.Count == 0)
            {
                return Results.BadRequest(new
                {
                    message = "Les categories sont invalides. Valeurs autorisees: monuments, paysages, commerces, services.",
                });
            }

            return await FetchPoisAroundRouteAsync(
                parsedGeometry!,
                categoryList,
                distance,
                corridor,
                limit,
                language,
                httpContext,
                poiService,
                logger,
                cancellationToken);
        })
    .RequireRateLimiting("compute-heavy")
    .WithName("PoiAroundRoute");

app.MapPost("/api/poi/around-route",
        async (PoiAroundRoutePayload payload,
            HttpContext httpContext,
            IPoiService poiService,
            ILogger<Program> logger,
            CancellationToken cancellationToken) =>
        {
            var geometryRaw = GetGeometryRaw(payload.Geometry);
            if (!TryParseGeometry(geometryRaw, out var parsedGeometry, out var geometryError))
            {
                return Results.BadRequest(new { message = geometryError });
            }

            var categoryList = ParseCategories(payload.Categories);
            if (payload.Categories is { Length: > 0 } && categoryList.Count == 0)
            {
                return Results.BadRequest(new
                {
                    message = "Les categories sont invalides. Valeurs autorisees: monuments, paysages, commerces, services.",
                });
            }

            return await FetchPoisAroundRouteAsync(
                parsedGeometry!,
                categoryList,
                payload.Distance,
                payload.Corridor,
                payload.Limit,
                payload.Language,
                httpContext,
                poiService,
                logger,
                cancellationToken);
        })
    .RequireRateLimiting("compute-heavy")
    .WithName("PoiAroundRoutePost");

app.MapPost("/api/route",
        async (RouteRequest request,
            IRouteService routing,
            HttpContext httpContext,
            ILogger<Program> logger,
            CancellationToken cancellationToken) =>
        {
            try
            {
                if (!IsValhallaReady(valhallaDataPath, out var notReadyReason))
                {
                    var buildProgress = ReadValhallaBuildProgress(valhallaDataPath, ready: false);
                    logger.LogWarning("Valhalla non prêt: {Reason}", notReadyReason);
                    return Results.Json(
                        new
                        {
                            message = BuildValhallaNotReadyMessage(buildProgress, notReadyReason),
                            build = new
                            {
                                state = buildProgress.State,
                                phase = buildProgress.Phase,
                                progress_pct = buildProgress.ProgressPct,
                                message = buildProgress.Message,
                                updated_at = buildProgress.UpdatedAt
                            }
                        },
                        statusCode: 503);
                }

                var response = await routing.ComputeAsync(request, cancellationToken);
                var sessionId = ResolveRequestSessionId(httpContext);

                logger.LogInformation(
                    "RouteComputed {DurationSeconds} {DistanceMeters} {Mode} {SessionId}",
                    response.DurationSecondsEngine,
                    response.DistanceMeters,
                    request.Mode,
                    sessionId);

                if (request.Waypoints is { Count: > 0 })
                {
                    logger.LogInformation(
                        "WaypointsApplied {WaypointsCount} {SessionId}",
                        request.Waypoints.Count,
                        sessionId);
                    logger.LogInformation(
                        "RouteRecomputed {WaypointsCount} {SessionId}",
                        request.Waypoints.Count,
                        sessionId);
                }

                return Results.Ok(response);
            }
            catch (TaskCanceledException ex)
            {
                logger.LogWarning(ex, "Timeout Valhalla.");
                return Results.StatusCode(504);
            }
            catch (BrokenCircuitException ex)
            {
                logger.LogWarning(ex, "Valhalla temporairement indisponible.");
                return Results.StatusCode(503);
            }
            catch (HttpRequestException ex)
            {
                logger.LogWarning(ex, "Échec de l'appel Valhalla.");
                return Results.StatusCode(502);
            }
            catch (InvalidOperationException ex)
            {
                logger.LogWarning(ex, "Réponse Valhalla invalide.");
                return Results.StatusCode(502);
            }
        })
    .AddEndpointFilter<ValidationFilter<RouteRequest>>()
    .RequireRateLimiting("compute-heavy")
    .WithName("ComputeRoute");

app.MapPost("/api/loop",
        async (LoopRequest request,
            ILoopService loops,
            HttpContext httpContext,
            ILogger<Program> logger,
            CancellationToken cancellationToken) =>
        {
            var stopwatch = Stopwatch.StartNew();

            try
            {
                if (!IsValhallaReady(valhallaDataPath, out var notReadyReason))
                {
                    var buildProgress = ReadValhallaBuildProgress(valhallaDataPath, ready: false);
                    logger.LogWarning("Valhalla non prêt: {Reason}", notReadyReason);
                    return Results.Json(
                        new
                        {
                            message = BuildValhallaNotReadyMessage(buildProgress, notReadyReason),
                            build = new
                            {
                                state = buildProgress.State,
                                phase = buildProgress.Phase,
                                progress_pct = buildProgress.ProgressPct,
                                message = buildProgress.Message,
                                updated_at = buildProgress.UpdatedAt
                            }
                        },
                        statusCode: 503);
                }

                var response = await loops.ComputeAsync(request, cancellationToken);
                var sessionId = ResolveRequestSessionId(httpContext);

                logger.LogInformation(
                    "LoopComputed {DistanceMeters} {OverlapScore} {DurationMs} {Mode} {Variation} {SessionId}",
                    response.DistanceMeters,
                    response.OverlapScore,
                    stopwatch.ElapsedMilliseconds,
                    request.Mode,
                    request.Variation,
                    sessionId);

                if (request.Waypoints is { Count: > 0 })
                {
                    logger.LogInformation(
                        "WaypointsApplied {WaypointsCount} {SessionId}",
                        request.Waypoints.Count,
                        sessionId);
                    logger.LogInformation(
                        "RouteRecomputed {WaypointsCount} {SessionId}",
                        request.Waypoints.Count,
                        sessionId);
                }

                return Results.Ok(response);
            }
            catch (LoopNotFoundException ex)
            {
                logger.LogWarning(ex, "Impossible de générer une boucle satisfaisante.");
                return Results.UnprocessableEntity(new { message = ex.Message });
            }
            catch (TaskCanceledException ex)
            {
                logger.LogWarning(ex, "Timeout Valhalla.");
                return Results.StatusCode(504);
            }
            catch (BrokenCircuitException ex)
            {
                logger.LogWarning(ex, "Valhalla temporairement indisponible.");
                return Results.StatusCode(503);
            }
            catch (HttpRequestException ex)
            {
                logger.LogWarning(ex, "Échec de l'appel Valhalla.");
                return Results.StatusCode(502);
            }
            catch (InvalidOperationException ex)
            {
                logger.LogWarning(ex, "Réponse Valhalla invalide.");
                return Results.StatusCode(502);
            }
        })
    .AddEndpointFilter<ValidationFilter<LoopRequest>>()
    .RequireRateLimiting("compute-heavy")
    .WithName("ComputeLoop");

app.MapPost("/api/export/gpx",
        (ExportGpxRequest request, ILogger<Program> logger) =>
        {
            if (!GpxExportBuilder.TryBuild(request, out var gpx, out var error))
            {
                logger.LogWarning("GpxExportInvalid {Error}", error);
                return Results.BadRequest(new { message = error ?? "Requête invalide." });
            }

            var fileName = GpxExportBuilder.BuildFileName(request.Name);
            var payload = Encoding.UTF8.GetBytes(gpx);
            return Results.File(payload, "application/gpx+xml", fileName);
        })
    .RequireRateLimiting("export")
    .WithName("ExportGpx");

app.MapCloudSyncEndpoints();
app.MapFeedbackEndpoints();

app.MapGet("/api/valhalla/status",
        async (CancellationToken cancellationToken) =>
        {
            var activeDataPath = ResolveValhallaActiveDataPath(valhallaDataPath);
            var ready = IsValhallaReady(valhallaDataPath, out var reason);
            var hasMarker = HasValhallaReadyMarker(valhallaDataPath);
            var buildProgress = ReadValhallaBuildProgress(valhallaDataPath, ready);
            var updateStatus = ReadValhallaUpdateStatus(valhallaDataPath);
            var buildRunning = string.Equals(buildProgress.State, "running", StringComparison.OrdinalIgnoreCase);
            var (serviceReachable, serviceError) = ready
                ? await ProbeValhallaServiceAsync(valhallaBaseUrl, cancellationToken)
                : (false, (string?)null);

            var message = !ready
                ? BuildValhallaNotReadyMessage(buildProgress, reason)
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
                    updated_at = buildProgress.UpdatedAt
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
                    remote = updateStatus.Remote
                },
                message
            });
        })
    .WithName("ValhallaStatus");

app.MapPost("/api/valhalla/update/start",
        (bool? force, ILogger<Program> logger) =>
        {
            var forceRebuild = force is true;
            var updateStatus = ReadValhallaUpdateStatus(valhallaDataPath);

            if (!forceRebuild && !updateStatus.UpdateAvailable)
            {
                return Results.BadRequest(new
                {
                    status = "no_update",
                    reason = updateStatus.Reason,
                    message = "Aucune mise à jour OSM n'est actuellement disponible."
                });
            }

            var launchResult = TryStartValhallaBuildInBackground(valhallaDataPath, forceRebuild);
            if (!launchResult.Started)
            {
                logger.LogWarning(
                    "Lancement manuel du build Valhalla impossible ({Reason}): {Message}",
                    launchResult.Reason,
                    launchResult.Message);

                var statusCode = launchResult.Reason switch
                {
                    "already_running" => 409,
                    "no_script" => 503,
                    "no_shell" => 503,
                    _ => 500
                };

                return Results.Json(
                    new
                    {
                        status = "error",
                        reason = launchResult.Reason,
                        message = launchResult.Message
                    },
                    statusCode: statusCode);
            }

            logger.LogInformation(
                "Build Valhalla lancé en arrière-plan (pid={Pid}, force={Force}).",
                launchResult.Pid,
                forceRebuild);

            return Results.Accepted(
                "/api/valhalla/status",
                new
                {
                    status = "started",
                    forced = forceRebuild,
                    pid = launchResult.Pid,
                    message = "Mise à jour Valhalla lancée en arrière-plan."
                });
        })
    .WithName("StartValhallaUpdate");

app.MapGet("/api/valhalla/ready",
        async (CancellationToken cancellationToken) =>
        {
            if (!IsValhallaReady(valhallaDataPath, out var reason))
            {
                var buildProgress = ReadValhallaBuildProgress(valhallaDataPath, ready: false);
                return Results.Json(
                    new
                    {
                        status = "not_ready",
                        reason,
                        message = BuildValhallaNotReadyMessage(buildProgress, reason),
                        build = new
                        {
                            state = buildProgress.State,
                            phase = buildProgress.Phase,
                            progress_pct = buildProgress.ProgressPct,
                            message = buildProgress.Message,
                            updated_at = buildProgress.UpdatedAt
                        }
                    },
                    statusCode: 503);
            }

            var (serviceReachable, serviceError) = await ProbeValhallaServiceAsync(
                valhallaBaseUrl,
                cancellationToken);

            if (!serviceReachable)
            {
                return Results.Json(
                    new
                    {
                        status = "not_reachable",
                        reason = serviceError ?? "service_injoignable",
                        message = "Valhalla est préparé mais le service ne répond pas."
                    },
                    statusCode: 503);
            }

            return Results.Ok(new { status = "ready" });
        })
    .WithName("ValhallaReady");

var api = app.MapGroup("/api/v1");

api.MapGet("/health", () => Results.Ok(new { status = "ok" }))
    .WithName("Health");

api.MapGet("/trips", async (ITripService trips, CancellationToken cancellationToken) =>
    Results.Ok(await trips.ListAsync(cancellationToken)))
    .WithName("ListTrips");

api.MapPost("/trips", async (CreateTripRequest request, ITripService trips, CancellationToken cancellationToken) =>
    {
        var created = await trips.CreateAsync(request, cancellationToken);
        return Results.Created($"/api/v1/trips/{created.Id}", created);
    })
    .AddEndpointFilter<ValidationFilter<CreateTripRequest>>()
    .WithName("CreateTrip");

api.MapGet("/external/ping", async (IExternalPingService ping, CancellationToken cancellationToken) =>
    {
        var ok = await ping.PingAsync(cancellationToken);
        return ok ? Results.Ok(new { status = "ok" }) : Results.StatusCode(502);
    })
    .WithName("ExternalPing");

TryStartAutomaticValhallaUpdateIfAvailable(valhallaDataPath, app.Logger);

app.Run();

public partial class Program
{
    private static readonly string[] AllowedPoiCategories = { "monuments", "paysages", "commerces", "services" };
    private static readonly object ValhallaBuildLaunchLock = new();
    private static Process? ValhallaBuildBackgroundProcess;
    private const int DefaultPoiLimit = 5000;

    sealed record PoiAroundRoutePayload(
        JsonElement Geometry,
        string[]? Categories,
        double? Distance,
        double? Corridor,
        string? Language,
        int? Limit);

    static async Task<IResult> FetchPoisAroundRouteAsync(
        GeoJsonLineString geometry,
        IReadOnlyList<string> categoryList,
        double? distance,
        double? corridor,
        int? limit,
        string? language,
        HttpContext httpContext,
        IPoiService poiService,
        Microsoft.Extensions.Logging.ILogger logger,
        CancellationToken cancellationToken)
    {
        var corridorMeters = Math.Clamp(distance ?? corridor ?? 800, 50, 5000);
        var safeLimit = Math.Clamp(limit ?? DefaultPoiLimit, 1, DefaultPoiLimit);
        var preferredLanguage = ResolvePoiLanguage(
            language,
            httpContext.Request.Headers.AcceptLanguage.ToString());
        var request = new PoiAroundRouteRequest(
            geometry,
            categoryList,
            corridorMeters,
            safeLimit,
            preferredLanguage);

        try
        {
            var results = await poiService.AroundRouteAsync(request, cancellationToken);

            logger.LogInformation(
                "PoiFetched {Count} {Categories} {CorridorMeters}m {Language}",
                results.Count,
                categoryList.Count == 0 ? "default" : string.Join(',', categoryList),
                corridorMeters,
                preferredLanguage ?? "auto");

            return Results.Ok(results);
        }
        catch (TaskCanceledException ex)
        {
            logger.LogWarning(ex, "Timeout Overpass.");
            return Results.Json(
                new { message = "Le service POI a mis trop de temps à répondre." },
                statusCode: 504);
        }
        catch (HttpRequestException ex)
        {
            logger.LogWarning(ex, "Echec de l'appel Overpass.");
            return Results.Json(
                new { message = "Le service POI est temporairement indisponible." },
                statusCode: 502);
        }
        catch (InvalidOperationException ex)
        {
            logger.LogWarning(ex, "Reponse Overpass invalide.");
            return Results.Json(
                new { message = "Le service POI a retourné une réponse invalide." },
                statusCode: 502);
        }
        catch (JsonException ex)
        {
            logger.LogWarning(ex, "Reponse Overpass non lisible.");
            return Results.Json(
                new { message = "Le service POI a retourné une réponse illisible." },
                statusCode: 502);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Erreur inattendue lors du chargement des POI.");
            return Results.Json(
                new { message = "Erreur interne lors du chargement des POI." },
                statusCode: 500);
        }
    }

    static string? GetGeometryRaw(JsonElement geometry)
    {
        if (geometry.ValueKind is JsonValueKind.Undefined or JsonValueKind.Null)
        {
            return null;
        }

        return geometry.ValueKind == JsonValueKind.String
            ? geometry.GetString()
            : geometry.GetRawText();
    }

    static IReadOnlyList<string> ParseCategories(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return Array.Empty<string>();
        }

        return raw.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(category => AllowedPoiCategories.Contains(category, StringComparer.OrdinalIgnoreCase))
            .Select(category => category.ToLowerInvariant())
            .Distinct()
            .ToList();
    }

    static IReadOnlyList<string> ParseCategories(string[]? raw)
    {
        if (raw is null || raw.Length == 0)
        {
            return Array.Empty<string>();
        }

        return raw
            .Where(category => !string.IsNullOrWhiteSpace(category))
            .Select(category => category.Trim())
            .Where(category => AllowedPoiCategories.Contains(category, StringComparer.OrdinalIgnoreCase))
            .Select(category => category.ToLowerInvariant())
            .Distinct()
            .ToList();
    }

    static string? ResolvePoiLanguage(string? requestedLanguage, string? acceptLanguage)
    {
        var normalizedRequested = NormalizePoiLanguage(requestedLanguage);
        if (normalizedRequested is not null)
        {
            return normalizedRequested;
        }

        if (string.IsNullOrWhiteSpace(acceptLanguage))
        {
            return null;
        }

        var segments = acceptLanguage.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        foreach (var segment in segments)
        {
            var token = segment.Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)[0];
            var normalized = NormalizePoiLanguage(token);
            if (normalized is not null)
            {
                return normalized;
            }
        }

        return null;
    }

    static string? NormalizePoiLanguage(string? language)
    {
        if (string.IsNullOrWhiteSpace(language))
        {
            return null;
        }

        var trimmed = language.Trim();
        if (trimmed.StartsWith("fr", StringComparison.OrdinalIgnoreCase))
        {
            return "fr";
        }

        if (trimmed.StartsWith("en", StringComparison.OrdinalIgnoreCase))
        {
            return "en";
        }

        return null;
    }

    static bool TryParseGeometry(
        string? raw,
        out GeoJsonLineString? geometry,
        out string error)
    {
        geometry = null;
        error = "Le paramètre 'geometry' est obligatoire.";

        if (string.IsNullOrWhiteSpace(raw))
        {
            return false;
        }

        var trimmed = raw.Trim();

        if (trimmed.StartsWith("{", StringComparison.Ordinal) || trimmed.StartsWith("[", StringComparison.Ordinal))
        {
            if (!TryParseGeoJsonGeometry(trimmed, out geometry))
            {
                error = "Le paramètre 'geometry' est invalide.";
                return false;
            }

            return true;
        }

        try
        {
            var decoded = PolylineDecoder.DecodeToCoordinates(trimmed);
            if (decoded.Count < 2)
            {
                error = "Le paramètre 'geometry' est invalide.";
                return false;
            }

            geometry = new GeoJsonLineString("LineString", decoded);
            return true;
        }
        catch
        {
            error = "Le paramètre 'geometry' est invalide.";
            return false;
        }
    }

    static bool TryParseGeoJsonGeometry(string raw, out GeoJsonLineString? geometry)
    {
        geometry = null;

        try
        {
            using var document = JsonDocument.Parse(raw);
            var root = document.RootElement;
            var coordinatesElement = root;

            if (root.ValueKind == JsonValueKind.Object &&
                root.TryGetProperty("coordinates", out var coords))
            {
                coordinatesElement = coords;
            }

            if (coordinatesElement.ValueKind != JsonValueKind.Array)
            {
                return false;
            }

            var coordinates = new List<double[]>();

            foreach (var coordinate in coordinatesElement.EnumerateArray())
            {
                if (coordinate.ValueKind != JsonValueKind.Array)
                {
                    continue;
                }

                var items = coordinate.EnumerateArray().ToArray();
                if (items.Length < 2)
                {
                    continue;
                }

                if (!items[0].TryGetDouble(out var lon) || !items[1].TryGetDouble(out var lat))
                {
                    continue;
                }

                coordinates.Add(new[] { lon, lat });
            }

            if (coordinates.Count < 2)
            {
                return false;
            }

            geometry = new GeoJsonLineString("LineString", coordinates);
            return true;
        }
        catch
        {
            return false;
        }
    }

    static void TryStartAutomaticValhallaUpdateIfAvailable(
        string? dataPath,
        Microsoft.Extensions.Logging.ILogger logger)
    {
        try
        {
            var ready = IsValhallaReady(dataPath, out _);
            var buildProgress = ReadValhallaBuildProgress(dataPath, ready);
            var buildRunning = string.Equals(buildProgress.State, "running", StringComparison.OrdinalIgnoreCase);
            if (buildRunning)
            {
                return;
            }

            var updateStatus = ReadValhallaUpdateStatus(dataPath);
            if (!updateStatus.UpdateAvailable)
            {
                return;
            }

            var launchResult = TryStartValhallaBuildInBackground(dataPath, forceRebuild: false);
            if (launchResult.Started)
            {
                logger.LogInformation(
                    "Mise à jour Valhalla lancée automatiquement en arrière-plan (pid={Pid}).",
                    launchResult.Pid);
                return;
            }

            logger.LogWarning(
                "Mise à jour Valhalla disponible, mais lancement automatique impossible ({Reason}): {Message}",
                launchResult.Reason,
                launchResult.Message);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Échec du déclenchement automatique de la mise à jour Valhalla.");
        }
    }

    static string BuildValhallaNotReadyMessage(ValhallaBuildProgress buildProgress, string? reason = null)
    {
        if (string.Equals(buildProgress.State, "running", StringComparison.OrdinalIgnoreCase))
        {
            return $"Le moteur d'itinéraire est en cours de préparation ({buildProgress.ProgressPct}%).";
        }

        if (string.Equals(buildProgress.State, "failed", StringComparison.OrdinalIgnoreCase))
        {
            return "La préparation automatique de Valhalla a échoué. Nouvelle tentative au prochain démarrage.";
        }

        if (!string.IsNullOrWhiteSpace(reason))
        {
            return $"Le moteur d'itinéraire n'est pas prêt ({reason}).";
        }

        return "Le moteur d'itinéraire est en cours de préparation. Réessayez dans quelques minutes.";
    }

    static ValhallaBuildStartResult TryStartValhallaBuildInBackground(string? dataPath, bool forceRebuild)
    {
        lock (ValhallaBuildLaunchLock)
        {
            if (ValhallaBuildBackgroundProcess is not null)
            {
                if (!ValhallaBuildBackgroundProcess.HasExited)
                {
                    return new ValhallaBuildStartResult(
                        false,
                        "already_running",
                        "Un build Valhalla est déjà en cours.",
                        null);
                }

                ValhallaBuildBackgroundProcess.Dispose();
                ValhallaBuildBackgroundProcess = null;
            }

            if (string.IsNullOrWhiteSpace(dataPath) || !Directory.Exists(dataPath))
            {
                return new ValhallaBuildStartResult(
                    false,
                    "data_path_invalid",
                    "Chemin des données Valhalla invalide.",
                    null);
            }

            var buildLockPath = Path.Combine(dataPath, ".build.lock");
            if (File.Exists(buildLockPath))
            {
                var lockReleased = TryReleaseStaleBuildLock(dataPath, buildLockPath);
                if (!lockReleased)
                {
                    return new ValhallaBuildStartResult(
                        false,
                        "already_running",
                        "Un build Valhalla est déjà en cours.",
                        null);
                }
            }

            var repoRoot = ResolveRepoRootFromValhallaDataPath(dataPath);
            if (string.IsNullOrWhiteSpace(repoRoot) || !Directory.Exists(repoRoot))
            {
                return new ValhallaBuildStartResult(
                    false,
                    "repo_root_not_found",
                    "Impossible de localiser la racine du dépôt.",
                    null);
            }

            var scriptsDir = Path.Combine(repoRoot, "scripts");
            ProcessStartInfo startInfo;

            if (OperatingSystem.IsWindows())
            {
                var shell = ResolveWindowsShell();
                if (string.IsNullOrWhiteSpace(shell))
                {
                    return new ValhallaBuildStartResult(
                        false,
                        "no_shell",
                        "pwsh/powershell introuvable.",
                        null);
                }

                var scriptPath = Path.Combine(scriptsDir, "valhalla-build-france.ps1");
                if (!File.Exists(scriptPath))
                {
                    return new ValhallaBuildStartResult(
                        false,
                        "no_script",
                        "Script valhalla-build-france.ps1 introuvable.",
                        null);
                }

                startInfo = new ProcessStartInfo
                {
                    FileName = shell,
                    WorkingDirectory = repoRoot,
                    UseShellExecute = false,
                    CreateNoWindow = true
                };

                startInfo.ArgumentList.Add("-NoProfile");
                startInfo.ArgumentList.Add("-ExecutionPolicy");
                startInfo.ArgumentList.Add("Bypass");
                startInfo.ArgumentList.Add("-File");
                startInfo.ArgumentList.Add(scriptPath);
            }
            else
            {
                var scriptPath = Path.Combine(scriptsDir, "valhalla-build-france.sh");
                if (!File.Exists(scriptPath))
                {
                    return new ValhallaBuildStartResult(
                        false,
                        "no_script",
                        "Script valhalla-build-france.sh introuvable.",
                        null);
                }

                startInfo = new ProcessStartInfo
                {
                    FileName = "/bin/sh",
                    WorkingDirectory = repoRoot,
                    UseShellExecute = false,
                    CreateNoWindow = true
                };

                startInfo.ArgumentList.Add(scriptPath);
            }

            if (forceRebuild)
            {
                startInfo.Environment["VALHALLA_FORCE_REBUILD"] = "true";
            }

            Process? process;
            try
            {
                process = Process.Start(startInfo);
            }
            catch (Exception ex)
            {
                return new ValhallaBuildStartResult(
                    false,
                    "start_failed",
                    ex.Message,
                    null);
            }

            if (process is null)
            {
                return new ValhallaBuildStartResult(
                    false,
                    "start_failed",
                    "Le processus de build n'a pas pu être démarré.",
                    null);
            }

            ValhallaBuildBackgroundProcess = process;
            return new ValhallaBuildStartResult(
                true,
                "started",
                "Build Valhalla lancé.",
                process.Id);
        }
    }

    static string? ResolveRepoRootFromValhallaDataPath(string? dataPath)
    {
        if (string.IsNullOrWhiteSpace(dataPath))
        {
            return null;
        }

        var infraDir = Directory.GetParent(dataPath);
        var repoDir = infraDir?.Parent;
        return repoDir?.FullName;
    }

    static bool TryReleaseStaleBuildLock(string dataPath, string buildLockPath)
    {
        if (!File.Exists(buildLockPath))
        {
            return true;
        }

        // Un build actif met a jour build-status.json regulierement (signal de vie ~30s).
        // Si ce n'est pas le cas depuis plusieurs minutes, on considere le verrou comme obsolete.
        const int staleAfterMinutes = 5;
        if (!IsBuildStatusStale(dataPath, staleAfterMinutes))
        {
            return false;
        }

        try
        {
            File.Delete(buildLockPath);
            return true;
        }
        catch
        {
            return false;
        }
    }

    static bool IsBuildStatusStale(string dataPath, int staleAfterMinutes)
    {
        var statusPath = Path.Combine(dataPath, "build-status.json");
        if (!File.Exists(statusPath))
        {
            var lockInfo = new FileInfo(Path.Combine(dataPath, ".build.lock"));
            return DateTime.UtcNow - lockInfo.LastWriteTimeUtc >= TimeSpan.FromMinutes(staleAfterMinutes);
        }

        try
        {
            using var document = JsonDocument.Parse(File.ReadAllText(statusPath));
            var root = document.RootElement;
            var state = root.TryGetProperty("state", out var stateElement)
                ? stateElement.GetString()
                : null;
            var updatedAtRaw = root.TryGetProperty("updated_at", out var updatedAtElement)
                ? updatedAtElement.GetString()
                : null;

            if (!string.Equals(state, "running", StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }

            if (DateTimeOffset.TryParse(updatedAtRaw, out var updatedAt))
            {
                return DateTimeOffset.UtcNow - updatedAt >= TimeSpan.FromMinutes(staleAfterMinutes);
            }

            return true;
        }
        catch
        {
            return true;
        }
    }

    static string? ResolveWindowsShell()
    {
        var systemPath = Environment.GetEnvironmentVariable("PATH") ?? string.Empty;
        var paths = systemPath.Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries);

        foreach (var folder in paths)
        {
            var pwsh = Path.Combine(folder, "pwsh.exe");
            if (File.Exists(pwsh))
            {
                return pwsh;
            }
        }

        foreach (var folder in paths)
        {
            var powershell = Path.Combine(folder, "powershell.exe");
            if (File.Exists(powershell))
            {
                return powershell;
            }
        }

        return null;
    }

    static ValhallaBuildProgress ReadValhallaBuildProgress(string? dataPath, bool ready)
    {
        if (string.IsNullOrWhiteSpace(dataPath))
        {
            return ready
                ? new ValhallaBuildProgress("completed", "ready", 100, "Valhalla est prêt.", null)
                : new ValhallaBuildProgress("unknown", "initialisation", 0, "Préparation en attente.", null);
        }

        var statusPath = Path.Combine(dataPath, "build-status.json");
        if (!File.Exists(statusPath))
        {
            return ready
                ? new ValhallaBuildProgress("completed", "ready", 100, "Valhalla est prêt.", null)
                : new ValhallaBuildProgress("unknown", "initialisation", 0, "Préparation en attente.", null);
        }

        try
        {
            using var document = JsonDocument.Parse(File.ReadAllText(statusPath));
            var root = document.RootElement;

            var state = root.TryGetProperty("state", out var stateElement)
                ? stateElement.GetString()
                : null;
            var phase = root.TryGetProperty("phase", out var phaseElement)
                ? phaseElement.GetString()
                : null;
            var progress = root.TryGetProperty("progress_pct", out var progressElement) && progressElement.TryGetInt32(out var parsedProgress)
                ? Math.Clamp(parsedProgress, 0, 100)
                : 0;
            var message = root.TryGetProperty("message", out var messageElement)
                ? messageElement.GetString()
                : null;
            var updatedAt = root.TryGetProperty("updated_at", out var updatedAtElement)
                ? updatedAtElement.GetString()
                : null;

            if (ready)
            {
                return new ValhallaBuildProgress(
                    "completed",
                    "ready",
                    100,
                    "Valhalla est prêt.",
                    updatedAt);
            }

            return new ValhallaBuildProgress(
                state ?? "unknown",
                phase ?? "initialisation",
                progress,
                message ?? "Préparation en cours.",
                updatedAt);
        }
        catch
        {
            return ready
                ? new ValhallaBuildProgress("completed", "ready", 100, "Valhalla est prêt.", null)
                : new ValhallaBuildProgress("unknown", "initialisation", 0, "Préparation en cours.", null);
        }
    }

    static ValhallaUpdateStatus ReadValhallaUpdateStatus(string? dataPath)
    {
        if (string.IsNullOrWhiteSpace(dataPath))
        {
            return new ValhallaUpdateStatus(
                "unknown",
                false,
                "data_path_absent",
                "Chemin des données Valhalla absent.",
                null,
                null,
                false,
                new ValhallaUpdateRemote(null, null, null, null, false, null));
        }

        var markerPath = Path.Combine(dataPath, ".valhalla_update_available");
        var markerExists = File.Exists(markerPath);
        var statusPath = Path.Combine(dataPath, "update-status.json");

        if (!File.Exists(statusPath))
        {
            return new ValhallaUpdateStatus(
                "unknown",
                markerExists,
                "status_absent",
                markerExists
                    ? "Une mise à jour est signalée mais le statut détaillé est absent."
                    : "Aucun statut de mise à jour disponible.",
                null,
                null,
                markerExists,
                new ValhallaUpdateRemote(null, null, null, null, false, null));
        }

        try
        {
            using var document = JsonDocument.Parse(File.ReadAllText(statusPath));
            var root = document.RootElement;
            var remote = root.TryGetProperty("remote", out var remoteElement) ? remoteElement : default;

            var state = root.TryGetProperty("state", out var stateElement)
                ? stateElement.GetString()
                : null;
            var updateAvailable = root.TryGetProperty("update_available", out var updateAvailableElement)
                ? updateAvailableElement.GetBoolean()
                : markerExists;
            var reason = root.TryGetProperty("reason", out var reasonElement)
                ? reasonElement.GetString()
                : null;
            var message = root.TryGetProperty("message", out var messageElement)
                ? messageElement.GetString()
                : null;
            var checkedAt = root.TryGetProperty("checked_at", out var checkedAtElement)
                ? checkedAtElement.GetString()
                : null;
            var nextCheckAt = root.TryGetProperty("next_check_at", out var nextCheckAtElement)
                ? nextCheckAtElement.GetString()
                : null;

            var remoteSnapshot = new ValhallaUpdateRemote(
                remote.ValueKind == JsonValueKind.Object && remote.TryGetProperty("etag", out var remoteEtagElement)
                    ? remoteEtagElement.GetString()
                    : null,
                remote.ValueKind == JsonValueKind.Object && remote.TryGetProperty("last_modified", out var remoteLastModifiedElement)
                    ? remoteLastModifiedElement.GetString()
                    : null,
                remote.ValueKind == JsonValueKind.Object && remote.TryGetProperty("content_length", out var remoteContentLengthElement) && remoteContentLengthElement.TryGetInt64(out var parsedContentLength)
                    ? parsedContentLength
                    : null,
                remote.ValueKind == JsonValueKind.Object && remote.TryGetProperty("checked_at", out var remoteCheckedAtElement)
                    ? remoteCheckedAtElement.GetString()
                    : null,
                remote.ValueKind == JsonValueKind.Object && remote.TryGetProperty("available", out var remoteAvailableElement) && remoteAvailableElement.ValueKind == JsonValueKind.True,
                remote.ValueKind == JsonValueKind.Object && remote.TryGetProperty("error", out var remoteErrorElement)
                    ? remoteErrorElement.GetString()
                    : null);

            return new ValhallaUpdateStatus(
                state ?? "unknown",
                updateAvailable || markerExists,
                reason ?? "unknown",
                message ?? "Statut de mise à jour indisponible.",
                checkedAt,
                nextCheckAt,
                markerExists,
                remoteSnapshot);
        }
        catch
        {
            return new ValhallaUpdateStatus(
                "unknown",
                markerExists,
                "status_invalide",
                "Le fichier update-status.json est invalide.",
                null,
                null,
                markerExists,
                new ValhallaUpdateRemote(null, null, null, null, false, null));
        }
    }

    static bool HasValhallaReadyMarker(string? dataPath)
    {
        if (string.IsNullOrWhiteSpace(dataPath))
        {
            return false;
        }

        var activePath = ResolveValhallaActiveDataPath(dataPath);
        var markerPath = Path.Combine(activePath, "tiles", ".valhalla_ready");
        return File.Exists(markerPath);
    }

    static bool IsValhallaReady(string? dataPath, out string reason)
    {
        reason = string.Empty;

        if (string.IsNullOrWhiteSpace(dataPath))
        {
            return true;
        }

        var activePath = ResolveValhallaActiveDataPath(dataPath);
        var tilesDir = Path.Combine(activePath, "tiles");
        var configPath = Path.Combine(activePath, "valhalla.json");
        var adminsPath = Path.Combine(activePath, "admins.sqlite");

        if (!Directory.Exists(tilesDir))
        {
            reason = "dossier des tuiles absent";
            return false;
        }

        var configFile = new FileInfo(configPath);
        if (!configFile.Exists || configFile.Length < 100)
        {
            reason = "fichier valhalla.json absent ou vide";
            return false;
        }

        var adminsFile = new FileInfo(adminsPath);
        if (!adminsFile.Exists || adminsFile.Length < 1024)
        {
            reason = "fichier admins.sqlite absent ou trop petit";
            return false;
        }

        var hasAnyTile = Directory.EnumerateFiles(tilesDir, "*.gph", SearchOption.AllDirectories)
            .Any();
        if (!hasAnyTile)
        {
            reason = "aucune tuile .gph detectee";
            return false;
        }

        return true;
    }

    static string ResolveValhallaActiveDataPath(string? dataPath)
    {
        if (string.IsNullOrWhiteSpace(dataPath))
        {
            return string.Empty;
        }

        var livePath = Path.Combine(dataPath, "live");
        var liveConfigPath = Path.Combine(livePath, "valhalla.json");
        var liveConfig = new FileInfo(liveConfigPath);
        return liveConfig.Exists && liveConfig.Length > 0 ? livePath : dataPath;
    }

    static async Task<(bool Reachable, string? Error)> ProbeValhallaServiceAsync(
        string? baseUrl,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(baseUrl))
        {
            return (false, "base_url_absente");
        }

        if (!Uri.TryCreate(baseUrl, UriKind.Absolute, out var parsedBaseUrl))
        {
            return (false, "base_url_invalide");
        }

        try
        {
            using var httpClient = new HttpClient
            {
                BaseAddress = parsedBaseUrl,
                Timeout = TimeSpan.FromSeconds(2)
            };

            using var response = await httpClient.GetAsync("status", cancellationToken);
            if (response.IsSuccessStatusCode)
            {
                return (true, null);
            }

            return (false, $"http_{(int)response.StatusCode}");
        }
        catch (OperationCanceledException)
        {
            return (false, "timeout");
        }
        catch (HttpRequestException ex)
        {
            return (false, ex.GetType().Name);
        }
    }

    sealed record ValhallaBuildProgress(
        string State,
        string Phase,
        int ProgressPct,
        string Message,
        string? UpdatedAt);

    sealed record ValhallaBuildStartResult(
        bool Started,
        string Reason,
        string Message,
        int? Pid);

    sealed record ValhallaUpdateStatus(
        string State,
        bool UpdateAvailable,
        string Reason,
        string Message,
        string? CheckedAt,
        string? NextCheckAt,
        bool MarkerExists,
        ValhallaUpdateRemote Remote);

    sealed record ValhallaUpdateRemote(
        string? Etag,
        string? LastModified,
        long? ContentLength,
        string? CheckedAt,
        bool Available,
        string? Error);

    private static class PolylineDecoder
    {
        public static List<double[]> DecodeToCoordinates(string encoded, int precision = 6)
        {
            var decoded = Decode(encoded, precision);
            var coordinates = new List<double[]>(decoded.Count);
            foreach (var (lat, lon) in decoded)
            {
                coordinates.Add(new[] { lon, lat });
            }

            return coordinates;
        }

        private static List<(double Lat, double Lon)> Decode(string encoded, int precision)
        {
            var coordinates = new List<(double, double)>();
            var factor = Math.Pow(10, precision);
            var index = 0;
            long lat = 0;
            long lon = 0;

            while (index < encoded.Length)
            {
                lat += DecodeNext(encoded, ref index);
                lon += DecodeNext(encoded, ref index);
                coordinates.Add((lat / factor, lon / factor));
            }

            return coordinates;
        }

        private static long DecodeNext(string encoded, ref int index)
        {
            long result = 0;
            var shift = 0;
            int b;

            do
            {
                b = encoded[index++] - 63;
                result |= (long)(b & 0x1F) << shift;
                shift += 5;
            } while (b >= 0x20 && index < encoded.Length);

            return (result & 1) != 0 ? ~(result >> 1) : result >> 1;
        }
    }
}


