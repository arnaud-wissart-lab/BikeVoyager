# Roadmap BikeVoyager

Source : `docs/AUDIT_TECHNIQUE.md` et `docs/LOC_REPORT.md` (releve du 2026-02-16, commit `d8e894d`).
Objectif : renforcer la vitrine GitHub sans changement fonctionnel.

## Backlog priorise (reste a faire)

1. `P0` - Reorganiser `frontend/src/test/App.test.tsx` (506 LOC) pour conserver des tests lisibles et maintenables.
2. `P0` - Decouper `frontend/src/features/data/useDataController.addressBookActions.ts` (446 LOC) pour separer les responsabilites.
3. `P0` - Reduire `frontend/src/ui/pages/PlannerPage.tsx` (426 LOC).
4. `P1` - Reduire `frontend/src/features/routing/useRoutingController.ts` (419 LOC).
5. `P1` - Reduire `frontend/src/features/routing/useRoutingController.actions.ts` (414 LOC).
6. `P1` - Reduire `frontend/src/state/appStore.ts` (413 LOC).
7. `P1` - Stabiliser `frontend/src/ui/pages/AddressBookPanel.tsx` (400 LOC) sous un seuil de confort (< 400).
8. `P1` - Planifier la sortie du mode legacy `/api/*` (mesure d'usage, date cible, suppression de `backend/src/BikeVoyager.Api/Middleware/LegacyApiPathRewriteMiddleware.cs`).
9. `P2` - Completer la vitrine repo : badges README (CI/tests/license), `docs/ARCHITECTURE.md`, captures ecran et GIF court de parcours utilisateur.

## Hotspots sortis du backlog LOC (>= 400)

- `frontend/src/features/map/useMapController.ts` (397 LOC)
- `frontend/src/features/data/useDataController.ts` (395 LOC)
- `frontend/src/ui/pages/MapPage.tsx` (361 LOC)
- `frontend/src/features/cloud/cloudSync.ts` (292 LOC)
- `frontend/src/ui/pages/DataPage.tsx` (282 LOC)
- `frontend/src/ui/pages/PoiPanel.tsx` (185 LOC)
- `frontend/src/app/AppPages.tsx` (131 LOC)
- `frontend/src/features/cloud/useCloudController.ts` (115 LOC)
- `backend/src/BikeVoyager.Infrastructure/Pois/OverpassGeometryHelper.cs` (20 LOC)

Definition of done globale :
- Aucun changement fonctionnel.
- Tests backend/frontend/E2E toujours verts.
- Documentation alignee sur l'etat reel du depot.
