# LOC Report

- Date: 2026-07-10 13:15:37 +0200
- Commit: `b38d535`
- Methode: comptage des LF (`\n`) via `wc -l`, puis lignes = LF + (0 si fin de fichier sur LF, sinon +1), 0 si fichier vide.
- Scope: `backend,frontend,docs`
- Threshold: `400`
- Top: `30`
- Patterns: `*.cs,*.ts,*.tsx,*.md`

| Fichier | LOC |
|---|---:|
| `frontend/src/test/App.routing.test.tsx` | 938 |
| `frontend/src/features/routing/useRoutingController.actions.ts` | 498 |
| `frontend/src/features/routing/useRoutingController.ts` | 438 |
| `frontend/src/features/map/useMapController.ts` | 422 |
