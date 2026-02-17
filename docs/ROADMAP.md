# Roadmap BikeVoyager

Source : `docs/AUDIT_TECHNIQUE.md` et `docs/LOC_REPORT.md` (relevé du 2026-02-17, commit `32adfee`).
Objectif : renforcer la qualité du dépôt sans changement fonctionnel.

## Backlog priorisé (reste à faire)

1. `P0` - Exécuter la sortie du mode legacy `/api/*` :
   - Dépréciation active : les appels `/api/*` exposent `Deprecation: true` et `Sunset: Tue, 30 Jun 2026 23:59:59 GMT`.
   - Date cible de suppression du rewrite legacy : **2026-07-01**.
   - Action finale prévue : supprimer `backend/src/BikeVoyager.Api/Middleware/LegacyApiPathRewriteMiddleware.cs` après validation de l'usage.
2. `P1` - Ajouter les badges README (CI, tests, licence) pour rendre l'état qualité visible immédiatement.
3. `P1` - Rédiger `docs/ARCHITECTURE.md` (vue système, flux front/back, conventions de modules) pour faciliter l'audit externe.
4. `P2` - Améliorer la présentation du dépôt (captures/GIF) et la documentation utilisateur.

## Hotspots sortis du backlog LOC (>= 400)

- Au relevé du 2026-02-17 (`32adfee`), aucun fichier du scope `backend/frontend/docs` n'est >= 400 LOC.
- Tous les hotspots suivis précédemment sont sortis du backlog LOC, y compris `frontend/src/features/routing/useRoutingController.actions.ts` (394 LOC).

Définition of done globale :
- Aucun changement fonctionnel.
- Tests backend/frontend/E2E toujours verts.
- Documentation alignée sur l'état réel du dépôt.
