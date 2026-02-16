# Roadmap BikeVoyager

Source : `docs/AUDIT_TECHNIQUE.md` et `docs/LOC_REPORT.md` (etat courant du depot au 2026-02-16).
Objectif : renforcer la vitrine GitHub sans changement fonctionnel.

## Backlog priorise (reste a faire)

1. `P0` - Decouper `frontend/src/ui/pages/DataPage.tsx` (587 LOC) en composants/pages plus petits pour revenir sous 400 LOC (seuil de dette technique de l'audit).
2. `P0` - Decouper `frontend/src/features/cloud/useCloudController.ts` (586 LOC) en modules metier (`oauth`, `backup`, `providers`) avec tests de non-regression.
3. `P1` - Reduire les autres hotspots frontend > 400 LOC : `frontend/src/features/data/useDataController.ts` (517), `frontend/src/app/AppPages.tsx` (509), `frontend/src/ui/pages/PoiPanel.tsx` (498), `frontend/src/features/map/useMapController.ts` (494), `frontend/src/features/data/useDataController.addressBookActions.ts` (447), `frontend/src/features/cloud/cloudSync.ts` (436), `frontend/src/ui/pages/PlannerPage.tsx` (427), `frontend/src/features/routing/useRoutingController.ts` (420), `frontend/src/features/routing/useRoutingController.actions.ts` (415), `frontend/src/state/appStore.ts` (414), `frontend/src/ui/pages/AddressBookPanel.tsx` (401).
4. `P1` - Planifier la sortie du mode legacy `/api/*` (mesure d'usage, date cible, suppression de `backend/src/BikeVoyager.Api/Middleware/LegacyApiPathRewriteMiddleware.cs`).
5. `P2` - Completer la vitrine repo : badges README (CI/tests/license), `docs/ARCHITECTURE.md`, captures ecran et GIF court de parcours utilisateur.

Definition of done globale :
- Aucun changement fonctionnel.
- Tests backend/frontend/E2E toujours verts.
- Documentation alignee sur l'etat reel du depot.
