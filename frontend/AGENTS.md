## Règles frontend

- Ce fichier complète `../AGENTS.md` (règle racine prioritaire).
- Aucun fichier React/TS ne doit dépasser 600 lignes (sauf exception justifiée dans `../DECISIONS.md`).
- Interdit de déplacer un monolithe vers un nouveau monolithe.
- Préférer l’extraction en hooks (`use*Controller`) et petits composants UI.
- Tests obligatoires : `npm test` et Playwright si présent.
