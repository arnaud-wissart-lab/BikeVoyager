using BikeVoyager.Api.Extensions;
using BikeVoyager.Api.Filters;
using BikeVoyager.Api.Middleware;
using BikeVoyager.Application.Geocoding;
using BikeVoyager.Application.Integrations;
using BikeVoyager.Application.Trips;
using BikeVoyager.Infrastructure;
using FluentValidation;
using Serilog;
using Serilog.Formatting.Compact;

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
builder.Services.AddSwaggerGen();

builder.Services.AddValidatorsFromAssemblyContaining<CreateTripRequestValidator>();
builder.Services.AddInfrastructure(builder.Configuration);

var app = builder.Build();

app.UseCorrelationId();
app.UseSerilogRequestLogging();
app.UseExceptionHandler();
app.UseStatusCodePages();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}
else
{
    app.UseHttpsRedirection();
}

var places = app.MapGroup("/api/places");

places.MapGet("/search",
        async (string? q, int? limit, IGeocodingService geocoding, CancellationToken cancellationToken) =>
        {
            if (string.IsNullOrWhiteSpace(q) || q.Trim().Length < 2)
            {
                return Results.BadRequest(new { message = "Le paramètre 'q' est obligatoire (minimum 2 caractères)." });
            }

            var resolvedLimit = Math.Clamp(limit ?? 8, 1, 20);
            var results = await geocoding.SearchAsync(q, resolvedLimit, cancellationToken);
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

app.Run();

public partial class Program
{
}
