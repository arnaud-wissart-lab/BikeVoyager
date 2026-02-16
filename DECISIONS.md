# DECISIONS

Registre ADR court : decisions d'architecture uniquement.

## ADR-0001 - Architecture backend en couches
- Date : 2026-02-05
- Statut : Acceptee
- Decision : backend en .NET 10 Minimal API avec separation `Api -> Application -> Infrastructure -> Domain`.
- Consequences : frontieres claires, testabilite amelioree, evolution par couche simplifiee.

## ADR-0002 - Architecture frontend React TypeScript
- Date : 2026-02-05
- Statut : Acceptee
- Decision : frontend en React + TypeScript + Vite + Mantine, organise par domaines (`features/*`, `ui/*`, `app/*`).
- Consequences : socle moderne, build rapide, separation UI/orchestration plus lisible.

## ADR-0003 - Versioning API canonique en /api/v1
- Date : 2026-02-16
- Statut : Acceptee
- Decision : tous les endpoints publics sont exposes en `/api/v1/*`; un rewrite legacy `/api/*` reste temporairement actif.
- Consequences : contrat API explicite, migration client progressive, retrait du rewrite a planifier.

## ADR-0004 - Pipeline qualite et CI obligatoires
- Date : 2026-02-05
- Statut : Acceptee
- Decision : CI GitHub unique backend/frontend avec lint, build, tests unitaires/API, E2E et audit de dependances.
- Consequences : regression detectee plus tot, niveau de qualite verifiable en continu.

## ADR-0005 - Orchestration locale via AppHost
- Date : 2026-02-05
- Statut : Acceptee
- Decision : usage de .NET Aspire AppHost pour l'orchestration locale (API + frontend Vite) sans ajouter de stack d'orchestration externe.
- Consequences : demarrage local coherent, complexite d'outillage limitee.
