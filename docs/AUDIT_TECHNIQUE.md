# Audit technique - BikeVoyager (releve LOC complet du 2026-02-16)

> Objectif : maintenir une vitrine GitHub propre, auditable et maintenable.
> Mesure LOC : `(Get-Content <fichier> | Measure-Object -Line).Lines`, releve complet le 2026-02-16.
> Note : mesure LOC indicative (EOL/encodage). Recalcul recommande via `wc -l` avec tolerance de +/-5%.

## 1) Anciens hotspots : statut reel (Resolu vs Restant)

| Fichier | LOC audit precedent | LOC 2026-02-16 | Statut | Commentaire |
|---|---:|---:|---|---|
| `frontend/src/i18n.ts` | 994 | 25 | **RESOLU** | Le monolithe de traductions n'existe plus. |
| `frontend/src/ui/pages/MapPage.tsx` | 838 | 350 | **RESOLU** | Plus au-dessus des seuils de risque structurel. |
| `frontend/src/components/CesiumRouteMap.tsx` | 829 | 117 | **RESOLU** | Fichier compact. |
| `frontend/src/features/data/dataPortability.ts` | 749 | 44 | **RESOLU** | Decoupage effectif. |
| `frontend/src/features/cloud/useCloudController.ts` | 687 | 536 | **RESTANT** | Encore volumineux et prioritaire pour un prochain split. |
| `frontend/src/features/routing/useRoutingController.actions.ts` | 612 | 371 | **RESOLU** | Redescendu sous 400 LOC. |
| `backend/src/BikeVoyager.Infrastructure/Routing/ValhallaLoopService.cs` | 618 | 255 | **RESOLU** | Taille maitrisee. |
| `backend/src/BikeVoyager.AppHost/Program.cs` | 459 | 17 | **RESOLU** | Bootstrapping minimal. |
| `backend/src/BikeVoyager.Infrastructure/Pois/OverpassGeometryHelper.cs` | 405 | 348 | **RESOLU** | Redescendu sous 400 LOC. |

Critere de statut :
- `RESOLU` = hotspot historique reduit sous 400 LOC ET responsabilite unique.
- `RESTANT` = hotspot historique encore au-dessus de 400 LOC OU melange de responsabilites.

Verification au 2026-02-16 : 8/9 anciens hotspots sont `RESOLU`, 1/9 reste `RESTANT`.

## 2) Hotspots LOC actuels (etat reel)

### Backend (top 5)

| Fichier exact | LOC |
|---|---:|
| `backend/src/BikeVoyager.Infrastructure/Pois/OverpassGeometryHelper.cs` | 348 |
| `backend/src/BikeVoyager.Api/Cloud/Providers/GoogleDriveCloudProviderClient.cs` | 335 |
| `backend/src/BikeVoyager.Infrastructure/Routing/ValhallaRouteService.cs` | 302 |
| `backend/src/BikeVoyager.Api/Cloud/CloudSyncEndpointHandlers.cs` | 296 |
| `backend/src/BikeVoyager.Infrastructure/Pois/PoiNormalizer.cs` | 290 |

Constat : aucun fichier backend depasse 400 LOC.

### Frontend applicatif (hors tests, fichiers > 400 LOC)

| Fichier exact | LOC |
|---|---:|
| `frontend/src/ui/pages/DataPage.tsx` | 576 |
| `frontend/src/features/cloud/useCloudController.ts` | 536 |
| `frontend/src/app/AppPages.tsx` | 491 |
| `frontend/src/features/data/useDataController.ts` | 490 |
| `frontend/src/ui/pages/PoiPanel.tsx` | 477 |
| `frontend/src/features/map/useMapController.ts` | 449 |
| `frontend/src/ui/pages/PlannerPage.tsx` | 415 |
| `frontend/src/features/data/useDataController.addressBookActions.ts` | 407 |
| `frontend/src/state/appStore.ts` | 407 |

Note : `frontend/src/test/App.test.tsx` est aussi au-dessus de 400 LOC (428), mais hors perimetre applicatif.

Priorisation split frontend : commencer par `frontend/src/ui/pages/DataPage.tsx`, puis `frontend/src/features/cloud/useCloudController.ts`, puis `frontend/src/app/AppPages.tsx`.

## 3) Restant (uniquement les constats encore vrais)

- Le principal hotspot historique restant est `frontend/src/features/cloud/useCloudController.ts` (536 LOC).
- La dette de taille est desormais concentree sur le frontend (9 fichiers applicatifs > 400 LOC, +1 fichier de test > 400 LOC).
- Le backend est revenu sous le seuil de 400 LOC pour les fichiers anciennement critiques.

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
