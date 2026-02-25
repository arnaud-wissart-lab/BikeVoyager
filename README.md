# BikeVoyager

Planifiez rapidement des itinéraires vélo fiables, de la balade urbaine au parcours longue distance.
BikeVoyager combine calcul d’itinéraire, points d’intérêt et sécurité d’accès API dans une stack moderne orientée production.
Le projet vise une expérience développeur robuste sans sacrifier la lisibilité produit.

[![CI](https://img.shields.io/github/actions/workflow/status/arnaud-wissart-lab/BikeVoyager/ci.yml?branch=main&label=CI)](https://github.com/arnaud-wissart-lab/BikeVoyager/actions/workflows/ci.yml)
[![Déploiement manuel](https://img.shields.io/github/actions/workflow/status/arnaud-wissart-lab/BikeVoyager/deploy-manual.yml?branch=main&label=D%C3%A9ploiement%20manuel)](https://github.com/arnaud-wissart-lab/BikeVoyager/actions/workflows/deploy-manual.yml)
[![Licence](https://img.shields.io/github/license/arnaud-wissart-lab/BikeVoyager.svg?cacheSeconds=3600)](LICENSE)
![.NET 10](https://img.shields.io/badge/.NET-10-512BD4)

## Démo live

URL publique : à venir (placeholder en attente d'exposition Internet).
La version opérationnelle est déployée en mode `home` via workflow manuel (voir [Production (home)](#production-home)).

## Aperçu

BikeVoyager aide à planifier des trajets vélo personnalisés via une API ASP.NET Core et une interface React.
L’application orchestre calcul d’itinéraire, suggestions de boucles et intégration de points d’intérêt.
Elle est pensée pour un usage local reproductible et une montée en qualité continue (tests, audit, CI).

## Captures

<p align="center">
  <img src="https://raw.githubusercontent.com/arnaud-wissart-lab/BikeVoyager/main/docs/screenshots/BikeVoyager1.png" width="800"/>
  <span width="20"></span>
  <img src="https://raw.githubusercontent.com/arnaud-wissart-lab/BikeVoyager/main/docs/screenshots/BikeVoyager3.png" height="400"/>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/arnaud-wissart-lab/BikeVoyager/main/docs/screenshots/BikeVoyager2.png" width="800"/>
  <span width="20"></span>
  <img src="https://raw.githubusercontent.com/arnaud-wissart-lab/BikeVoyager/main/docs/screenshots/BikeVoyager4.png" height="400"/>
</p>

## Points forts techniques

- API ASP.NET Core (.NET 10) versionnée (`/api/v1/*`)
- Sécurisation des endpoints (Origin guard, cookies HttpOnly, rate limiting)
- Résilience HTTP avec `Microsoft.Extensions.Http.Resilience`
- Frontend React + Vite + TypeScript avec i18n (FR/EN)
- Tests unitaires et d’intégration backend (xUnit)
- Tests frontend (Vitest) et end-to-end (Playwright)
- Pipeline CI complet (formatage, lint, tests, audit dépendances)
- Déploiement reproductible (Docker, image Valhalla épinglée)

## Architecture

Frontend (React + Vite)
        ↓
API ASP.NET Core (/api/v1)
        ↓
- Valhalla (routing)
- Overpass (POI)
- Cloud providers (OAuth)

Voir aussi : docs/ARCHITECTURE.md

## Objectif

BikeVoyager est une application full-stack combinant une API ASP.NET Core (.NET 10)
et un frontend React + TypeScript.

Le dépôt met l’accent sur la qualité du code, la testabilité, la sécurité
et la reproductibilité en environnement local (orchestration Aspire).

## Liens rapides

- [Architecture](docs/ARCHITECTURE.md)
- [API](docs/API.md)
- [Sécurité](SECURITY.md)
- [Contribuer](CONTRIBUTING.md)

## Structure

- `backend/` : API + couches Application/Domain/Infrastructure + tests
- `frontend/` : application React/Vite
- `infra/` : données et artefacts d’infrastructure (dont Valhalla)
- `scripts/` : scripts de dev, build, audit, update Valhalla
- `docs/` : documentation projet (audit, API, sécurité, contribution)

## Solutions

- `BikeVoyager.slnx` : solution principale (Visual Studio)
- `BikeVoyager.sln` : solution CLI/CI
- `frontend/BikeVoyager.Frontend.csproj` : projet de contenu pour exposer le frontend dans la solution

## Prérequis

- `.NET SDK 10.x`
- `Node.js 20+` et `npm`
- `Docker Desktop` (requis pour Valhalla)

## Production (home)

- Déclenchement : workflow `Déploiement Manuel` en `workflow_dispatch` (`Actions > Déploiement Manuel > Run workflow`) avec `environment=home` et la `ref` cible (branche/tag/SHA).
- Secrets requis : `SSH_HOST`, `SSH_USER`, `SSH_PRIVATE_KEY`, `SSH_PORT` (optionnel, défaut `22`).
- Ports utilisés : `5080` (API) et `5081` (frontend + healthcheck `http://127.0.0.1:5081`).

Le workflow exécute `scripts/deploy-home.sh`, met à jour `/home/arnaud/apps/bikevoyager` puis relance la stack Docker définie dans `deploy/home.compose.yml`. Valhalla reste optionnel et peut être redirigé via `VALHALLA_BASE_URL`.

## Démarrage rapide

Backend seul :

```powershell
dotnet run --project backend/src/BikeVoyager.Api/BikeVoyager.Api.csproj
```

Frontend seul :

```powershell
cd frontend
npm ci
npm run dev
```

`npm ci` nécessite `package-lock.json` (présent dans le repo).

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

- Détection des mises à jour OSM en arrière-plan (`scripts/valhalla-watch-updates.ps1` / `scripts/valhalla-watch-updates.sh`)
- Pas d’application automatique de la mise à jour (`VALHALLA_UPDATE_AUTO_BUILD=false`)
- Notification visible dans l’onglet Aide du frontend
- Lancement manuel via bouton côté front (`POST /api/v1/valhalla/update/start`)

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

- `GET /api/v1/valhalla/status`
- `POST /api/v1/valhalla/update/start`
- `GET /api/v1/valhalla/ready`
- `POST /api/v1/route`
- `POST /api/v1/loop`

## Protection API (anti-abus)

L'API applique trois niveaux de protection:

- garde d'origine sur `/api/v1/*` (origines autorisées via `ApiSecurity:AllowedOrigins`)
- session anonyme silencieuse sur `/api/v1/*` (cookie signé HttpOnly)
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

## PWA

Objectif : rendre l’application installable localement sans dégrader l’usage cartographique.

- Activation via `vite-plugin-pwa` (manifest + service worker générés au build)
- Enregistrement du service worker dans `frontend/src/main.tsx`
- Icônes PWA dans `frontend/public/pwa-192.png` et `frontend/public/pwa-512.png`
- Politique de cache : assets statiques frontend oui, tuiles OpenStreetMap non (évite volume disque excessif et données périmées)

Vérification locale :

```powershell
cd frontend
npm ci
npm run build
npm run preview
```

Puis ouvrir l’URL de preview et vérifier la proposition d’installation du navigateur.

Installation iOS : `Safari > Partager > Sur l’écran d’accueil`.

Invite d’installation : le composant dédié gère la popin FR/EN et le cas iOS sans événement navigateur spécifique.

## Documentation liée

- [RUNBOOK](RUNBOOK.md)
- [API](docs/API.md)
- [Changelog](CHANGELOG.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Audit technique](docs/AUDIT_TECHNIQUE.md)
- [Contributing](CONTRIBUTING.md)
- [Security](SECURITY.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [License](LICENSE)
- [Frontend README](frontend/README.md)
