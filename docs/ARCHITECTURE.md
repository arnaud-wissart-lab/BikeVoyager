# Architecture BikeVoyager

## Vue d'ensemble

BikeVoyager est un monorepo avec un frontend `React + TypeScript` et une API `ASP.NET Core (.NET 10)` versionnée en `/api/v1/*`. Le frontend orchestre l'expérience utilisateur (planification, carte, données cloud) et délègue les calculs et intégrations externes à l'API.

Le backend suit une séparation en couches (`Api -> Application -> Infrastructure -> Domain`) pour garder un contrat HTTP lisible, une logique métier testable et des adaptateurs externes isolés. Cette structure facilite les évolutions sans propager les changements techniques jusqu'au domaine.

Les appels vers les services tiers (routage, POI, sync cloud) passent uniquement par l'API. Le frontend ne parle pas directement à Valhalla, Overpass ou aux fournisseurs cloud, ce qui centralise la sécurité, la résilience réseau et les règles métier.

## Diagramme (C4-lite)

```text
+---------------------------+
| Frontend Web (React/Vite) |
| - UI/UX                   |
| - appels HTTP /api/v1/*   |
+-------------+-------------+
              |
              v
+---------------------------+
| API BikeVoyager (.NET 10) |
| - Endpoints versionnés    |
| - Cas d'usage             |
| - Sécurité + résilience   |
+------+------+-------------+
       |      |
       |      +------------------------------+
       |                                     |
       v                                     v
+--------------+                     +-------------------+
| Valhalla     |                     | Overpass          |
| (routing)    |                     | (POI/geodata)     |
+--------------+                     +-------------------+
              \
               \
                v
         +-------------------+
         | Cloud Providers   |
         | (Google/Microsoft)|
         +-------------------+
```

## Décisions clés

- Backend en couches: [ADR-0001](../DECISIONS.md#adr-0001---architecture-backend-en-couches)
- Frontend par domaines fonctionnels: [ADR-0002](../DECISIONS.md#adr-0002---architecture-frontend-react-typescript)
- API canonique versionnée `/api/v1/*`: [ADR-0003](../DECISIONS.md#adr-0003---versioning-api-canonique-en-apiv1)
- Orchestration locale via AppHost: [ADR-0005](../DECISIONS.md#adr-0005---orchestration-locale-via-apphost)
- Résilience HTTP standardisée: [ADR-0006](../DECISIONS.md#adr-0006---resilience-http-via-microsoftextensionshttpresilience)
