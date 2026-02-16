# Audit technique — BikeVoyager (objectif : vitrine GitHub)

> Analyse statique du dépôt fourni (mono-repo `backend/` + `frontend/` + `infra/`).

## 1) Synthèse exécutable

### Ce qui ressort comme **fort**
- **Produit cohérent** : planification d’itinéraires *marche / vélo / VAE* avec **route** (A→B) et **boucle**, affichage **carte 2D/3D (Cesium)**, **POI** le long du tracé, **export GPX**.
- **Backend pro** : Minimal API .NET 10, `ProblemDetails`, Serilog JSON, corrélation, options, `HttpClientFactory` + Polly, rate limiting, garde d’origine, session anonyme HttpOnly signée.
- **Cloud Sync bien pensé** : OAuth (Google Drive / OneDrive) géré côté API (tokens non exposés au navigateur), stockage de session via cache distribué (Redis) avec fallback mémoire.
- **Qualité** : CI GitHub Actions (format + build + tests + audits), tests backend (unit + API), tests frontend (Vitest) + E2E (Playwright), i18n FR/EN, PWA.

### Les **3 risques** pour une vitrine GitHub “clean & auditable”
1. **Fichiers monolithiques** (lisibilité/maintenabilité) :
   - Backend : `Program.cs` **1672 lignes**, `CloudSyncEndpoints.cs` **1660 lignes**, `OverpassPoiService.cs` **1420 lignes**.
   - Frontend : `src/App.tsx` **4766 lignes** (hotspot majeur), `CesiumRouteMap.tsx` **829 lignes**, `MapPage.tsx` **837 lignes**.
2. **Quelques incohérences/artefacts** (petits mais visibles en vitrine) :
   - `scripts/dev-test` et `scripts/dev-audit` pointent vers `BikeVoyageur.sln` (typo) au lieu de `BikeVoyager.sln`.
   - Les docs parlent de port Vite “dynamique 5173..5190”, alors que l’AppHost force `VITE_STRICT_PORT=true` et `VITE_DEV_PORT=5173`.
   - Email personnel dans le repo (ex : `FeedbackOptions.RecipientEmail` + `appsettings.json`).
   - Un commentaire en anglais : `frontend/src/features/app/domain.ts` (TODO).
3. **Cohérence API** : mix `api/v1/*` (health/trips/ping) et `api/*` (route/loop/poi/places/valhalla/cloud). En vitrine, c’est un point qui saute aux yeux.

## 2) Compréhension fonctionnelle

### Parcours utilisateur (frontend)
1. **Planifier**
   - Choix du **mode** : marche / vélo / VAE.
   - Choix du **type** : aller simple / boucle.
   - **Recherche de lieux** (autocomplete) via l’API.
   - Lancement du calcul (route ou boucle).
2. **Carte**
   - Affichage du tracé sur **Cesium** avec mode **2D/3D**.
   - Résumé : distance, durée, ETA, (boucle : overlap score), profil d’altitude quand dispo.
   - **POI** autour du trajet : filtrage par catégories + corridor.
   - Ajout de détours/waypoints (POI ou custom) et recalcul.
   - **Export GPX**.
3. **Profils**
   - Réglage de vitesses par mode (impacte ETA et simulation).
4. **Données**
   - Sauvegarde locale (localStorage), import/export, chiffrement optionnel.
   - **Cloud Sync** (Google Drive / OneDrive) via OAuth.
5. **Aide**
   - Diagnostic Valhalla (ready/build/update available).
   - Démarrage manuel d’une mise à jour OSM.

### Capabilities côté API (backend)
- **Routing** :
  - `POST /api/route` : route A→B (options, vitesse, assist VAE, waypoints, optimisation).
  - `POST /api/loop` : génération de boucle à distance cible (variation + scoring recouvrement).
- **Geocoding** :
  - `GET /api/places/search` et `GET /api/places/reverse` (France : Geo API Gouv + API Adresse).
- **POI** :
  - `GET|POST /api/poi/around-route` : requête Overpass, post-traitement (distance au tracé, tags, etc.).
- **Exports** :
  - `POST /api/export/gpx` : export fichier.
