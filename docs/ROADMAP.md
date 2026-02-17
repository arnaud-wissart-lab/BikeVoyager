# Roadmap BikeVoyager

Source : `docs/AUDIT_TECHNIQUE.md` et `docs/LOC_REPORT.md` (releve du 2026-02-17, commit `32adfee`).
Objectif : renforcer la vitrine GitHub sans changement fonctionnel.

## Backlog priorise (reste a faire)

1. `P0` - Planifier la sortie du mode legacy `/api/*` : mesurer l'usage, fixer une date de deprecation, puis supprimer `backend/src/BikeVoyager.Api/Middleware/LegacyApiPathRewriteMiddleware.cs`.
2. `P1` - Ajouter les badges README (CI, tests, licence) pour rendre l'etat qualite visible immediatement.
3. `P1` - Rediger `docs/ARCHITECTURE.md` (vue systeme, flux front/back, conventions de modules) pour faciliter l'audit externe.
4. `P2` - Completer la vitrine repo avec captures d'ecran et GIF court de parcours utilisateur.

## Hotspots sortis du backlog LOC (>= 400)

- Au releve du 2026-02-17 (`32adfee`), aucun fichier du scope `backend/frontend/docs` n'est >= 400 LOC.
- Tous les hotspots suivis precedemment sont sortis du backlog LOC, y compris `frontend/src/features/routing/useRoutingController.actions.ts` (394 LOC).

Definition of done globale :
- Aucun changement fonctionnel.
- Tests backend/frontend/E2E toujours verts.
- Documentation alignee sur l'etat reel du depot.
