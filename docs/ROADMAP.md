# Roadmap BikeVoyager

Source : `docs/AUDIT_TECHNIQUE.md` et `docs/LOC_REPORT.md` (etat courant du depot au 2026-02-16).
Objectif : renforcer la vitrine GitHub sans changement fonctionnel.

## Backlog priorise (reste a faire)

1. `P0` - Decouper `frontend/src/features/data/useDataController.ts` (517 LOC) pour revenir sous 400 LOC avec responsabilites plus nettes.
2. `P0` - Decouper `frontend/src/app/AppPages.tsx` (509 LOC) en modules de routing/composition plus petits et testables.
3. `P0` - Decouper `frontend/src/ui/pages/PoiPanel.tsx` (498 LOC) pour reduire la complexite de page.
4. `P1` - Reduire les autres hotspots frontend > 400 LOC : `frontend/src/features/map/useMapController.ts` (494), `frontend/src/features/data/useDataController.addressBookActions.ts` (447), `frontend/src/features/cloud/cloudSync.ts` (436), `frontend/src/ui/pages/PlannerPage.tsx` (427), `frontend/src/features/routing/useRoutingController.ts` (420), `frontend/src/features/routing/useRoutingController.actions.ts` (415), `frontend/src/state/appStore.ts` (414), `frontend/src/ui/pages/AddressBookPanel.tsx` (401), plus `frontend/src/test/App.test.tsx` (507) cote tests.
5. `P1` - Planifier la sortie du mode legacy `/api/*` (mesure d'usage, date cible, suppression de `backend/src/BikeVoyager.Api/Middleware/LegacyApiPathRewriteMiddleware.cs`).
6. `P2` - Completer la vitrine repo : badges README (CI/tests/license), `docs/ARCHITECTURE.md`, captures ecran et GIF court de parcours utilisateur.

## Hotspots historiques resolus (sortis du backlog P0)

- `frontend/src/ui/pages/DataPage.tsx` (plus au-dessus de 400 LOC)
- `frontend/src/features/cloud/useCloudController.ts` (plus au-dessus de 400 LOC)
- `backend/src/BikeVoyager.Infrastructure/Pois/OverpassGeometryHelper.cs` (plus au-dessus de 400 LOC)

Definition of done globale :
- Aucun changement fonctionnel.
- Tests backend/frontend/E2E toujours verts.
- Documentation alignee sur l'etat reel du depot.
