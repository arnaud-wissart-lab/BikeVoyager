# BikeVoyager (mono-repo)

Documentation de référence : français en priorité.
Des notes en anglais peuvent exister, mais la version FR reste la source principale.

## Objectif

BikeVoyager regroupe un backend `.NET 10` et un frontend `React + TypeScript`.
Le repo vise une base robuste, testable et exploitable localement avec orchestration Aspire.

## Structure

- `backend/` : API + couches Application/Domain/Infrastructure + tests
- `frontend/` : application React/Vite
- `infra/` : données et artefacts d’infrastructure (dont Valhalla)
- `scripts/` : scripts de dev, build, audit, update Valhalla
- `docs/` : documentation ciblée (PWA, etc.)

## Solutions

- `BikeVoyager.slnx` : solution principale (Visual Studio)
- `BikeVoyager.sln` : solution CLI/CI
- `frontend/BikeVoyager.Frontend.csproj` : projet de contenu pour exposer le frontend dans la solution

## Prérequis

- `.NET SDK 10.x`
- `Node.js 20+` et `npm`
- `Docker Desktop` (requis pour Valhalla)

## Démarrage rapide

Backend seul :

```powershell
dotnet run --project backend/src/BikeVoyager.Api/BikeVoyager.Api.csproj
```

Frontend seul :

```powershell
cd frontend
npm install
npm run dev
```

Stack complète (recommandé) :

```powershell
./scripts/dev-up
```

## Démarrage avec Visual Studio

1. Ouvrir `BikeVoyager.slnx`
2. Définir `BikeVoyager.AppHost` en projet de démarrage
3. Lancer `F5`

## Mises à jour Valhalla (mode souple)

Comportement par défaut :

- Détection des mises à jour OSM en arrière-plan (`valhalla-watch`)
- Pas d’application automatique de la mise à jour (`VALHALLA_UPDATE_AUTO_BUILD=false`)
- Notification visible dans l’onglet Aide du frontend
- Lancement manuel via bouton côté front (`POST /api/valhalla/update/start`)

Pendant une mise à jour :

- Build en mode blue/green dans `infra/valhalla/releases/candidate-*`
- Les utilisateurs continuent d’utiliser `infra/valhalla/live`
- Bascule atomique vers la nouvelle release à la fin

## Nettoyage disque Valhalla

Scripts dédiés :

- `scripts/valhalla-cleanup.ps1`
- `scripts/valhalla-cleanup.sh`

Nettoyage effectué :

- anciennes releases `previous-*`
- candidats `candidate-*` obsolètes
- logs de build anciens
- scripts temporaires `.build-step-*.sh`

Variables d’environnement utiles :

- `VALHALLA_RELEASES_TO_KEEP` (défaut `0`)
- `VALHALLA_LOG_RETENTION_DAYS` (défaut `7`)
- `VALHALLA_STALE_CANDIDATE_HOURS` (défaut `6`)
- `VALHALLA_STEP_SCRIPT_RETENTION_HOURS` (défaut `24`)
- `VALHALLA_STALE_LOCK_MINUTES` (défaut `30`)

## Endpoints utiles

- `GET /api/valhalla/status`
- `POST /api/valhalla/update/start`
- `GET /api/valhalla/ready`
- `POST /api/route`
- `POST /api/loop`

## Protection API (anti-abus)

L'API applique trois niveaux de protection:

- garde d'origine sur `/api/*` (origines autorisées via `ApiSecurity:AllowedOrigins`)
- session anonyme silencieuse sur `/api/*` (cookie signé HttpOnly)
- limitation de débit (rate limiting global + politique renforcée sur les endpoints de calcul)

Configuration dans `backend/src/BikeVoyager.Api/appsettings.json` section `ApiSecurity`.
Paramètres principaux: `AllowedOrigins`, `GeneralRequestsPerMinute`,
`ComputeRequestsPerMinute`, `ExportRequestsPerMinute`,
`EnforceOriginForUnsafeMethods`, `AnonymousSessionCookieName`,
`AnonymousSessionLifetimeHours`.

Le frontend n'envoie plus de `X-Session-Id`; la session anonyme est gérée côté API.

Important: un frontend public ne peut pas "prouver" de façon parfaite qu'un appel
vient uniquement de l'application. Ces protections réduisent l'abus mais ne
remplacent pas une authentification forte si l'API est exposée publiquement.

## Tests et audit

```powershell
./scripts/dev-test
./scripts/dev-audit
```

Frontend uniquement (inclut E2E Playwright):

```powershell
npm --prefix frontend run test
npm --prefix frontend run e2e
```

## Documentation liée

- `RUNBOOK.md`
- `docs/pwa.md`
- `docs/ui-audit-2026-02-15.md`
- `frontend/README.md`
