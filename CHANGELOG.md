# Changelog

Historique public des évolutions notables du projet.

## Unreleased

- Aucun changement publié.

## 2026-02-xx

### Refactors majeurs

- Découpage massif du frontend en modules par domaine (`routing`, `map`, `cloud`, `data`, `ui`) pour réduire les fichiers monolithiques.
- Découpage backend par responsabilité (bootstrap API, endpoints par feature, services dédiés).
- Passage au contrat API canonique `/api/v1/*` et suppression du mode legacy `/api/*`.

### Sécurité

- Durcissement HTTP hors `Development` (`HSTS`, `security headers`).
- Renforcement anti-abus API (garde d'origine, session anonyme, rate limiting).
- Durcissement de la partition rate limiting contre le spoofing `X-Forwarded-For`.

### Infra reproductible

- Épinglage de l'image Valhalla par digest et procédure documentée de mise à jour.
- Mesure LOC rendue reproductible et alignée avec la CI.
- Chaîne qualité unifiée backend/frontend (tests + audits) maintenue en continu.
