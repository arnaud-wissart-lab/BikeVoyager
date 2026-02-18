# Contribuer à BikeVoyager

## Objectif
Ce dépôt vise une base propre, auditable, maintenable et reproductible.

## Conventions de travail
- Ce document centralise les règles de contribution (générales et frontend).
- Elles s'appliquent à toutes les contributions, quel que soit leur auteur.
- En cas de divergence, la règle la plus spécifique au périmètre modifié prévaut.
- Les changements doivent rester atomiques, justifiés et faciles à auditer.
- Les validations de tests restent obligatoires avant ouverture de PR.

## Règles générales
- 400 LOC = seuil d'analyse/alerte (hotspot) utilisé par l'audit LOC (`--threshold 400`).
- Règle de contribution : viser < 400 LOC par fichier ; en frontend React/TS, la limite exceptionnelle est 600 LOC avec ADR dans `DECISIONS.md`.
- Commentaires et documentation destinés aux humains : français.
- PRs petites et atomiques : un seul thème par PR.
- Pas de reformat global sans justification explicite.
- Respect SOLID / DRY / KISS ; pas de sur-design sans bénéfice clair.
- Pas de changement de comportement applicatif dans une PR de documentation.

## Règles frontend spécifiques
- Frontend React/TS : >= 400 LOC = hotspot à traiter ; > 600 LOC interdit sans exception ADR dans `DECISIONS.md`.
- Interdit de déplacer un monolithe vers un nouveau monolithe.
- Préférer l’extraction en hooks (`use*Controller`) et petits composants UI.
- Tests frontend obligatoires : `npm test` et Playwright si présent.

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

