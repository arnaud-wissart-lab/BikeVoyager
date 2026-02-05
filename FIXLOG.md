# FIXLOG

## 2026-02-05 — Unification solution à la racine

- Création de `BikeVoyageur.slnx` (racine) et `BikeVoyageur.sln` pour CLI.
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
