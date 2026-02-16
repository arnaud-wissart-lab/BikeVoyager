# PWA BikeVoyager

Documentation de référence : français en priorité.

## Objectif

Rendre BikeVoyager installable comme application locale via `vite-plugin-pwa`,
sans dégrader l’usage cartographique.

## Implémentation

- manifest et service worker générés côté Vite
- enregistrement du service worker dans `frontend/src/main.tsx`
- icônes dans `frontend/public/pwa-192.png` et `frontend/public/pwa-512.png`

## Politique de cache

- cache applicatif pour les assets statiques du front
- pas de mise en cache des tuiles OpenStreetMap pour éviter un volume disque excessif et des données périmées

## Vérification locale

1. `cd frontend`
2. `npm install`
3. `npm run build`
4. `npm run preview`
5. Ouvrir l’URL de preview et vérifier la proposition d’installation du navigateur

## Installation iOS

Safari > Partager > Sur l’écran d’accueil.

## Invite d’installation

Le composant `frontend/src/components/InstallPrompt.tsx` affiche une popin FR/EN.
Il fournit une instruction iOS spécifique lorsque `beforeinstallprompt` n’est pas disponible.

## English quick note

French is the primary documentation language. PWA install is enabled, but OSM map tiles are intentionally excluded from cache.