- **Cloud** :
  - `GET /api/cloud/providers|session|status`
  - `GET /api/cloud/oauth/start` + `POST /api/cloud/oauth/callback`
  - `POST /api/cloud/backup/upload` + restore etc.
- **Ops Valhalla** :
  - `GET /api/valhalla/status|ready`
  - `POST /api/valhalla/update/start`
- **Divers** :
  - `POST /api/feedback`
  - `GET /api/v1/health`, `GET|POST /api/v1/trips`, `GET /api/v1/external/ping`

### Ce qui “manque” fonctionnellement (si objectif produit)
*(à décider selon la vitrine souhaitée)*
- **Persistance métier** : `/api/v1/trips` est **in-memory** et non intégré au front (le front stocke surtout en local). Si l’axe vitrine est “architecture backend”, une persistance (PostgreSQL + EF Core) renforcerait.
- **Auth** : l’app est volontairement “sans login”, mais dès que Cloud/feedback existent, il faut expliquer clairement le modèle de sécurité (origine, cookies, rate limiting, pas d’auth forte).
- **Partage** : pas de partage d’itinéraire (lien, QR, export autre que GPX), pas de gestion multi-appareils hors cloud backup.
- **Observabilité** : dashboard Aspire est mentionné, mais pas d’instrumentation OpenTelemetry dans l’API.

## 3) Analyse technique (ce qui est bien)

### Backend (.NET 10)
- **Architecture** : `Api -> Application -> Infrastructure -> Domain` (lisible, séparations nettes).
- **Résilience & intégrations** : typed HttpClients + timeouts + Polly.
- **Cross-cutting** :
  - Serilog JSON
  - Correlation ID (`X-Correlation-Id`)
  - `ProblemDetails` enrichi avec correlationId
  - Rate limiting global + policies dédiées (compute/export/feedback)
  - Garde d’origine (`Origin`/`Referer`) + CORS optionnel
  - Session anonyme HttpOnly signée (DataProtection)
- **Valhalla** : mécanique “blue/green” côté data path + état `ready`/build/update available.

### Frontend (React 19, TS, Vite, Mantine)
- **UX** : thème centralisé + i18n FR/EN, mobile-first.
- **Carto** : Cesium (2D/3D) + fallback si WebGL absent.
- **Qualité** : ESLint/Prettier, Vitest + Playwright E2E (mock API), PWA.

### DevEx / CI
- CI séparée backend/frontend (formatting, tests, audits).
- Dependabot configuré (npm/nuget/github-actions).
- Scripts Valhalla (build/check/watch/cleanup) en `.ps1` + `.sh`.

## 4) Points d’amélioration (priorisés)

### Niveau 0 — “Quick wins” (effet vitrine immédiat)
1. **Corriger les scripts**
   - `scripts/dev-test` + `scripts/dev-audit` : remplacer `BikeVoyageur.sln` → `BikeVoyager.sln`.
2. **Nettoyer les infos perso**
   - Remplacer `FeedbackOptions.RecipientEmail` et la valeur dans `appsettings.json` par un placeholder (`contact@example.com`) + doc “config via variables d’environnement / user-secrets”.
3. **Aligner docs ↔ code**
   - Soit remettre le port dynamique côté Vite/AppHost, soit corriger la doc (et expliquer le choix “port stable” pour OAuth).
4. **Commentaires FR**
   - Traduire le TODO en anglais dans `frontend/src/features/app/domain.ts`.

### Niveau 1 — Refactor structurel (SOLID / lisibilité / auditabilité)

#### Backend
- **Découper `Program.cs`**
  - Créer des classes d’endpoints par feature : `PlacesEndpoints`, `RoutingEndpoints`, `PoiEndpoints`, `ValhallaAdminEndpoints`, `ExportsEndpoints`, `ApiV1Endpoints`.
  - Extraire les helpers (parsing GeoJSON, lecture status/build/update) dans des services testables.
- **Découper `CloudSyncEndpoints.cs`**
  - Séparer : endpoints, `CloudSyncService`, `CloudSessionStore`, modèles/DTO, helpers crypto/PKCE.
  - Ajouter une batterie de tests unitaires sur parsing OAuth + validations.
