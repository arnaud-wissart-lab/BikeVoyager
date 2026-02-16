# RUNBOOK

## Objet

Ce runbook documente l'exploitation locale de BikeVoyager, avec un focus sur
Valhalla (build, mises a jour, et nettoyage disque).

## Structure du repo

- `backend/` : API .NET, AppHost Aspire, couches applicatives, tests.
- `frontend/` : application React/Vite.
- `infra/valhalla/` : donnees de routage, releases, logs, status.
- `scripts/` : scripts de dev et operations (`dev-*`, `valhalla-*`).

## Solutions

- `BikeVoyager.slnx` : solution principale Visual Studio.
- `BikeVoyager.sln` : solution CLI/CI.

## Prerequis

- .NET SDK 10.x
- Node.js 20+ et npm
- Docker Desktop (necessaire pour Valhalla)
- Dependances frontend installees une fois : `npm install` dans `frontend/`

## Demarrage local

```powershell
./scripts/dev-up
```

Arret :

```powershell
./scripts/dev-down
```

## Demarrage F5 (Visual Studio)

1. Ouvrir `BikeVoyager.slnx`.
2. Definir `BikeVoyager.AppHost` comme projet de demarrage.
3. Lancer `F5`.

Comportement attendu :

- AppHost demarre API, frontend, Redis, et ressources Aspire.
- Dashboard Aspire disponible sur `https://localhost:17000`.
- Frontend expose sur `http://localhost:5173` (port fixe via `VITE_DEV_PORT=5173` et `VITE_STRICT_PORT=true`).
- Watch Valhalla actif (sauf desactivation explicite).

Note :
- L'AppHost sonde `5173..5190` pour detecter une instance frontend deja disponible.
- En demarrage standard via AppHost, le frontend est force sur `5173`.

## Demarrage AppHost en CLI

```powershell
dotnet run --project backend/src/BikeVoyager.AppHost/BikeVoyager.AppHost.csproj
```

## Valhalla : organisation des donnees

Racine donnees : `infra/valhalla/`

- `live/` : donnees actives utilisees par le service.
- `releases/candidate-*` : sorties temporaires de build.
- `releases/previous-*` : anciennes releases conservees selon retention.
- `data/osm.pbf` : source OSM locale.
- `logs/*.log` : logs detaillees de build.
- `build-status.json` : progression build.
- `update-status.json` : statut de verification de mise a jour.
- `.build.lock` : marqueur build en cours.

## Build Valhalla (France)

Windows :

```powershell
./scripts/valhalla-build-france.ps1
```

Linux/macOS :

```sh
chmod +x ./scripts/valhalla-build-france.sh
./scripts/valhalla-build-france.sh
```

Principes :

- Build blue/green : generation dans `releases/candidate-*`, puis promotion atomique vers `live/`.
- Tant que la promotion n'est pas terminee, l'app continue d'utiliser les anciennes tuiles `live/`.
- Rebuild relance seulement si necessaire (donnees invalides, manquantes, source changee, ou force).

## Strategie de mise a jour

- Verification periodique : `scripts/valhalla-check-update.ps1` / `.sh`
- Surveillance periodique : `scripts/valhalla-watch-updates.ps1` / `.sh`
- Lancement manuel depuis l'app : `POST /api/v1/valhalla/update/start`

Par defaut recommande :

- Detection automatique active
- Application automatique des updates desactivee
- Mise a jour lancee manuellement depuis le panneau Aide

## Nettoyage disque (important)

Script dedie :

- `scripts/valhalla-cleanup.ps1`
- `scripts/valhalla-cleanup.sh`

Ce qui est nettoye :

- Anciennes releases `previous-*` selon retention.
- Candidats `candidate-*` stale (orphelins/anciens).
- Logs de build anciennes (`infra/valhalla/logs/*.log`).
- Scripts temporaires `.build-step-*.sh` anciens.

Securite :

- Si `.build.lock` est present, le nettoyage des releases est differe.
- Les donnees actives `live/` ne sont jamais ciblees par le cleanup.

Nettoyage manuel :

```powershell
./scripts/valhalla-cleanup.ps1
```

## Variables d'environnement Valhalla

Mise a jour/build :

- `VALHALLA_AUTO_BUILD`
  - `true` par defaut.
  - Auto-build uniquement si donnees absentes/invalides ou rebuild force.
- `VALHALLA_UPDATE_AUTO_BUILD`
  - `false` recommande.
  - Si `true`, watch applique automatiquement les updates detectees.
- `VALHALLA_UPDATE_WATCH`
  - `true` par defaut.
  - Si `false`, desactive la surveillance periodique.
- `VALHALLA_UPDATE_CHECK_INTERVAL_MINUTES`
  - intervalle de verification (defaut `180`, min `5`).
- `VALHALLA_FORCE_REBUILD`
  - force un rebuild.
- `VALHALLA_FORCE_DOWNLOAD`
  - force le retelechargement `osm.pbf`.

Nettoyage disque :

