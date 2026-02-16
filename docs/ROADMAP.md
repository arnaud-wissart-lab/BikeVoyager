# Roadmap BikeVoyager

Source : `docs/AUDIT_TECHNIQUE.md` (synthese des priorites niveau 0/1/2).
Objectif : renforcer la vitrine GitHub sans changement fonctionnel.

## P0 - Quick wins (court terme)
- Corriger `scripts/dev-test` et `scripts/dev-audit` pour utiliser `BikeVoyager.sln`.
- Remplacer les informations personnelles de configuration email par un placeholder et documenter la configuration via variables d'environnement / user-secrets.
- Aligner la documentation avec le choix de port Vite/AppHost (`5173` strict) ou expliciter un autre choix coherent.
- Remplacer les commentaires restants en anglais destines aux humains par une version francaise.

Definition of done P0 :
- Scripts de dev valides localement.
- Plus de donnees personnelles dans la configuration versionnee.
- Documentation et comportement reels alignes.
- Aucun changement de comportement applicatif.

## P1 - Refactor structurel (sans changement fonctionnel)

Backend :
- Decouper `backend/src/BikeVoyager.Api/Program.cs` par feature/endpoints.
- Decouper `backend/src/BikeVoyager.Api/Cloud/CloudSyncEndpoints.cs` (endpoints, services, DTO, helpers).
- Decouper `backend/src/BikeVoyager.Infrastructure/Pois/OverpassPoiService.cs` (query, mapping, geometrie, deduplication, cache).
- Uniformiser la strategie de versionnement des routes API (`/api/v1/*` vs `/api/*`).
- Uniformiser les payloads d'erreur autour de `ProblemDetails`.

Frontend :
- Decouper `frontend/src/App.tsx` en modules (state/orchestration, UI, services).
- Extraire des hooks dans `frontend/src/components/CesiumRouteMap.tsx`.
- Externaliser les traductions dans des fichiers JSON (`locales/fr.json`, `locales/en.json`).

Definition of done P1 :
- Fichiers hotspots reduits en taille et responsabilites.
- Couverture de tests maintenue ou amelioree.
- Comportement utilisateur strictement identique.

## P2 - Vitrine GitHub et gouvernance
- Ajouter `LICENSE`, `CODE_OF_CONDUCT.md`, `SECURITY.md`.
- Ajouter badges CI/coverage/license dans le README.
- Ajouter fichiers de reproductibilite (`global.json`, `.nvmrc`) et conventions build/style (`Directory.Build.props`, `.editorconfig`).
- Ajouter docs de reference (`docs/ARCHITECTURE.md`, `docs/API.md`) avec exemples.
- Ajouter captures ecran et un GIF court de parcours utilisateur.

Definition of done P2 :
- Onboarding contributeur plus rapide.
- Decisions techniques et architecture lisibles sans contexte oral.
- README orientee vitrine avec preuves (badges + captures + docs).
