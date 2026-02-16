# Roadmap BikeVoyager

Source : `docs/AUDIT_TECHNIQUE.md` (etat courant du depot au 2026-02-16).
Objectif : renforcer la vitrine GitHub sans changement fonctionnel.

## P0 - Priorites immediates

- Ajouter `LICENSE` (choix explicite de licence open-source).
- Ajouter `CODE_OF_CONDUCT.md`.
- Ajouter les headers de securite API (au minimum HSTS en production, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`) et documenter la politique retenue.
- Uniformiser la strategie de versionnement des routes API (`/api/v1/*` vs `/api/*`) et aligner la documentation.

Definition of done P0 :
- Fichiers OSS critiques presents a la racine.
- Politique de securite HTTP appliquee et testee.
- Strategie de versionnement API unique et documentee.
- Aucun changement de comportement metier.

## P1 - Refactor frontend (sans changement fonctionnel)

- Decouper les hotspots frontend restants :
  - `frontend/src/i18n.ts`
  - `frontend/src/features/routing/domain.ts`
  - `frontend/src/ui/pages/MapPage.tsx`
  - `frontend/src/components/CesiumRouteMap.tsx`
- Continuer le decoupage des controllers volumineux (`useDataController`, `useRoutingController`, `useMapController`).
- Externaliser les traductions dans des fichiers JSON (`locales/fr.json`, `locales/en.json`) avec un loader.

Definition of done P1 :
- Fichiers hotspots reduits en taille et responsabilites.
- Couverture de tests maintenue ou amelioree.
- Comportement utilisateur strictement identique.

## P2 - Vitrine GitHub et documentation

- Ajouter badges CI/coverage/license dans le README.
- Ajouter docs de reference (`docs/ARCHITECTURE.md`, `docs/API.md`) avec exemples.
- Ajouter captures ecran et un GIF court de parcours utilisateur.
- Evaluer l'ajout de fichiers de reproductibilite (`global.json`, `.nvmrc`).

Definition of done P2 :
- Onboarding contributeur plus rapide.
- Decisions techniques et architecture lisibles sans contexte oral.
- README orientee vitrine avec preuves (badges + captures + docs).
