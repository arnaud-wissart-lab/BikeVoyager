# LOC Report

- Date: 2026-07-11 06:11:57 +0200
- Commit: `c960064`
- Methode: comptage des LF (`\n`) via `wc -l`, puis lignes = LF + (0 si fin de fichier sur LF, sinon +1), 0 si fichier vide.
- Scope: `backend,frontend,docs`
- Threshold: `400`
- Top: `30`
- Patterns: `*.cs,*.ts,*.tsx,*.md`

| Fichier | LOC |
|---|---:|
| `frontend/src/test/App.routing.test.tsx` | 1505 |
| `frontend/src/features/routing/useRoutingController.actions.ts` | 517 |
| `frontend/src/features/routing/useRoutingController.ts` | 489 |
| `frontend/src/features/map/useMapController.ts` | 461 |
| `frontend/src/app/routes/MapRoute.tsx` | 408 |
