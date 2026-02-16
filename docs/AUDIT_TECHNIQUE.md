# Audit technique - BikeVoyager (releve LOC complet du 2026-02-16)

> Objectif : maintenir une vitrine GitHub propre, auditable et maintenable.
> Source LOC : `scripts/loc.ps1` (PowerShell) et `scripts/loc.sh` (bash).
> Releve execute le 2026-02-16 sur l'etat courant du depot (valeurs exactes de cette revision).
> Note : les editeurs (VS/VS Code) comptent les lignes vides ; ces scripts sont la reference projet.

## 1) Anciens hotspots : statut reel (Resolu vs Restant)

| Fichier | LOC audit precedent | LOC 2026-02-16 | Statut | Commentaire |
|---|---:|---:|---|---|
| `frontend/src/i18n.ts` | 994 | 31 | **RESOLU** | Le monolithe de traductions n'existe plus. |
| `frontend/src/ui/pages/MapPage.tsx` | 838 | 362 | **RESOLU** | Plus au-dessus des seuils de risque structurel. |
| `frontend/src/components/CesiumRouteMap.tsx` | 829 | 125 | **RESOLU** | Fichier compact. |
| `frontend/src/features/data/dataPortability.ts` | 749 | 45 | **RESOLU** | Decoupage effectif. |
| `frontend/src/ui/pages/DataPage.tsx` | 587 | 283 | **RESOLU** | Split effectif ; page sous le seuil de 400 LOC. |
| `frontend/src/features/cloud/useCloudController.ts` | 687 | 116 | **RESOLU** | Split effectif ; fichier repasse largement sous 400 LOC. |
| `frontend/src/features/routing/useRoutingController.actions.ts` | 612 | 415 | **RESTANT** | Repasse au-dessus du seuil de 400 LOC. |
| `backend/src/BikeVoyager.Infrastructure/Routing/ValhallaLoopService.cs` | 618 | 298 | **RESOLU** | Taille maitrisee. |
| `backend/src/BikeVoyager.AppHost/Program.cs` | 459 | 22 | **RESOLU** | Bootstrapping minimal. |
| `backend/src/BikeVoyager.Infrastructure/Pois/OverpassGeometryHelper.cs` | 405 | 21 | **RESOLU** | Helper extrait et fichier historique reduit. |

Critere de statut :
- `RESOLU` = hotspot historique reduit sous 400 LOC ET responsabilite unique.
- `RESTANT` = hotspot historique encore au-dessus de 400 LOC OU melange de responsabilites.

Verification au 2026-02-16 : 9/10 anciens hotspots sont `RESOLU`, 1/10 reste `RESTANT`.

## 2) Hotspots LOC actuels (etat reel)

### Backend (top 5)

| Fichier exact | LOC |
|---|---:|
| `backend/src/BikeVoyager.Api/Cloud/Providers/GoogleDriveCloudProviderClient.cs` | 375 |
| `backend/src/BikeVoyager.Infrastructure/Routing/ValhallaRouteService.cs` | 361 |
| `backend/src/BikeVoyager.Infrastructure/Pois/PoiNormalizer.cs` | 346 |
| `backend/src/BikeVoyager.Api/Cloud/CloudSyncEndpointHandlers.cs` | 338 |
| `backend/src/BikeVoyager.Api/Valhalla/ValhallaRuntime.cs` | 322 |

Constat : aucun fichier backend ne depasse 400 LOC.

### Frontend applicatif (hors tests, fichiers > 400 LOC - seuil d'analyse technique)

| Fichier exact | LOC |
|---|---:|
| `frontend/src/features/data/useDataController.ts` | 517 |
| `frontend/src/app/AppPages.tsx` | 509 |
| `frontend/src/ui/pages/PoiPanel.tsx` | 498 |
| `frontend/src/features/map/useMapController.ts` | 494 |
| `frontend/src/features/data/useDataController.addressBookActions.ts` | 447 |
| `frontend/src/features/cloud/cloudSync.ts` | 436 |
| `frontend/src/ui/pages/PlannerPage.tsx` | 427 |
| `frontend/src/features/routing/useRoutingController.ts` | 420 |
| `frontend/src/features/routing/useRoutingController.actions.ts` | 415 |
| `frontend/src/state/appStore.ts` | 414 |
| `frontend/src/ui/pages/AddressBookPanel.tsx` | 401 |

Note : `frontend/src/test/App.test.tsx` est aussi au-dessus de 400 LOC (507), mais hors perimetre applicatif.

Priorisation split frontend : commencer par `frontend/src/features/data/useDataController.ts`, puis `frontend/src/app/AppPages.tsx`, puis `frontend/src/ui/pages/PoiPanel.tsx`.

## 3) Restant (uniquement les constats encore vrais)

- Le seul hotspot historique restant est `frontend/src/features/routing/useRoutingController.actions.ts` (415 LOC).
- La dette de taille est concentree sur le frontend (11 fichiers applicatifs > 400 LOC, +1 fichier de test > 400 LOC).
- Le backend est entierement sous le seuil de 400 LOC.

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
