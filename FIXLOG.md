# FIXLOG

## 2026-02-15 — Passe UI cohérence + couverture E2E

- Harmonisation du thème global Mantine (`frontend/src/theme.ts`) :
  - échelle typographique explicite
  - defaults composants unifiés (Button, ActionIcon, SegmentedControl, inputs, etc.)
- Correctifs ergonomiques UI :
  - menu bas mobile sans débordement horizontal
  - état actif plus lisible
  - cohérence des paddings/radius dans les panneaux
  - chevrons de section repliable corrigés
- Écran Aide simplifié :
  - retrait des lignes `Backend cache` / `Fallback`
  - conservation du statut cache distribué et de l’heure serveur
  - nettoyage des clés i18n inutilisées
- Ajout de tests E2E Playwright :
  - config `frontend/playwright.config.ts`
  - specs `frontend/e2e/app-shell.spec.ts`
  - scripts npm `e2e` / `e2e:ui`
  - exclusion `e2e/**` côté Vitest
- Scénario E2E supplémentaire :
  - parcours utilisateur complet desktop (`planifier -> calcul -> carte`)
- CI frontend mise à jour :
  - installation Chromium Playwright
  - exécution `npm run e2e` dans `.github/workflows/ci.yml`
- Maintenabilité des chaînes techniques :
  - endpoints API centralisés dans `frontend/src/features/app/apiPaths.ts`
  - suppression des endpoints hardcodés dans App/cloudSync/PlaceSearchInput/tests
- Protection API anti-abus :
  - middleware de garde d'origine sur `/api/*`
  - rate limiting global + policies dédiées endpoints de calcul/export
  - configuration centralisée `ApiSecurity` dans `appsettings.json`
  - session anonyme silencieuse via cookie signé HttpOnly (`bv_anon_sid`)
  - clé de rate limiting priorisée sur la session anonyme (fallback IP)
  - suppression du header client `X-Session-Id`
- Tests API session anonyme :
  - création du cookie + attributs de sécurité
  - réutilisation sans rotation
  - remplacement d'un cookie invalide
- Documentation mise à jour :
  - `README.md`
  - `frontend/README.md`
  - `RUNBOOK.md`
  - `docs/ui-audit-2026-02-15.md`
  - `CHECKLIST.md`

## 2026-02-05 — Unification solution à la racine

- Création de `BikeVoyager.slnx` (racine) et `BikeVoyager.sln` pour CLI.
- Déplacement des solutions `backend/` dans `docs/legacy` pour éviter les ambiguïtés.
- Mise à jour des scripts et de la documentation.

## 2026-02-05 — F5 stable (Aspire + Frontend)

- Ajout des variables OTLP Aspire dans `launchSettings.json` de l’AppHost.
- Retour au lancement du frontend via AppHost (`AddExecutable`) pour éviter l’erreur du SDK JS.
- Mise à jour des docs F5 et du rôle des solutions racine.

## 2026-02-05 — Remplacement dashboard par planification

- Nouvelle UI “Planifier / Carte / Profils / Aide” (Apple Maps minimal).
- Suppression des sections “Prochaines sorties / Actions rapides”.
- Navigation mobile (barre basse) et desktop (tabs) + i18n FR/EN.

## 2026-02-05 — Polish UX Planifier

- Regroupement Mode/Type avec hiérarchie renforcée et style sobre.
- Apparition progressive des champs avec transition légère.
- CTA mis en avant (texte d’aide, alignement desktop, pleine largeur mobile).

## 2026-02-05 — Profils simplifiés (vitesses par mode)

- Profils fixes (Marche/Vélo/VAE) avec vitesses moyennes réglables.
- Sauvegarde locale et bouton de réinitialisation.
- Résumé de vitesse affiché dans Planifier avec lien vers Profils.

## 2026-02-05 — Recherche de lieux (France)

- Module de géocodage côté backend (communes + adresses optionnelles).
- Endpoints `/api/places/search` et `/api/places/reverse`.
- Auto-complétion front avec debounce et cache.
