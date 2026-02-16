# Audit technique - BikeVoyager (releve LOC complet du 2026-02-16)

> Objectif : maintenir une vitrine GitHub propre, auditable et maintenable.
> Source LOC : `scripts/loc.ps1` (PowerShell) et `scripts/loc.sh` (bash).
> Releve execute le 2026-02-16 avec la commande canonique :
> `pwsh scripts/loc.ps1 --scope backend/frontend/docs --threshold 400 --top 30 --out docs/LOC_REPORT.md`
> Commit de reference : `93f4277`.
> Note : le comptage "style editeur" inclut les lignes vides (base LF `\n`).

## 1) Anciens hotspots : statut reel (Resolu vs Restant)

| Fichier | LOC audit precedent | LOC 2026-02-16 | Statut | Commentaire |
|---|---:|---:|---|---|
| `frontend/src/i18n.ts` | 994 | 30 | **RESOLU** | Le monolithe de traductions n'existe plus. |
| `frontend/src/ui/pages/MapPage.tsx` | 838 | 361 | **RESOLU** | Plus au-dessus des seuils de risque structurel. |
| `frontend/src/components/CesiumRouteMap.tsx` | 829 | 124 | **RESOLU** | Fichier compact. |
| `frontend/src/features/data/dataPortability.ts` | 749 | 44 | **RESOLU** | Decoupage effectif. |
| `frontend/src/ui/pages/DataPage.tsx` | 587 | 282 | **RESOLU** | Split effectif ; page sous le seuil de 400 LOC. |
| `frontend/src/features/cloud/useCloudController.ts` | 687 | 115 | **RESOLU** | Split effectif ; fichier repasse largement sous 400 LOC. |
| `frontend/src/features/routing/useRoutingController.actions.ts` | 612 | 414 | **RESTANT** | Reste au-dessus du seuil de 400 LOC. |
| `backend/src/BikeVoyager.Infrastructure/Routing/ValhallaLoopService.cs` | 618 | 297 | **RESOLU** | Taille maitrisee. |
| `backend/src/BikeVoyager.AppHost/Program.cs` | 459 | 21 | **RESOLU** | Bootstrapping minimal. |
| `backend/src/BikeVoyager.Infrastructure/Pois/OverpassGeometryHelper.cs` | 405 | 20 | **RESOLU** | Helper extrait et fichier historique reduit. |

Critere de statut :
- `RESOLU` = hotspot historique reduit sous 400 LOC ET responsabilite unique.
- `RESTANT` = hotspot historique encore au-dessus de 400 LOC OU melange de responsabilites.

Verification au 2026-02-16 : 9/10 anciens hotspots sont `RESOLU`, 1/10 reste `RESTANT`.

## 2) Hotspots LOC actuels (aligne sur `docs/LOC_REPORT.md`)

| Fichier exact | LOC |
|---|---:|
| `frontend/src/test/App.test.tsx` | 506 |
| `frontend/src/ui/pages/PoiPanel.tsx` | 497 |
| `frontend/src/features/map/useMapController.ts` | 493 |
| `frontend/src/features/data/useDataController.addressBookActions.ts` | 446 |
| `frontend/src/ui/pages/PlannerPage.tsx` | 426 |
| `frontend/src/features/routing/useRoutingController.ts` | 419 |
| `frontend/src/features/routing/useRoutingController.actions.ts` | 414 |
| `frontend/src/state/appStore.ts` | 413 |
| `frontend/src/ui/pages/AddressBookPanel.tsx` | 400 |

Constat :
- Backend : aucun fichier >= 400 LOC.
- Docs : aucun fichier >= 400 LOC.
- Frontend : la dette de taille est concentree sur les pages/controllers et un gros fichier de test.

## 3) Restant (nombre reel de fichiers > 400)

- Total scope `backend/frontend/docs` : **8** fichiers > 400 LOC.
- Frontend applicatif : **7** fichiers > 400 LOC.
- Frontend tests : **1** fichier > 400 LOC (`frontend/src/test/App.test.tsx`).
- Backend + docs : **0** fichier > 400 LOC.
- Point de vigilance historique encore ouvert : `frontend/src/features/routing/useRoutingController.actions.ts` (414 LOC).

## 4) Ce qui fait vitrine (10 lignes max)

- API versionnee de facon canonique en `/api/v1/*` (`backend/src/BikeVoyager.Api/Endpoints/*`).
- Compatibilite legacy `/api/*` geree par middleware dedie (`backend/src/BikeVoyager.Api/Middleware/LegacyApiPathRewriteMiddleware.cs`).
- Headers de securite forces en non-Development (`backend/src/BikeVoyager.Api/Middleware/SecurityHeadersMiddleware.cs`).
- Validation des headers couverte par tests API (`backend/tests/BikeVoyager.ApiTests/SecurityHeadersTests.cs`).
- Compatibilite de versionnement couverte par tests (`backend/tests/BikeVoyager.ApiTests/ApiVersioningCompatibilityTests.cs`).
- CI unique backend + frontend + E2E dans `.github/workflows/ci.yml`.
- Qualite automatisee : `dotnet test BikeVoyager.sln`, `npm run test`, `npm run e2e` en CI.
- Audits dependances integres en CI (`dotnet list ... --vulnerable`, `npm audit`).
- Gouvernance OSS visible a la racine : `LICENSE`, `CODE_OF_CONDUCT.md`, `SECURITY.md`.

## 5) Nettoyage legacy

- `docs/legacy/BikeVoyager.sln` et `docs/legacy/BikeVoyager.slnx` sont supprimes : ces copies etaient redondantes avec `BikeVoyager.sln` et `BikeVoyager.slnx` a la racine.
