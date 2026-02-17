# Frontend BikeVoyager

Documentation de référence : français en priorité.

## Stack

- `React 19`
- `TypeScript`
- `Vite`
- `Mantine`
- `Cesium`
- `i18next` (FR par défaut, EN disponible)
- `vite-plugin-pwa`

## Démarrage local

```powershell
cd frontend
npm install
npm run dev
```

Le frontend s’attend à une API disponible sur `/api` (proxy Vite/AppHost).

## Scripts npm

- `npm run dev` : développement local
- `npm run build` : build de production
- `npm run test` : tests Vitest
- `npm run e2e` : tests E2E Playwright (desktop + mobile)
- `npm run e2e:ui` : exécution E2E en mode interactif
- `npm run lint` : lint ESLint
- `npm run format` : vérification Prettier
- `npm run preview` : preview du build

## Fonctionnalités UI principales

- planification d’itinéraire et boucle (`/api/route`, `/api/loop`)
- recherche de lieux
- vue carte Cesium
- onglet Données (sauvegardes locales, export/import, sync cloud)
- onglet Aide avec diagnostic Valhalla

## Cohérence UI

Le frontend repose sur un thème Mantine centralisé dans `src/theme.ts`:

- palette sobre gris/bleu/vert homogène entre clair/sombre
- typographie unifiée (IBM Plex Sans, échelle de tailles et interlignes)
- composants cohérents par défaut (`Button`, `ActionIcon`, `SegmentedControl`,
  `TextInput`, `NumberInput`, `Checkbox`, `Paper`, `Badge`, `Slider`)
- hiérarchie d’actions: actions principales en `sm`, micro-actions en `xs`
- constantes techniques centralisées (endpoints API) dans
  `src/features/app/apiPaths.ts` pour éviter les chaînes dupliquées

Audit détaillé de la passe UI: `../docs/AUDIT_TECHNIQUE.md` (section "Historique UI consolidé").

## E2E (Playwright)

Les scénarios E2E sont dans `e2e/` et mockent les endpoints `/api/*` dans le
navigateur pour rester déterministes (pas de backend requis pour ces tests).

Prérequis (une seule fois):

```powershell
npx playwright install chromium
```

Exécution:

```powershell
npm run e2e
```

Couverture actuelle:

- non-dépassement horizontal du menu bas mobile
- cohérence de l’écran Aide (cache distribué + heure serveur, sans backend/fallback)
- parcours complet desktop (planifier -> calcul -> carte)

## Session API anonyme

- aucun login/mot de passe n'est requis pour l'utilisateur final
- l'API crée en silence un cookie de session anonyme HttpOnly sur `/api/*`
- le frontend n'envoie plus de header `X-Session-Id`
- ce mécanisme renforce l'anti-abus, mais ne remplace pas une authentification forte

## Configuration OAuth cloud

Pour activer la synchronisation OneDrive/Google Drive depuis l’onglet `Donnees`,
configurer les variables d’environnement de l’API (backend):

```powershell
$env:CloudSync__GoogleDrive__ClientId="..."
$env:CloudSync__GoogleDrive__ClientSecret="..." # requis si l'app OAuth est confidentielle
$env:CloudSync__OneDrive__ClientId="..."
$env:CloudSync__OneDrive__ClientSecret="..."   # requis pour une app Entra Web
npm run dev
```

Redirect URI recommandée (Google + Microsoft): `http://localhost:5173/`

Les sessions cloud OAuth sont stockées côté API (cookie HttpOnly + cache distribué Redis).

Scopes utilisés:

- Google Drive: `openid email profile https://www.googleapis.com/auth/drive.file`
- OneDrive (Microsoft Graph): `offline_access Files.ReadWrite User.Read`

## Mises à jour Valhalla dans le front

L’onglet Aide affiche :

- état Valhalla (`ready` / `not_ready`)
- progression de build si une mise à jour est en cours
- indicateur “mise à jour OSM disponible”
- bouton de lancement manuel de la mise à jour

Quand une mise à jour est lancée, le backend construit en arrière-plan une release candidate, puis bascule vers `live` une fois terminée.

## PWA

Voir `../README.md` (section "PWA") pour la stratégie d’installation et de cache.

## English quick note

Primary docs are in French. The Help tab shows Valhalla status and lets users start updates manually.
