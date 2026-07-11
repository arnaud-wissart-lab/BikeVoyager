# Changelog

Historique public des évolutions notables du projet.

## Unreleased

- Aucun changement depuis la version 0.2.0.

## 0.2.0 - 2026-07-11

### Ajouté

- Comparaison détaillée des itinéraires et affichage de l’alternative sur la carte.
- Carnet de trajets avec duplication, édition, import/export BikeVoyager et export GPX.
- Préréglages de profils vélo et VAE.
- Feuille de route détaillée.
- Guidage actif et guidage vocal optionnel.
- Maintien de l’écran allumé pendant la navigation.
- Détection de sortie d’itinéraire.
- Recalcul manuel et recalcul automatique optionnel.

### Amélioré

- Affichage cohérent de la prochaine manœuvre et de sa distance.
- Gestion des instructions manquantes dans la feuille de route et le guidage.
- Navigation GPS plus autonome sur téléphone.
- Persistance des nouvelles préférences de navigation.
- Comparaison plus lisible avant application d’un trajet alternatif.

### Corrigé

- Ignorance des résultats de recalcul devenus obsolètes après un changement de trajet ou de session.
- Conservation de l’ancien trajet après un échec de recalcul.
- Stabilisation de l’identité d’une sortie d’itinéraire dans la zone d’hystérésis GPS.
- Correction de la distance annoncée avant une manœuvre séparée par des segments sans instruction.
- Prévention des doubles appels de Wake Lock et de recalcul automatique.

### Technique

- Extension des tests frontend de navigation, simulation, GPS, voix et préférences.
- Aucun changement de contrat API pour les nouvelles fonctions de navigation.
- Version frontend portée à `0.2.0`.

## 0.1.0 - 2026-07-08

### Ajouté

- Affichage discret de la version BikeVoyager dans l’écran Aide et à propos.
- Modale “Nouveautés” accessible depuis l’interface, avec des notes de version orientées utilisateur.
- Street View au clic droit sur la carte.
- Profil d’altitude avec D+, D-, pente maximale et difficulté vélo/VAE.
- Filtres POI avancés avec sauvegarde des préférences.

### Amélioré

- Détails POI plus lisibles, avec les informations utiles mieux mises en avant.
- Base de version applicative centralisée côté frontend pour préparer les prochaines notes de version.

### Corrigé

- Désélection des POI qui ne sont plus visibles après application des filtres avancés.

### Technique

- Version frontend initialisée à `0.1.0`.
- Injection de la version frontend au build depuis `frontend/package.json`.
- Notes de version utilisateur structurées et typées côté frontend.

## 2026-02-17

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
