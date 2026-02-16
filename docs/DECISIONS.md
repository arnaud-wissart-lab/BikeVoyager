# Registre de decisions (ADR)

## Objectif
Tracer les decisions techniques importantes, leur contexte et leurs consequences.

## Quand creer un ADR
- Changement d'architecture ou de convention transverse.
- Choix technique avec impact long terme (maintenance, securite, cout, performance).
- Abandon ou remplacement d'une decision precedente.

## Statuts utilises
- `Propose`
- `Accepte`
- `Remplace`
- `Abandonne`

## Template ADR court
```md
# ADR-000X - Titre court

- Date : YYYY-MM-DD
- Statut : Propose | Accepte | Remplace | Abandonne
- Portee : backend | frontend | infra | transverse
- References : PR / issue / document

## Contexte
Contexte factuel et probleme a resoudre.

## Decision
Decision retenue et perimetre exact.

## Consequences
- Positives :
- Negatives :
- Suivi necessaire :

## Alternatives evaluees
1. Option A - pourquoi non retenue
2. Option B - pourquoi non retenue
```

## Index ADR
- Historique initial : `DECISIONS.md` (racine du depot)
- Nouveaux ADR : a ajouter ici au fil de l'eau

# ADR-0001 - Demantelement de AppContainerScreen

- Date : 2026-02-16
- Statut : Accepte
- Portee : frontend
- References : refacto shell/app root

## Contexte
`frontend/src/ui/shell/AppContainerScreen.tsx` concentrait environ 4550 lignes avec des responsabilites melangees :
- routing : orchestration route/loop, alternatives, erreurs API, export GPX, feedback, statut Valhalla.
- pois : chargement POI, filtres categories, panel detours, refresh.
- cloud : OAuth, sync backup, restore, diagnostics, auto-backup.
- data : address book, saved trips, import/export, backup local, preferences.
- map : orchestration map, navigation simulation/GPS, alertes POI, formatages metriques.
- shell : AppShell, navigation desktop/mobile, theme/langue.
- modals : decision de restauration cloud + install prompt.

Ce couplage empechait la lecture et augmentait le risque de regression.

## Decision
Extraction en modules par feature avec frontieres explicites :
- `app/AppRoot.tsx` : point d'assemblage des controllers/pages/shell.
- `ui/shell/ShellLayout.tsx` : layout + navigation uniquement.
- `ui/shell/ShellModals.tsx` : orchestration des modales shell.
- `state/appStore.ts` : etat central React (useState/useRef) partage.
- `features/routing/*` : appels API route/loop/valhalla + orchestration de planification.
- `features/pois/*` : appels POI + orchestration de chargement/filtres.
- `features/cloud/*` : orchestration cloud OAuth/sync/restore.
- `features/data/*` : orchestration import/export/address-book/saved-trips.
- `features/map/*` : orchestration map/navigation/formatage metriques.

Dependances retenues :
- `AppRoot -> appStore + controllers`.
- `routing -> map (coordonnees de contexte)`.
- `data -> routing (requestRoute)`.
- `cloud -> data (parse/apply payload backup)`.
- `pois -> map (reset UI selection POI)`.

## Consequences
- Positives :
- `AppContainerScreen` devient un adaptateur minimal vers `AppRoot`.
- La logique est decoupee par feature, testable et auditable.
- Les tests front existants (Vitest + Playwright) passent apres refacto.
- Negatives :
- Plusieurs fichiers applicatifs restent > 600 lignes et doivent etre poursuivis en phase 2.
- Suivi necessaire :
- P1 : decouper `i18n.ts` en `locales/fr.json` + `locales/en.json` + loader.
- P1 : decouper les controllers les plus longs en sous-modules internes.

