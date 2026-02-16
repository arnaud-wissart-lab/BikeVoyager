# AGENTS.md — Working agreements

## Objectif
Faire de ce dépôt une vitrine GitHub : code propre, auditable, docs impeccables.

## Langue
- Commentaires et documentation destinés aux humains : FRANÇAIS.
- Anglais accepté uniquement pour termes techniques incontournables.

## Qualité / Architecture
- Respect SOLID / DRY / KISS.
- Éviter les fichiers monolithiques : backend cible < 400 LOC ; frontend cible < 600 LOC (sauf exception justifiée).
- Pas de sur-design : design patterns uniquement si bénéfice clair.

## Changement management
- PRs petites et atomiques (1 thème par PR).
- Ne pas lancer de reformat global sans justification.

## Tests (obligatoire)
- Backend : `dotnet test BikeVoyager.sln`
- Frontend : `npm test` (et E2E si touché)
- Toute refacto structurelle doit être sécurisée par des tests.

## Livraison
- Pour chaque PR : résumé + liste fichiers modifiés + raisons + risques + plan de rollback si pertinent.
