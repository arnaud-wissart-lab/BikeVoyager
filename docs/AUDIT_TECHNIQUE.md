# Audit technique — BikeVoyager (mise a jour 2026-02-16)

> Objectif : vitrine GitHub propre, auditable et maintenable.  
> Perimetre : depot actuel (`backend/`, `frontend/`, `infra/`) sans changement fonctionnel.

## 1) Synthese executable

### Points forts actuels
- Architecture backend lisible (`Api -> Application -> Infrastructure -> Domain`) avec endpoints regroupes par feature.
- Pipeline qualite en place : CI backend/frontend, tests automatiques, audits de dependances.
- Frontend structure par domaines (`features/*`, `ui/pages/*`, `ui/shell/*`) avec i18n et tests.
- Securite applicative deja presente : `ProblemDetails`, rate limiting, garde d'origine, session anonyme HttpOnly.

### Risques actuels (priorises)
1. **Hotspots frontend encore volumineux** :
   - `frontend/src/i18n.ts` : **994 lignes**
   - `frontend/src/features/routing/domain.ts` : **977 lignes**
   - `frontend/src/ui/pages/MapPage.tsx` : **838 lignes**
   - `frontend/src/components/CesiumRouteMap.tsx` : **829 lignes**
2. **Coherence de versionnement API** :
   - Mix actuel entre routes `/api/*` et `/api/v1/*`.
3. **Headers de securite HTTP/HSTS non formalises** :
   - Pas de configuration explicite relevee pour HSTS et headers web standards.
4. **Gouvernance vitrine open-source incomplete** :
   - Fichiers absents a la racine : `LICENSE`, `CODE_OF_CONDUCT.md`, `SECURITY.md`.

## 2) Etat des hotspots cibles (RESOLU vs RESTANT)

Mesure LOC : `(Get-Content <fichier>).Length` au 2026-02-16.

| Hotspot cible | Fichier exact | LOC reelles | Statut | Commentaire |
|---|---|---:|---|---|
| AppContainerScreen | `frontend/src/ui/shell/AppContainerScreen.tsx` | 5 | **RESOLU** | Fichier reduit a un adaptateur minimal vers `AppRoot`. |
| MapPage | `frontend/src/ui/pages/MapPage.tsx` | 838 | **RESTANT** | Composant encore tres large, decoupage en sous-modules a poursuivre. |
| CesiumRouteMap | `frontend/src/components/CesiumRouteMap.tsx` | 829 | **RESTANT** | Plusieurs responsabilites (render map + interactions + etat) dans un seul fichier. |
| i18n | `frontend/src/i18n.ts` | 994 | **RESTANT** | Fichier de traductions central toujours monolithique. |
| domain | `frontend/src/features/routing/domain.ts` | 977 | **RESTANT** | Regles/metiers routing centralisees dans un seul module. |

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

## 4) Hygiene des artefacts locaux (etat actuel)

Verification sur les fichiers **suivis** par Git : aucun artefact local detecte dans les categories suivantes :

- dossiers `.dev/`, `.tmp/`, `.vs/`, `logs/`, `dist/`, `dist-ssr/`, `node_modules/`, `TestResults/`, `bin/`, `obj/`
- fichiers `*.log`, `*.tmp`, `*.user`

Conclusion : les artefacts locaux sont ignores et non versionnes dans l'etat courant du depot.

## 5) Priorites de PR (sans changement de comportement)

1. **Poursuivre le decoupage frontend** (`i18n.ts`, `domain.ts`, `MapPage.tsx`, `CesiumRouteMap.tsx` puis controllers > 800 LOC).
2. **Harmoniser la strategie de routes API** (tout en `/api/v1/*` ou tout en `/api/*`) et documenter le choix.
3. **Ajouter les headers de securite/HSTS** cote API (avec activation conditionnelle par environnement).
4. **Finaliser les fichiers de gouvernance OSS** (`LICENSE`, `CODE_OF_CONDUCT.md`, `SECURITY.md`).

## 6) Hotspots LOC actuels

### Backend
- `backend/src/BikeVoyager.Infrastructure/Routing/ValhallaLoopService.cs` : **618**
- `backend/src/BikeVoyager.AppHost/Program.cs` : **459**
- `backend/src/BikeVoyager.Infrastructure/Pois/OverpassGeometryHelper.cs` : **405**

### Frontend
- `frontend/src/features/data/useDataController.ts` : **1008**
- `frontend/src/features/routing/useRoutingController.ts` : **998**
- `frontend/src/i18n.ts` : **994**
- `frontend/src/features/routing/domain.ts` : **977**
- `frontend/src/features/map/useMapController.ts` : **887**
- `frontend/src/app/AppRoot.tsx` : **885**
- `frontend/src/ui/pages/MapPage.tsx` : **838**
- `frontend/src/components/CesiumRouteMap.tsx` : **829**
- `frontend/src/features/data/dataPortability.ts` : **749**
- `frontend/src/features/cloud/useCloudController.ts` : **667**

---

Cet audit reflete l'etat observe du depot au **16 fevrier 2026**.