## Liste > 600 lignes (justification temporaire)
- `frontend/src/i18n.ts` (**994**) : dette historique preexistante (cf. P1 ci-dessus).
- `frontend/src/ui/pages/MapPage.tsx` (**838**) : composant ecran carte encore trop centralisateur.
- `frontend/src/components/CesiumRouteMap.tsx` (**829**) : rendu carte et interactions encore couples dans le meme module.
- `frontend/src/features/data/dataPortability.ts` (**749**) : orchestration import/export encore tres dense.
- `frontend/src/features/cloud/useCloudController.ts` (**687**) : orchestration cloud complete en un seul hook.
- `frontend/src/features/routing/useRoutingController.actions.ts` (**612**) : module d'actions routing encore volumineux apres extraction.

## Alternatives evaluees
1. Deplacer integralement le composant dans un nouveau fichier unique : refuse (recree un god file).
2. Introduire Redux/Zustand pendant le decoupage : refuse pour limiter les regressions et garder une migration incrementale.

# ADR-0002 - Versioning API unifie sur /api/v1

- Date : 2026-02-16
- Statut : Accepte
- Portee : backend, frontend, documentation
- References : harmonisation des routes API

## Contexte
Le backend exposait un mix de routes `/api/*` et `/api/v1/*`:
- `/api/v1/*` etait deja utilise pour `health`, `trips`, `external/ping`.
- la majorite des autres endpoints etait en `/api/*` (`route`, `loop`, `places`, `poi`, `export`, `cloud`, `feedback`, `valhalla`).

Ce mix complique la lisibilite publique de l'API, la gouvernance de compatibilite et la maintenance des clients.

Deux strategies ont ete evaluees :
- Option A : tout exposer sous `/api/v1/*`.
- Option B : conserver `/api/*` non versionne et gerer la version via headers/documentation.

## Decision
Option A est retenue.

Le prefixe canonique devient `/api/v1/*` pour l'ensemble des endpoints.

Pour eviter toute rupture immediate, un alias de compatibilite temporaire est active cote backend :
- les routes legacy `/api/*` des familles historiques sont reecrites vers `/api/v1/*` (route, loop, places, poi, export, cloud, feedback, valhalla).
- les routes deja en `/api/v1/*` restent inchangees.

## Consequences
- Positives :
  - surface API unique et explicite pour la vitrine publique.
  - evolution future simplifiee (`/api/v2/*` possible sans ambiguite).
  - migration client progressive sans interruption.
- Negatives :
  - cout transitoire de maintien d'un alias legacy.
  - besoin de suivre puis supprimer l'alias apres migration complete des clients.
- Suivi necessaire :
  - documenter la table canonique + mapping legacy dans la doc API.
  - basculer progressivement tous les clients et tests vers `/api/v1/*`.

# ADR-0003 - Exception de taille pour OverpassGeometryHelper

- Date : 2026-02-16
- Statut : Accepte
- Portee : backend
- References : refacto auditabilite backend (fichiers > 400 lignes)

## Contexte
La refacto backend a reduit les fichiers les plus volumineux de `Routing` et `AppHost`.

`backend/src/BikeVoyager.Infrastructure/Pois/OverpassGeometryHelper.cs` reste a 405 lignes, soit un depassement de 5 lignes par rapport a la cible < 400.

Le module regroupe un pipeline geometrique tres coherent :
- calcul de bounding boxes,
- projection point-segment et segment-segment,
- conversion lat/lon vers metre local,
- fallback robuste sur geometries partielles.

## Decision
Conserver `OverpassGeometryHelper` dans un seul fichier a ce stade et accepter une exception temporaire documentee a 405 lignes.

Aucune extraction supplementaire n'est faite pour ne pas disperser une logique mathematique compacte et fortement couplee.

## Consequences
- Positives :
  - lisibilite algorithmique preservee pour l'audit geometrique.
  - risque de regression reduit sur une zone numeriquement sensible.
- Negatives :
  - non-conformite marginale a la regle stricte de taille.
- Suivi necessaire :
  - reevaluation lors d'une prochaine evolution fonctionnelle POI pour extraire des sous-modules si la taille continue d'augmenter.

## Alternatives evaluees
1. Extraire les projections lineaires dans un helper annexe : non retenu (dispersion d'un meme algorithme).
2. Fractionner par type de calcul (bounds/projections) immediatement : non retenu (gain de taille faible, cout de navigation plus eleve).
