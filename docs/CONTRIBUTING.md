# Contribuer a BikeVoyager

## Objectif
Ce depot vise une vitrine GitHub : code propre, auditable et documentation claire.

## Regles de reference
- `AGENTS.md` fait foi pour les regles de contribution.
- Commentaires et documentation destines aux humains : francais.
- PRs petites et atomiques : un seul theme par PR.
- Pas de reformat global sans justification explicite.
- Pas de changement de comportement applicatif dans une PR de documentation.

## Workflow recommande
1. Creer une branche ciblee sur un seul objectif.
2. Limiter les changements au perimetre de la PR.
3. Ajouter ou mettre a jour les tests si une refacto structurelle est introduite.
4. Verifier localement les commandes de validation avant ouverture de PR.

## Validation minimale avant PR
- Backend : `dotnet test BikeVoyager.sln`
- Frontend : `npm test` (et `npm run e2e` si la zone frontend touchee le justifie)
- Si la CI frontend est impactee : `npm run lint` et `npm run build`

## Contenu attendu dans chaque PR
- Resume
- Liste des fichiers modifies
- Raisons des changements
- Risques identifies
- Plan de rollback (si pertinent)

## Documentation projet
- `DECISIONS.md` (racine) : registre ADR court et decisions d'architecture.
- `docs/ROADMAP.md` : priorites P0 / P1 / P2.

