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

## 7) Historique UI consolide (audit du 2026-02-15)

Cette section remplace le document precedent `docs/ui-audit-2026-02-15.md`.

### Perimetre
- shell de navigation desktop/mobile
- theme global (couleurs, typo, tailles, radius)
- panneaux fonctionnels (navigation, POI, tournee)
- ecran Aide (diagnostic cloud)

### Changements utiles conserves
- Systeme visuel frontend homogene (`frontend/src/theme.ts`) :
  - echelle typographique explicite (`fontSizes`, `lineHeights`, `headings.sizes`)
  - defaults composants harmonises (`Button`, `ActionIcon`, `SegmentedControl`, champs de saisie, `Paper`, `Badge`)
- Ergonomie mobile renforcee dans `frontend/src/App.tsx` :
  - menu bas sans debordement horizontal (`flex: 1`, `minWidth: 0`, `nowrap`, `gap=0`)
  - etat actif plus lisible (`fontWeight` renforce)
- Cohesion des panneaux :
  - `frontend/src/features/app/components/MapCollapsibleSection.tsx`
  - `frontend/src/features/app/components/NavigationOptionsPanel.tsx`
  - `frontend/src/features/app/components/PoiPanel.tsx`
  - `frontend/src/features/app/components/DeliveryPlannerPanel.tsx`
  - actions : chevrons coherents, densite/padding homogenes, radius harmonises, espacement standardise
- Nettoyage de l'ecran Aide :
  - suppression de `Backend cache` et `Fallback`
  - conservation du statut cloud utile (cache distribue, diagnostic, heure serveur)
  - suppression des cles i18n devenues inutilisees
- Maintenabilite des endpoints frontend :
  - centralisation des chemins `/api/...` dans `frontend/src/features/app/apiPaths.ts`
  - remplacement des chaines hardcodees dans app + tests

### Couverture E2E ajoutee
- Outillage Playwright :
  - `frontend/playwright.config.ts`
  - scripts npm `e2e` et `e2e:ui`
  - exclusion `e2e/**` cote Vitest (`frontend/vite.config.ts`)
- Scenarios introduits (`frontend/e2e/app-shell.spec.ts`) :
  - footer mobile sans debordement horizontal
  - aide affiche le statut cloud utile sans backend/fallback
  - parcours utilisateur complet planifier -> carte
- CI frontend : installation Chromium Playwright + execution `npm run e2e` dans `.github/workflows/ci.yml`

### Validation executee (audit UI 2026-02-15)
- `npm run lint` : OK
- `npm run test` : OK
- `npm run build` : OK
- `npm run e2e` : OK

### Risques residuels identifies
- pas de snapshot visuel cross-browser (Safari/Firefox)
- pas de parcours E2E contre API reelle (mocks `/api/*` assumes)

---

Cet audit reflete l'etat observe du depot au **16 fevrier 2026**.
