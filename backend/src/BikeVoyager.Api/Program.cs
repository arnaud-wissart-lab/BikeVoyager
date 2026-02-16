using BikeVoyager.Api.Extensions;
using BikeVoyager.Api.Valhalla;
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

builder.Services
    .AddApplication()
    .AddInfrastructure(builder.Configuration);

var apiOptions = builder.Services.AddApi(builder.Configuration);

var app = builder.Build();

app.UseApiPipeline(apiOptions);
app.MapEndpoints(apiOptions);

ValhallaRuntime.TryStartAutomaticUpdateIfAvailable(apiOptions.ValhallaDataPath, app.Logger);

app.Run();

public partial class Program;
