# RUNBOOK

## Solution racine

- `BikeVoyageur.slnx` : solution principale pour Visual Studio 2026
- `BikeVoyageur.sln` : solution CLI/CI .NET uniquement
  - Le frontend est exposé dans `BikeVoyageur.slnx` via un projet de contenu (`frontend/BikeVoyageur.Frontend.csproj`)

## Démarrage local

```powershell
./scripts/dev-up
```

Arrêt :

```powershell
./scripts/dev-down
```

## Démarrage “F5” avec Visual Studio 2026

Prérequis :
- .NET SDK 10.x
- Node.js 20+ et npm
- Docker Desktop si vous ajoutez des dépendances en conteneur (ex: Valhalla)
- `npm install` déjà exécuté dans `frontend/` (au moins une fois)
- Les variables Aspire autorisent le transport non sécurisé en local

Étapes :
1. Ouvrir `BikeVoyageur.slnx` à la racine
2. Définir `BikeVoyager.AppHost` comme projet de démarrage (une seule fois)
3. Appuyer sur `F5`

Comportement :
- L’API démarre en HTTPS (par défaut `https://localhost:7144`)
- Le frontend Vite démarre sur un port libre entre `http://localhost:5173` et `http://localhost:5190`
- Le navigateur s’ouvre automatiquement sur l’URL sélectionnée (déclenché par l’AppHost)
- Les requêtes `/api` sont proxifiées vers l’API (pas de CORS)
- Le frontend est lancé par l’AppHost (processus externe)
- Le transport OTLP non sécurisé est autorisé en local (`ASPIRE_ALLOW_UNSECURED_TRANSPORT=true`)
- Le dashboard Aspire reste accessible sur `https://localhost:17000` si besoin (non ouvert automatiquement)

## Démarrage via Aspire en CLI

```powershell
dotnet run --project backend/src/BikeVoyager.AppHost/BikeVoyager.AppHost.csproj
```

Ce lancement démarre l’API et le frontend (via `AddExecutable`).

## Dépendances Docker (Valhalla)

Le dépôt ne contient pas encore de `docker-compose` dans `/infra`.  
Si vous ajoutez Valhalla, documentez le compose dans `/infra` et démarrez-le avant le F5 :

```powershell
docker compose -f infra/valhalla.compose.yml up -d
```

## Tests et qualité

```powershell
./scripts/dev-test
```

Ce script exécute :
- `dotnet test` sur la solution racine
- `npm run lint`, `npm run test`, `npm run build` sur le frontend

## Audits de sécurité et dépendances

```powershell
./scripts/dev-audit
```

Ce script lance :
- `dotnet list package --vulnerable --include-transitive`
- `dotnet list package --outdated`
- `npm audit`
- `npm outdated`

## Observabilité

- Les logs API sont au format JSON (Serilog).
- Le header `X-Correlation-Id` est généré si absent, et propagé en réponse.
- Les erreurs utilisent `ProblemDetails` et exposent le `correlationId`.

## OpenAPI / Swagger

En environnement de développement, l’API expose Swagger UI :

- URL par défaut : `/swagger`

## Dépannage

- Vérifier les versions de SDK Node/.NET.
- Si le navigateur s’ouvre trop vite, relancer la page après quelques secondes.
- Si `http://localhost:5173` est occupé, Vite choisit un port libre jusqu’à `5190` (voir la ligne “Frontend détecté sur ...”).
- Si l’API HTTPS n’est pas disponible, exécuter `dotnet dev-certs https --trust`.
- Si un port est occupé, arrêter les processus (`./scripts/dev-down`) et relancer.
