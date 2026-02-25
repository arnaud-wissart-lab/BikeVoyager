using BikeVoyager.Api.Health;

namespace BikeVoyager.ApiTests;

public class ApiHealthStatusServiceTests
{
    [Fact]
    public void BuildFromSnapshot_retourne_BUILDING_quand_valhalla_initialise_les_tuiles()
    {
        var service = new ApiHealthStatusService();
        var snapshot = new ApiHealthStatusSnapshot(
            Ready: false,
            NotReadyReason: "dossier des tuiles absent",
            BuildState: "running",
            BuildPhase: "tiles",
            BuildProgressPct: 42,
            BuildMessage: "Generation des tuiles Valhalla.",
            BuildUpdatedAt: "2026-02-25T10:00:00Z",
            ServiceReachable: false,
            ServiceError: null);

        var response = service.BuildFromSnapshot(snapshot, new ApiHealthVersionInfo("1.0.0", "abc123"));

        Assert.Equal("DEGRADED", response.Status);
        Assert.Equal("BUILDING", response.Valhalla.Status);
        Assert.Contains("préparation", response.Valhalla.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Equal(42, response.Valhalla.Build.ProgressPct);
    }

    [Fact]
    public void BuildFromSnapshot_retourne_DOWN_quand_valhalla_non_pret_sans_build()
    {
        var service = new ApiHealthStatusService();
        var snapshot = new ApiHealthStatusSnapshot(
            Ready: false,
            NotReadyReason: "fichier valhalla.json absent ou vide",
            BuildState: "failed",
            BuildPhase: "error",
            BuildProgressPct: 0,
            BuildMessage: "Echec du build Valhalla.",
            BuildUpdatedAt: "2026-02-25T10:00:00Z",
            ServiceReachable: false,
            ServiceError: null);

        var response = service.BuildFromSnapshot(snapshot, new ApiHealthVersionInfo("1.0.0", "abc123"));

        Assert.Equal("DEGRADED", response.Status);
        Assert.Equal("DOWN", response.Valhalla.Status);
        Assert.Contains("a échoué", response.Valhalla.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void BuildFromSnapshot_retourne_OK_et_UP_quand_valhalla_est_pret_et_joignable()
    {
        var service = new ApiHealthStatusService();
        var snapshot = new ApiHealthStatusSnapshot(
            Ready: true,
            NotReadyReason: null,
            BuildState: "completed",
            BuildPhase: "ready",
            BuildProgressPct: 100,
            BuildMessage: "Valhalla est prêt.",
            BuildUpdatedAt: "2026-02-25T10:00:00Z",
            ServiceReachable: true,
            ServiceError: null);

        var response = service.BuildFromSnapshot(snapshot, new ApiHealthVersionInfo("1.0.0", "abc123"));

        Assert.Equal("OK", response.Status);
        Assert.Equal("UP", response.Valhalla.Status);
        Assert.True(response.Valhalla.ServiceReachable);
        Assert.Equal("1.0.0", response.Version);
        Assert.Equal("abc123", response.Commit);
    }
}
