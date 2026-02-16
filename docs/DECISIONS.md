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
- `frontend/src/app/AppRoot.tsx` : orchestration transitoire des props pages + shell durant la migration.
- `frontend/src/features/routing/useRoutingController.ts` : extraction initiale complete du flux routing.
- `frontend/src/features/data/useDataController.ts` : extraction initiale complete import/export + address book.
- `frontend/src/features/map/useMapController.ts` : extraction initiale complete navigation + formatage map.
- `frontend/src/features/cloud/useCloudController.ts` : orchestration cloud complete en un seul hook.
- `frontend/src/features/routing/domain.ts` et `frontend/src/features/data/dataPortability.ts` : dette historique preexistante.
- `frontend/src/i18n.ts` : dette historique preexistante (cf. P1 ci-dessus).

## Alternatives evaluees
1. Deplacer integralement le composant dans un nouveau fichier unique : refuse (recree un god file).
2. Introduire Redux/Zustand pendant le decoupage : refuse pour limiter les regressions et garder une migration incrementale.
