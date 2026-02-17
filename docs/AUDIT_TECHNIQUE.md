# Audit technique - BikeVoyager (relevé LOC complet du 2026-02-17)

> Objectif : maintenir un dépôt propre, auditable et maintenable.
> Source LOC : `scripts/loc.ps1` (PowerShell) et `scripts/loc.sh` (bash).
> Relevé exécuté le 2026-02-17 avec la commande canonique :
> `pwsh scripts/loc.ps1 --scope backend/frontend/docs --threshold 400 --top 30 --out docs/LOC_REPORT.md`
> Commit de référence : `32adfee`.
> Note : le comptage "style éditeur" inclut les lignes vides (base LF `\n`).

## 1) Anciens hotspots : statut réel (Résolu vs Restant)

| Fichier | LOC audit précédent | LOC 2026-02-17 | Statut | Commentaire |
|---|---:|---:|---|---|
| `frontend/src/i18n.ts` | 994 | 30 | **RÉSOLU** | Le monolithe de traductions n'existe plus. |
| `frontend/src/ui/pages/MapPage.tsx` | 838 | 361 | **RÉSOLU** | Plus au-dessus des seuils de risque structurel. |
| `frontend/src/components/CesiumRouteMap.tsx` | 829 | 124 | **RÉSOLU** | Fichier compact. |
| `frontend/src/features/data/dataPortability.ts` | 749 | 44 | **RÉSOLU** | Découpage effectif. |
| `frontend/src/ui/pages/DataPage.tsx` | 587 | 282 | **RÉSOLU** | Split effectif ; page sous le seuil de 400 LOC. |
| `frontend/src/features/cloud/useCloudController.ts` | 687 | 115 | **RÉSOLU** | Split effectif ; fichier repasse largement sous 400 LOC. |
| `frontend/src/features/routing/useRoutingController.actions.ts` | 612 | 394 | **RÉSOLU** | Repasse sous le seuil inclusif >= 400 LOC. |
| `backend/src/BikeVoyager.Infrastructure/Routing/ValhallaLoopService.cs` | 618 | 297 | **RÉSOLU** | Taille maîtrisée. |
| `backend/src/BikeVoyager.AppHost/Program.cs` | 459 | 21 | **RÉSOLU** | Bootstrapping minimal. |
| `backend/src/BikeVoyager.Infrastructure/Pois/OverpassGeometryHelper.cs` | 405 | 20 | **RÉSOLU** | Helper extrait et fichier historique réduit. |

Critère de statut :
- `RÉSOLU` = hotspot historique réduit sous 400 LOC ET responsabilité unique.
- `RESTANT` = hotspot historique encore au-dessus du seuil inclusif >= 400 LOC OU mélange de responsabilités.

Vérification au 2026-02-17 : 10/10 anciens hotspots sont `RÉSOLU`, **0 restant**.

## 2) Hotspots LOC actuels (aligné sur `docs/LOC_REPORT.md`)

Aucun fichier >= 400 LOC dans le scope backend/frontend/docs.

## 3) Restant (nombre réel de fichiers >= 400)

- Total scope `backend/frontend/docs` : **0** fichier >= 400 LOC.
- Frontend applicatif : **0** fichier >= 400 LOC.
- Frontend tests : **0** fichier >= 400 LOC.
- Backend + docs : **0** fichier >= 400 LOC.
- Point de vigilance historique encore ouvert : **aucun**.

## 4) Points forts techniques (10 lignes max)

- API versionnée de façon canonique en `/api/v1/*` (`backend/src/BikeVoyager.Api/Endpoints/*`).
- Support legacy supprimé le 2026-02-17 : routes API exposées uniquement en `/api/v1/*`.
- Headers de sécurité forcés en non-Development (`backend/src/BikeVoyager.Api/Middleware/SecurityHeadersMiddleware.cs`).
- Validation des headers couverte par tests API (`backend/tests/BikeVoyager.ApiTests/SecurityHeadersTests.cs`).
- Compatibilité de versionnement couverte par tests (`backend/tests/BikeVoyager.ApiTests/ApiVersioningCompatibilityTests.cs`).
- CI unique backend + frontend + E2E dans `.github/workflows/ci.yml`.
- Qualité automatisée : `dotnet test BikeVoyager.sln`, `npm run test`, `npm run e2e` en CI.
- Audits dépendances intégrés en CI (`dotnet list ... --vulnerable`, `npm audit`).
- Gouvernance OSS visible à la racine : `LICENSE`, `CODE_OF_CONDUCT.md`, `SECURITY.md`.

## 5) Nettoyage legacy

- `docs/legacy/BikeVoyager.sln` et `docs/legacy/BikeVoyager.slnx` sont supprimés : ces copies étaient redondantes avec `BikeVoyager.sln` et `BikeVoyager.slnx` à la racine.
