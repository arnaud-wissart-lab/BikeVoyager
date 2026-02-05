# DECISIONS

## 2026-02-05 — Socle technique

- Backend en .NET 10 (LTS) avec Minimal API et OpenAPI/Swagger.
- Architecture propre : `Api -> Application -> Infrastructure -> Domain`.
- Serilog en JSON + `X-Correlation-Id` + `ProblemDetails`.
- Validation des DTO via FluentValidation et endpoint filters.
- HttpClientFactory avec Polly (retry/circuit breaker léger) et timeouts.

## 2026-02-05 — Frontend

- Stack : React + TypeScript + Vite + Mantine.
- i18n via `react-i18next` (FR par défaut, switch FR/EN).
- Thème clair/sombre, palette sobre et neutre.
- Mobile-first avec drawer/bottom-sheet pour actions rapides.

## 2026-02-05 — Qualité

- Tests unitaires + tests API (xUnit).
- Tests front via Vitest + Testing Library.
- Lint/format côté front (ESLint + Prettier).
- Outil `dotnet-format` ajouté en tool manifest.

## 2026-02-05 — Orchestration F5 (Visual Studio)

- Choix : .NET Aspire AppHost pour l’orchestration “un clic” (F5).
- Le frontend Vite est lancé par l’AppHost via `AddExecutable` (pas de dépendance au SDK JavaScript VS).
- Le proxy Vite route `/api` vers l’API HTTPS par défaut.
- Pas de projet ServiceDefaults pour l’instant afin de limiter les changements backend.
- Variables OTLP Aspire configurées pour éviter l’erreur du dashboard.
- Frontend visible dans la solution via un projet .NET “contenu” sans build.
