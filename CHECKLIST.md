# CHECKLIST

## 2026-02-15 — Passe UI professionnelle + E2E

- [x] Thème global harmonisé (typographie, tailles, radius, defaults composants)
- [x] Navigation mobile auditée (pas de débordement horizontal)
- [x] Écran Aide simplifié (suppression Backend/Fallback, heure serveur conservée)
- [x] Tests E2E Playwright ajoutés (mobile footer + aide cloud)
- [x] Scénario E2E parcours complet (planifier -> calcul -> carte)
- [x] CI frontend enrichie avec exécution Playwright E2E
- [x] Endpoints API centralisés via constantes partagées (`apiPaths`)
- [x] Protection API renforcée (garde d'origine + rate limiting)
- [x] Session API anonyme silencieuse (cookie HttpOnly signé côté backend)
- [x] Tests d'intégration API session anonyme ajoutés/renforcés
- [x] Documentation mise à jour (README, frontend/README, RUNBOOK, audit UI)

## 2026-02-05 — Initialisation du mono-repo

- [x] Structure repo créée et conforme
- [x] Backend compilable avec architecture propre
- [x] Frontend compilable avec i18n FR/EN et thème clair/sombre
- [x] Tests backend + frontend en place
- [x] Scripts `dev-*` opérationnels
- [x] CI GitHub Actions en place
- [x] Audits (dotnet + npm) exécutés et corrigés

## 2026-02-05 — Orchestration F5 (Visual Studio)

- [x] Projet Aspire AppHost ajouté et compilable
- [x] Proxy Vite configuré pour `/api`
- [x] Documentation F5/CLI mise à jour

## 2026-02-05 — Unification solution à la racine

- [x] Solution unique créée à la racine (`BikeVoyager.slnx`)
- [x] Solutions `backend/` déplacées en archive
- [x] Documentation mise à jour (README/RUNBOOK)

## 2026-02-05 — F5 stable (Aspire + Frontend)

- [x] Variables OTLP Aspire configurées pour l’AppHost
- [x] Frontend lancé par l’AppHost (pas de dépendance au SDK JavaScript VS)
- [x] Documentation F5 mise à jour
- [x] Frontend visible dans la solution racine (projet de contenu)

## 2026-02-05 — Port frontend dynamique (Aspire)

- [x] Port Vite auto-sélectionné entre 5173 et 5190
- [x] Ouverture automatique du navigateur sur le port choisi
- [x] Documentation ajustée (README/RUNBOOK)

## 2026-02-05 — Démarrage frontend tolérant (Vite)

- [x] Vite peut déplacer le port si 5173 est pris (pas de blocage)
- [x] L’AppHost détecte le port actif et ouvre le navigateur

## 2026-02-05 — Port frontend (détection automatique)

- [x] Vite choisit un port libre à partir de `5173`
- [x] L’AppHost détecte l’URL réellement utilisée

## 2026-02-05 — Frontend sans proxy Aspire (plus robuste)

- [x] Suppression de l’endpoint proxifié pour le frontend
- [x] Vite choisit un port libre (strictPort désactivé)
- [x] L’AppHost détecte l’URL et ouvre le navigateur

## 2026-02-05 — UI planification (Apple Maps minimal)

- [x] Remplacement du dashboard par 4 pages (Planifier/Carte/Profils/Aide)
- [x] Navigation mobile (bottom nav) et desktop (tabs)
- [x] Thème sobre gris/bleu/vert sans dégradés
- [x] I18n FR/EN sur tous les textes UI

## 2026-02-05 — Polish UX Planifier

- [x] Regroupement Mode/Type avec hiérarchie visuelle renforcée
- [x] Apparition progressive des champs (transition légère)
- [x] CTA principal mis en valeur (texte d’aide, alignement, pleine largeur mobile)

## 2026-02-05 — Cohérence visuelle Planifier

- [x] Suppression du liseré bleu décoratif
- [x] Hiérarchie basée sur espace, typographie et fonds neutres

## 2026-02-05 — Profils simplifiés (vitesses)

- [x] Profils fixes avec vitesses réglables par mode
- [x] Sauvegarde localStorage + réinitialisation
- [x] Résumé de vitesse affiché dans Planifier

## 2026-02-05 — Recherche de lieux (France)

- [x] Service de géocodage backend (communes + adresses optionnelles)
- [x] Cache mémoire + résilience HttpClient/Polly
- [x] Endpoints `/api/places/search` et `/api/places/reverse`
- [x] Auto-complétion front avec debounce et cache
