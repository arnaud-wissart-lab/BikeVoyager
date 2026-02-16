var options = new DistributedApplicationOptions
{
    Args = args,
    AllowUnsecuredTransport = true,
    EnableResourceLogging = true,
};

var builder = DistributedApplication.CreateBuilder(options);

var repoRoot = Path.GetFullPath(
    Path.Combine(builder.AppHostDirectory, "..", "..", ".."));
var valhallaDataPath = Path.GetFullPath(
    Path.Combine(repoRoot, "infra", "valhalla"));
var frontendPath = Path.GetFullPath(
    Path.Combine(repoRoot, "frontend"));

var api = builder.AddApi(valhallaDataPath);
builder.AddValhalla(api, repoRoot, valhallaDataPath);
builder.AddFrontend(api, frontendPath);

builder.Build().Run();