- `VALHALLA_RELEASES_TO_KEEP`
  - nombre de `previous-*` conserves (defaut `0` pour economiser le disque).
- `VALHALLA_LOG_RETENTION_DAYS`
  - retention des logs en jours (defaut `7`).
- `VALHALLA_STALE_CANDIDATE_HOURS`
  - suppression des `candidate-*` inactifs apres N heures (defaut `6`).
- `VALHALLA_STEP_SCRIPT_RETENTION_HOURS`
  - retention des `.build-step-*.sh` (defaut `24`).
- `VALHALLA_STALE_LOCK_MINUTES`
  - lock `.build.lock` considere stale apres N minutes (defaut `30`, min `5`).

## Endpoints utiles

Valhalla :

- `GET /api/v1/valhalla/status`
- `GET /api/v1/valhalla/ready`
- `POST /api/v1/valhalla/update/start`

Routage :

- `POST /api/v1/route`
- `POST /api/v1/loop`

Compatibilite legacy (temporaire) : les anciens chemins `/api/*` restent acceptes et reecrits vers `/api/v1/*`.

## Configuration feedback (email)

La configuration versionnee utilise des placeholders (pas de donnees personnelles):
- `Feedback:RecipientEmail = contact@example.com`
- `Feedback:SenderEmail = ""`

Surcharge via variables d'environnement:
- `Feedback__RecipientEmail`
- `Feedback__SenderEmail`
- `Feedback__SenderName`
- `Feedback__Smtp__Host`
- `Feedback__Smtp__Port`
- `Feedback__Smtp__UseSsl`
- `Feedback__Smtp__Username`
- `Feedback__Smtp__Password`

Exemple PowerShell:

```powershell
$env:Feedback__RecipientEmail = "contact@example.com"
$env:Feedback__SenderEmail = "noreply@example.com"
```

Exemple user-secrets (dev local):

```powershell
dotnet user-secrets set "Feedback:RecipientEmail" "contact@example.com" --project backend/src/BikeVoyager.Api/BikeVoyager.Api.csproj
dotnet user-secrets set "Feedback:SenderEmail" "noreply@example.com" --project backend/src/BikeVoyager.Api/BikeVoyager.Api.csproj
```

## Protection API

L'API expose un garde-fou anti-abus:

- validation d'origine pour les appels `/api/v1/*` (avec alias legacy `/api/*`) (`ApiOriginGuardMiddleware`)
- session anonyme silencieuse (`AnonymousApiSessionMiddleware`) via cookie signe HttpOnly
- rate limiting global
- rate limiting renforce sur:
  - `/api/v1/route`
  - `/api/v1/loop`
  - `/api/v1/poi/around-route`
  - `/api/v1/export/gpx`

Parametres `ApiSecurity` (dans `appsettings.json`):

- `AllowedOrigins`
- `GeneralRequestsPerMinute`
- `ComputeRequestsPerMinute`
- `ExportRequestsPerMinute`
- `EnforceOriginForUnsafeMethods`
- `AnonymousSessionCookieName`
- `AnonymousSessionLifetimeHours`

Comportement session anonyme:

- sur `/api/v1/*` (et alias legacy `/api/*`, hors `OPTIONS`), un cookie de session est cree s'il est absent/invalide/expire
- la partition de rate limiting utilise cette session en priorite, puis l'IP en fallback
- le frontend ne transmet plus `X-Session-Id`

Note: ces protections limitent le spam mais ne remplacent pas une authentification
forte si l'API doit etre exposee a des clients non fiables.

## Tests

Backend :

```powershell
dotnet test backend/tests/BikeVoyager.ApiTests/BikeVoyager.ApiTests.csproj
dotnet test backend/tests/BikeVoyager.UnitTests/BikeVoyager.UnitTests.csproj
```

Couverture API session anonyme:

- `backend/tests/BikeVoyager.ApiTests/AnonymousApiSessionTests.cs`
  - creation du cookie
  - attributs de securite cookie
  - reutilisation sans rotation
  - remplacement d'un cookie invalide

Frontend :

```powershell
npm --prefix frontend run test
npm --prefix frontend run build
npx --prefix frontend playwright install chromium
npm --prefix frontend run e2e
```

Scripts agreges :

```powershell
./scripts/dev-test
./scripts/dev-audit
```

## Audit UI

Passe UI documentee et auditable :

- `docs/ui-audit-2026-02-15.md`

## Depannage rapide

Si un build a ete coupe :

- Verifier `infra/valhalla/.build.lock`.
- Relancer une mise a jour manuelle via l'app ou script build.
- Lancer `valhalla-cleanup` pour purger les candidats stale et vieux logs.

Si `/api/v1/loop` renvoie `422` alors que status est "ready" :

- Ce n'est pas un "Valhalla down" ; c'est une boucle non satisfaisante.
- Reessayer avec une distance/zone differente.

Si espace disque trop eleve :

- Executer le cleanup manuel.
- Garder `VALHALLA_RELEASES_TO_KEEP=0`.
- Reduire `VALHALLA_LOG_RETENTION_DAYS`.
