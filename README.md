# BikeVoyager (mono-repo)

BikeVoyager est un mono-repo “from scratch” qui regroupe un backend .NET 10 (LTS) et un frontend React moderne. L’objectif est une base pro, auditable et testée, prête à évoluer.

## Structure

- `backend/` : projets .NET 10
  - `src/` : API + couches Application/Domain/Infrastructure
  - `tests/` : tests unitaires et API
- `frontend/` : React + TypeScript + Vite + Mantine
- `infra/` : réservé pour l’infrastructure (Docker, IaC)
- `scripts/` : scripts de dev/test/audit
- `docs/` : documentation complémentaire

## Solution unique

- Solution principale : `BikeVoyageur.slnx` (racine, Visual Studio 2026)
- Solution optionnelle : `BikeVoyageur.sln` (racine, CLI/CI .NET uniquement)
  - Le frontend est visible dans la solution via un projet de contenu (`frontend/BikeVoyageur.Frontend.csproj`)

## Prérequis

- .NET SDK 10.x
- Node.js 20+ et npm

## Démarrage rapide

Backend :

```powershell
dotnet run --project backend/src/BikeVoyager.Api/BikeVoyager.Api.csproj
```

Frontend :

```powershell
cd frontend
npm install
npm run dev
```

Script combiné :

```powershell
./scripts/dev-up
```

## Démarrage “F5” avec Visual Studio 2026

- Ouvrir `BikeVoyageur.slnx` à la racine
- Définir `BikeVoyager.AppHost` comme projet de démarrage (une seule fois)
- Appuyer sur `F5`
- Première exécution : `npm install` dans `frontend/`

Résultat attendu :
- API démarrée en HTTPS
- Vite démarré
- Navigateur ouvert sur un port libre entre `http://localhost:5173` et `http://localhost:5190`
- Frontend lancé par l’AppHost
- Dashboard Aspire disponible sur `https://localhost:17000` (optionnel)

## Fonctionnalités clés

- API Minimal + OpenAPI/Swagger
- Logs JSON Serilog avec `X-Correlation-Id`
- `ProblemDetails` pour les erreurs
- Validation DTO via FluentValidation + Endpoint Filters
- HttpClientFactory avec timeout + Polly (retry/circuit breaker)
- Front mobile-first, i18n FR/EN (FR par défaut), thème clair/sombre

## Tests

```powershell
./scripts/dev-test
```

## Audits de sécurité et dépendances

```powershell
./scripts/dev-audit
```
