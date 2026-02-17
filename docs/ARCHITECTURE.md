# Architecture BikeVoyager

## Vue système

BikeVoyager repose sur un frontend `React + TypeScript` et une API `ASP.NET Core (.NET 10)` exposée en `/api/v1/*`.
Le frontend gère l'interface et envoie les requêtes à l'API.  
L'API porte les règles métier, la sécurité, la résilience réseau et les intégrations externes.

Les services tiers sont appelés uniquement côté backend:
- `Valhalla` pour le routage vélo;
- `Overpass` pour la recherche de POI et données cartographiques;
- fournisseurs cloud (Google Drive / OneDrive) pour la sauvegarde et la restauration.

## Diagramme simplifié

```text
+-----------------------------+
| Frontend Web (React / Vite) |
| UI + appels HTTP /api/v1/*  |
+--------------+--------------+
               |
               v
+-----------------------------+
| API BikeVoyager (.NET 10)   |
| Cas d'usage + sécurité      |
| + intégrations externes     |
+-----+----------+------------+
      |          | 
      v          v           v
+-----------+ +-----------+ +------------------+
| Valhalla  | | Overpass  | | Cloud Providers  |
| Routing   | | POI/Data  | | Google/Microsoft |
+-----------+ +-----------+ +------------------+
```

## Flux principaux

1. Calcul d'itinéraire: `Frontend -> API -> Valhalla -> API -> Frontend`.
2. Recherche de points d'intérêt: `Frontend -> API -> Overpass -> API -> Frontend`.
3. Sauvegarde cloud: `Frontend -> API -> Provider Cloud -> API -> Frontend`.

## Liens utiles

- Décisions d'architecture (ADR): [DECISIONS.md](../DECISIONS.md)
- Contrat HTTP: [API.md](./API.md)
