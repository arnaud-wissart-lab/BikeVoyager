using System.Diagnostics;

internal static class FrontendAppHostSupport
{
    public static string ResolveNpmPath()
    {
        var npmPath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),
            "nodejs",
            "npm.cmd");

        return File.Exists(npmPath) ? npmPath : "npm.cmd";
    }

    public static void TryOpenUrl(string url)
    {
        try
        {
            Process.Start(new ProcessStartInfo(url)
            {
                UseShellExecute = true,
            });
        }
        catch
        {
            // Ouverture automatique ignoree.
        }
    }

    public static async Task<string> FindFrontendUrlAsync(
        HttpClient http,
        int startPort,
        int endPort)
    {
        for (var port = startPort; port <= endPort; port++)
        {
            var url = $"http://localhost:{port}";
            try
            {
                using var response = await http.GetAsync(url);
                if (response.IsSuccessStatusCode)
                {
                    return url;
                }
            }
            catch
            {
                // Attente du frontend.
            }
        }

        return string.Empty;
    }
}