- **Découper `OverpassPoiService.cs`**
  - Extraire : query builder, mapping réponse, géométrie (distance au tracé/projection), déduplication, cache.
- **Cohérence API**
  - Choisir une stratégie : tout en `/api/v1/*` (recommandé) OU tout en `/api/*`, mais éviter le mix.
- **Erreurs uniformes**
  - Standardiser les payloads d’erreurs : `ProblemDetails` partout (y compris 4xx/5xx “custom”).

#### Frontend
- **Refactor majeur : `src/App.tsx` (4766 lignes)**
  - Introduire une couche “state + orchestration” (ex : `features/app/store` + hooks) et sortir l’UI dans des composants.
  - Séparer clairement :
    - `routing` (calls API route/loop, erreurs, retry)
    - `pois` (fetch, filtres, dédup, alertes)
    - `navigation` (gps/simu + caméra)
    - `data` (import/export/chiffrement)
    - `cloud` (oauth + backup)
  - Éviter les “mega-functions” dans App : déplacer dans `domain.ts`/`services.ts`.
- **Refactor `CesiumRouteMap.tsx`**
  - Extraire des hooks : `useCesiumViewer`, `useRouteEntity`, `usePoiEntities`, `useNavigationEntity`, `useCameraPresets`.
- **Découper les traductions**
  - Passer `i18n.ts` vers des JSON `locales/fr.json` + `locales/en.json` (lisible, contributions facilitées).

### Niveau 2 — “Vitrine GitHub” (documentation & engineering practices)
- Ajouter un **LICENSE** (MIT/Apache-2.0) + `CONTRIBUTING.md` + `CODE_OF_CONDUCT.md` + `SECURITY.md`.
- Ajouter des **badges** : CI, coverage, license.
- Ajouter `global.json` (SDK .NET) + `.nvmrc` (Node) pour reproductibilité.
- Ajouter `Directory.Build.props` + `.editorconfig` (analyzers, warnings-as-errors, style).
- Ajouter un `docs/ARCHITECTURE.md` (diagramme C4 : Context/Container/Component).
- Ajouter un `docs/API.md` (table endpoints + exemples request/response + codes erreur).
- Ajouter des **captures d’écran** (Planifier / Carte 3D / Données / Aide) + un GIF court “happy path”.

### Niveau 3 — Scalabilité & hardening (si tu veux pousser le curseur)
- **Instrumentation OpenTelemetry** (traces + metrics), export OTLP vers Aspire dashboard.
- **Health checks** réels : Valhalla, Overpass, Geo API, Redis.
- **Persistance** : Postgres + EF Core (Trips + profils + favoris) + migrations.
- **Sécurité** : durcir `ForwardedHeaders`, headers sécurité, clarifier CSRF (cookie-based) si endpoints “unsafe” se multiplient.
- **Packaging** : Dockerfiles (API + front), `docker compose` “full stack demo”.

## 5) Reco “plan de PR” (pragmatique)

1. PR1 — Nettoyage vitrine
   - Fix scripts (`BikeVoyager.sln`), enlever email perso, harmoniser doc port.
2. PR2 — Refactor backend (sans changement fonctionnel)
   - Split endpoints + split CloudSync + tests associés.
3. PR3 — Refactor frontend (sans changement fonctionnel)
   - Décomposer `App.tsx`, extraire store/hooks, i18n JSON.
4. PR4 — Docs & gouvernance
   - License + contributing + templates + architecture diagrams + screenshots.

---

## Annexes — hotspots (LOC)

### Backend
- `backend/src/BikeVoyager.Api/Program.cs` : **1672**
- `backend/src/BikeVoyager.Api/Cloud/CloudSyncEndpoints.cs` : **1660**
- `backend/src/BikeVoyager.Infrastructure/Pois/OverpassPoiService.cs` : **1420**

### Frontend
- `frontend/src/App.tsx` : **4766**
- `frontend/src/features/app/components/MapPage.tsx` : **837**
- `frontend/src/components/CesiumRouteMap.tsx` : **829**
- `frontend/src/i18n.ts` : **994**
