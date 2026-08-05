# RUNBOOK

## Objet
Runbook opérationnel de BikeVoyager (local + déploiement `home`) sans données sensibles.

## Prérequis
- .NET SDK `10.0.302` ou patch compatible dans la même bande
- Node.js `24.19.0` + npm
- Docker + Docker Compose
- PowerShell (`pwsh`) pour les scripts `scripts/dev-*`

## Local: démarrer / arrêter
Démarrage (backend + frontend, et Valhalla si les données existent):

```powershell
./scripts/dev-up
```

Arrêt:

```powershell
./scripts/dev-down
```

## Local: commandes utiles
Tests agrégés:

```powershell
./scripts/dev-test
```

Audit dépendances:

```powershell
./scripts/dev-audit      # Unix/Git Bash
./scripts/dev-audit.ps1  # PowerShell Windows
```

Backend seul:

```powershell
dotnet run --project backend/src/BikeVoyager.Api/BikeVoyager.Api.csproj
```

Frontend seul:

```powershell
npm --prefix frontend ci
npm --prefix frontend run dev
```

AppHost (.NET Aspire):

```powershell
dotnet run --project backend/src/BikeVoyager.AppHost/BikeVoyager.AppHost.csproj
```

## Alignement dépendances et SDK
Sources à vérifier avant tout alignement :

- `global.json` pour le SDK .NET.
- `.nvmrc` et `frontend/package.json` pour Node.js.
- `frontend/package-lock.json` pour npm.
- Les fichiers `.csproj` pour NuGet et Aspire.
- Les Dockerfiles et compose pour les images.

Commandes de diagnostic :

```powershell
dotnet list BikeVoyager.sln package --vulnerable --include-transitive
dotnet list BikeVoyager.sln package --outdated --include-transitive
npm --prefix frontend audit --omit=dev
npm --prefix frontend audit
npm --prefix frontend outdated
```

Règles courantes :

- Corriger en priorité les vulnérabilités directes et transitives.
- Préférer les mises à jour patch/mineures compatibles.
- Garder Node aligné sur `.nvmrc` (`24.19.0`) et `@types/node` sur la ligne `24.x`.
- Garder les images Docker applicatives épinglées (`dotnet/sdk:10.0.302`, `dotnet/aspnet:10.0.10`, `node:24.19.0-alpine`, `nginx:1.31.3-alpine`).
- Traiter les montées majeures de dépendances et d'images Docker comme des changements dédiés.

## Déploiement home
Pipeline de référence: [`.github/workflows/deploy-manual.yml`](../.github/workflows/deploy-manual.yml)

- Type: `workflow_dispatch` (inputs: `environment`, `ref`)
- Runner: `self-hosted`, `linux`, `ci`
- Script exécuté: [`scripts/deploy-home.sh`](../scripts/deploy-home.sh)
- Compose cible: [`deploy/home.compose.yml`](../deploy/home.compose.yml)

Validation post-déploiement (API + Valhalla):

```bash
curl http://127.0.0.1:5080/api/v1/health
curl http://127.0.0.1:5080/api/v1/valhalla/status
```

## Valhalla: opérations
Compose local Valhalla:

```bash
docker compose -f infra/valhalla.compose.yml up -d valhalla
```

Scripts de build / update / cleanup:
- [`scripts/valhalla-build-france.ps1`](../scripts/valhalla-build-france.ps1)
- [`scripts/valhalla-check-update.ps1`](../scripts/valhalla-check-update.ps1)
- [`scripts/valhalla-watch-updates.ps1`](../scripts/valhalla-watch-updates.ps1)
- [`scripts/valhalla-cleanup.ps1`](../scripts/valhalla-cleanup.ps1)

## Configuration sensible
- Ne pas versionner de secrets dans le dépôt.
- Utiliser des placeholders dans `deploy/home.env` (modèle: [`deploy/home.env.example`](../deploy/home.env.example)).
- Variables OAuth cloud supportées: `CloudSync__GoogleDrive__*`, `CloudSync__OneDrive__*`.
- Variables feedback SMTP supportées: `FEEDBACK__*`.

## Documentation de référence
- [README.md](../README.md)
- [docs/API.md](./API.md)
- [docs/ARCHITECTURE.md](./ARCHITECTURE.md)
- [SECURITY.md](../SECURITY.md)
