# Audit technique — BikeVoyager (mise a jour 2026-02-16)

> Objectif : vitrine GitHub propre, auditable et maintenable.  
> Perimetre : depot actuel (`backend/`, `frontend/`, `infra/`) sans changement fonctionnel.

## 1) Synthese executable

### Points forts actuels
- Architecture backend lisible (`Api -> Application -> Infrastructure -> Domain`) avec endpoints regroupes par feature.
- Pipeline qualite en place : CI backend/frontend, tests automatiques, audits de dependances.
- Frontend structure par domaines (`features/*`, `ui/pages/*`, `ui/shell/*`) avec i18n et tests.
- Securite applicative deja presente : `ProblemDetails`, rate limiting, garde d'origine, session anonyme HttpOnly.
- Gouvernance open-source presente a la racine : `LICENSE`, `CODE_OF_CONDUCT.md`, `SECURITY.md`.

### Risques actuels (priorises)
1. **Hotspots frontend encore volumineux** :
   - `frontend/src/i18n.ts` : **994 lignes**
   - `frontend/src/ui/pages/MapPage.tsx` : **838 lignes**
   - `frontend/src/components/CesiumRouteMap.tsx` : **829 lignes**
   - `frontend/src/features/data/dataPortability.ts` : **749 lignes**
   - `frontend/src/features/cloud/useCloudController.ts` : **687 lignes**
   - `frontend/src/features/routing/useRoutingController.actions.ts` : **612 lignes**

## 2) Etat des hotspots frontend cibles

Mesure LOC : `(Get-Content <fichier>).Count` au 2026-02-16.

| Hotspot cible | Fichier exact | LOC reelles | Statut | Commentaire |
|---|---|---:|---|---|
| i18n | `frontend/src/i18n.ts` | 994 | **RESTANT** | Fichier de traductions central toujours monolithique. |
| MapPage | `frontend/src/ui/pages/MapPage.tsx` | 838 | **RESTANT** | Composant encore tres large, decoupage en sous-modules a poursuivre. |
| CesiumRouteMap | `frontend/src/components/CesiumRouteMap.tsx` | 829 | **RESTANT** | Plusieurs responsabilites (render map + interactions + etat) dans un seul fichier. |
| dataPortability | `frontend/src/features/data/dataPortability.ts` | 749 | **RESTANT** | Regroupe encore plusieurs responsabilites de serialisation et migration de donnees. |
| useCloudController | `frontend/src/features/cloud/useCloudController.ts` | 687 | **RESTANT** | Orchestration cloud toujours concentree dans un hook unique. |
| useRoutingController.actions | `frontend/src/features/routing/useRoutingController.actions.ts` | 612 | **RESTANT** | Decoupage initie, mais le module d'actions reste volumineux. |

## 3) Constats corriges depuis l'audit precedent

- Demantelement shell frontend confirme : `frontend/src/ui/shell/AppContainerScreen.tsx` et `frontend/src/ui/shell/AppContainer.tsx` sont chacun a **5 lignes**.
- Decoupage backend confirme :
  - `backend/src/BikeVoyager.Api/Program.cs` : **37 lignes**
  - `backend/src/BikeVoyager.Api/Cloud/CloudSyncEndpoints.cs` : **63 lignes**
  - `backend/src/BikeVoyager.Infrastructure/Pois/OverpassPoiService.cs` : **237 lignes**
- Conventions build/style presentes a la racine : `.editorconfig` et `Directory.Build.props`.
- Scripts `scripts/dev-test` et `scripts/dev-audit` alignes sur `BikeVoyager.sln`.
- Adresse email sensible remplacee par un placeholder (`contact@example.com`) cote configuration feedback.
- Point de commentaire TODO en anglais obsolete : le TODO de reference est maintenant en francais.
- Regles d'ignore renforcees pour `.vs` imbriques via `**/.vs/` dans `.gitignore`.
- Versionnement API harmonise : `/api/v1/*` est canonique, avec middleware de compatibilite temporaire pour les routes legacy `/api/*`.
- Headers de securite et HSTS deja formalises cote API :
  - `backend/src/BikeVoyager.Api/Extensions/WebApplicationExtensions.cs`
  - `backend/src/BikeVoyager.Api/Middleware/SecurityHeadersMiddleware.cs`
- Gouvernance OSS completee a la racine : `LICENSE`, `CODE_OF_CONDUCT.md`, `SECURITY.md`.

## 4) Hygiene des artefacts locaux (etat actuel)

Verification sur les fichiers **suivis** par Git : aucun artefact local detecte dans les categories suivantes :

- dossiers `.dev/`, `.tmp/`, `.vs/`, `logs/`, `dist/`, `dist-ssr/`, `node_modules/`, `TestResults/`, `bin/`, `obj/`
- fichiers `*.log`, `*.tmp`, `*.user`

Conclusion : les artefacts locaux sont ignores et non versionnes dans l'etat courant du depot.

## 5) Priorites de PR (sans changement de comportement)

1. **Poursuivre le decoupage frontend** (`i18n.ts`, `MapPage.tsx`, `CesiumRouteMap.tsx`, `dataPortability.ts`, `useCloudController.ts`, `useRoutingController.actions.ts`).
2. **Documenter la deprecation de l'alias `/api/*`** (criteres de retrait du middleware de compatibilite et calendrier de suppression).
3. **Ajouter des tests de non-regression frontend** sur les zones en cours de decoupage (controllers, pages carte, i18n).

## 6) Hotspots LOC actuels

### Backend
- `backend/src/BikeVoyager.Infrastructure/Routing/ValhallaLoopService.cs` : **618**
- `backend/src/BikeVoyager.AppHost/Program.cs` : **459**
- `backend/src/BikeVoyager.Infrastructure/Pois/OverpassGeometryHelper.cs` : **405**

### Frontend
- `frontend/src/i18n.ts` : **994**
- `frontend/src/ui/pages/MapPage.tsx` : **838**
- `frontend/src/components/CesiumRouteMap.tsx` : **829**
- `frontend/src/features/data/dataPortability.ts` : **749**
- `frontend/src/features/cloud/useCloudController.ts` : **687**
- `frontend/src/features/routing/useRoutingController.actions.ts` : **612**

---

Cet audit reflete l'etat observe du depot au **16 fevrier 2026**.
