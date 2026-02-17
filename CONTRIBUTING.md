# Contribuer à BikeVoyager

## Objectif
Ce dépôt vise une base propre, auditable, maintenable et reproductible.

## Working agreements
- Les règles de contribution sont définies dans `AGENTS.md` et `frontend/AGENTS.md`.
- Elles s'appliquent à toutes les PRs humaines et aux agents IA (Codex).
- En cas de divergence, la règle la plus spécifique au périmètre modifié prévaut.
- Les changements doivent rester atomiques, justifiés et faciles à auditer.
- Les validations de tests restent obligatoires avant ouverture de PR.

## Règles de référence
- `AGENTS.md` fait foi pour les règles de contribution.
- Seuils de taille cibles : backend < 400 LOC ; frontend < 600 LOC.
- Toute exception à ces seuils doit être justifiée dans `DECISIONS.md` (ADR).
- Commentaires et documentation destinés aux humains : français.
- PRs petites et atomiques : un seul thème par PR.
- Pas de reformat global sans justification explicite.
- Pas de changement de comportement applicatif dans une PR de documentation.

## Workflow recommandé
1. Créer une branche ciblée sur un seul objectif.
2. Limiter les changements au périmètre de la PR.
3. Ajouter ou mettre à jour les tests si une refacto structurelle est introduite.
4. Vérifier localement les commandes de validation avant ouverture de PR.

## Validation minimale avant PR
- Backend : `dotnet test BikeVoyager.sln`
- Frontend : `npm test` (et `npm run e2e` si la zone frontend touchée le justifie)
- Si la CI frontend est impactée : `npm run lint` et `npm run build`
- Mesure LOC (source de vérité) : `pwsh scripts/loc.ps1 --top 30 --threshold 400 --scope backend/frontend/docs --out docs/LOC_REPORT.md`
- Alternative bash équivalente : `./scripts/loc.sh --top 30 --threshold 400 --scope backend/frontend/docs --out docs/LOC_REPORT.md`
- Patterns par défaut (si aucun pattern explicite): `*.cs`, `*.ts`, `*.tsx`, `*.md` (surcharge possible en passant des patterns en arguments)

## Contenu attendu dans chaque PR
- Résumé
- Liste des fichiers modifiés
- Raisons des changements
- Risques identifiés
- Plan de rollback (si pertinent)

## Documentation projet
- `DECISIONS.md` (racine) : registre ADR court et décisions d'architecture.
- `docs/ROADMAP.md` : priorités P0 / P1 / P2.

