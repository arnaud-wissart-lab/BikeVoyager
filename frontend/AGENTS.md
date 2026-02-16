## Frontend working agreements
- Aucun fichier React/TS ne doit dépasser 600 lignes (sauf exception justifiée dans docs/DECISIONS.md).
- Interdit de déplacer un monolithe vers un nouveau monolithe.
- Préférer extraction en hooks (use*Controller) + composants UI petits.
- Tests obligatoires: npm test, et Playwright si présent.