# Roadmap BikeVoyager

Source : `docs/AUDIT_TECHNIQUE.md` et `docs/LOC_REPORT.md` (relevé du 2026-02-17, commit `54469d0`).
Objectif : renforcer la qualité du dépôt sans changement fonctionnel.

## Backlog priorisé (reste à faire)

1. `P1` - Ajouter 2 specs E2E Playwright stables pour les parcours critiques : routing et export/import.
2. `P2` - Réduire la dépendance à un owner hardcodé dans `SECURITY.md` et `CODE_OF_CONDUCT.md`.
3. `P2` - Ajouter une capture ou un GIF léger dans `README.md` pour illustrer un parcours clé (optionnel).

## Historique récent

- `2026-02-17` : suppression du support legacy (préfixe non versionné `/api`) et retrait du middleware `backend/src/BikeVoyager.Api/Middleware/LegacyApiPathRewriteMiddleware.cs`.
- `2026-02-17` : documentation publique alignée (suppression des traces d'outillage dans les `.md`).

Définition of done globale :
- Aucun changement fonctionnel.
- Tests backend/frontend/E2E toujours verts.
- Documentation alignée sur l'état réel du dépôt.
