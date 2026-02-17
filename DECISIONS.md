# DECISIONS

Registre ADR court : décisions d'architecture uniquement.
Ce fichier ne contient ni hotspots, ni backlog, ni plan d'exécution.

## ADR-0001 - Architecture backend en couches
- Date : 2026-02-05
- Statut : Acceptée
- Contexte : besoin d'un backend évolutif avec frontières explicites entre contrat HTTP, cas d'usage et intégrations externes.
- Decision : backend en .NET 10 Minimal API avec séparation `Api -> Application -> Infrastructure -> Domain`.
- Conséquences : frontières claires, testabilité améliorée, évolution par couche simplifiée.

## ADR-0002 - Architecture frontend React TypeScript
- Date : 2026-02-05
- Statut : Acceptée
- Contexte : besoin d'un frontend moderne, rapide à builder et découpable par responsabilité fonctionnelle.
- Decision : frontend en React + TypeScript + Vite + Mantine, organisé par domaines (`features/*`, `ui/*`, `app/*`).
- Conséquences : socle moderne, build rapide, séparation UI/orchestration plus lisible.

## ADR-0003 - Versioning API canonique en /api/v1
- Date : 2026-02-16
- Statut : Acceptée
- Contexte : besoin d'un contrat API versionné et stable sans préfixe non versionné.
- Decision : tous les endpoints publics sont exposés en `/api/v1/*` uniquement. Le support du préfixe non versionné `/api` a été supprimé le 2026-02-17.
- Conséquences : contrat API explicite, surface HTTP simplifiée, suppression du middleware de rewrite legacy.

## ADR-0004 - Pipeline qualité et CI obligatoires
- Date : 2026-02-05
- Statut : Acceptée
- Contexte : besoin d'un gate qualité unique pour limiter les régressions backend/frontend.
- Decision : CI GitHub unique backend/frontend avec lint, build, tests unitaires/API, E2E et audit de dépendances.
- Conséquences : régression détectée plus tôt, niveau de qualité vérifiable en continu.

## ADR-0005 - Orchestration locale via AppHost
- Date : 2026-02-05
- Statut : Acceptée
- Contexte : besoin d'un démarrage local cohérent API + frontend sans introduire une stack d'orchestration supplémentaire.
- Decision : usage de .NET Aspire AppHost pour l'orchestration locale (API + frontend Vite) sans ajouter de stack d'orchestration externe.
- Conséquences : démarrage local cohérent, complexité d'outillage limitée.

## ADR-0006 - Resilience HTTP via Microsoft.Extensions.Http.Resilience
- Date : 2026-02-16
- Statut : Acceptée
- Contexte : les packages `Microsoft.Extensions.Http.Polly` et `Polly.Extensions.Http` sont dépréciées et l'enregistrement HttpClientFactory doit rester équivalent (retry/circuit-breaker + timeouts existants).
- Decision : migration vers `Microsoft.Extensions.Http.Resilience` avec `AddResilienceHandler` personnalisé :
  retry lineaire (3 tentatives, 200 ms), circuit-breaker (seuil 5, pause 15 s), retry exponentiel spécifique Valhalla (4 tentatives, base 2 s). Les timeouts restent portés par `HttpClient.Timeout` déjà configuré par client.
- Conséquences : suppression des dépendances dépréciées, pipeline de résilience aligné sur l'API .NET moderne, comportement conservé sans changement de flux métier.
