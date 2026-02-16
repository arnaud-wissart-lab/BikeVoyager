# Audit technique — BikeVoyager (mise à jour 2026-02-16)

> Objectif : vitrine GitHub propre, auditable et maintenable.  
> Périmètre : dépôt actuel (`backend/`, `frontend/`, `infra/`) sans changement fonctionnel.

## 1) Synthèse exécutable

### Points forts actuels
- Architecture backend lisible (`Api -> Application -> Infrastructure -> Domain`) avec endpoints regroupés par feature.
- Pipeline qualité en place : CI backend/frontend, tests automatiques, audits de dépendances.
- Frontend structuré par domaines (`features/*`, `ui/pages/*`, `ui/shell/*`) avec i18n et tests.
- Sécurité applicative présente : `ProblemDetails`, rate limiting, garde d'origine, session anonyme HttpOnly.

### Risques actuels (priorisés)
1. **Monolithes frontend encore importants** :
   - `frontend/src/ui/shell/AppContainer.tsx` : **4107 lignes**.
   - `frontend/src/i18n.ts` : **989 lignes**.
   - `frontend/src/features/routing/domain.ts` : **862 lignes**.
2. **Cohérence de versionnement API** :
   - Mix actuel entre routes `/api/*` et `/api/v1/*`.
3. **Gouvernance “vitrine open-source” incomplète** :
   - Fichiers attendus encore absents à la racine (`LICENSE`, `CODE_OF_CONDUCT.md`, `SECURITY.md` racine).

## 2) Constats corrigés depuis l'audit précédent

- Scripts `scripts/dev-test` et `scripts/dev-audit` alignés sur `BikeVoyager.sln`.
- Adresse email sensible remplacée par un placeholder (`contact@example.com`) côté configuration feedback.
- Point de commentaire “TODO en anglais” obsolète : le TODO de référence est maintenant en français.
- Artefacts Visual Studio nettoyés du dépôt sous `backend/.vs`.
- Règles d'ignore renforcées pour `.vs` imbriqués via `**/.vs/` dans `.gitignore`.

## 3) Hygiène des artefacts locaux (état actuel)

Vérification sur les fichiers **suivis** par Git : aucun artefact local détecté dans les catégories suivantes :

- dossiers `.dev/`, `.tmp/`, `.vs/`, `logs/`, `dist/`, `dist-ssr/`, `node_modules/`, `TestResults/`, `bin/`, `obj/`
- fichiers `*.log`, `*.tmp`, `*.user`

Conclusion : les artefacts locaux sont ignorés et non versionnés dans l'état courant du dépôt.

## 4) Priorités de PR (sans changement de comportement)

1. **Découper `AppContainer.tsx`** par domaines (routing, POI, cloud, data, navigation) pour limiter l'effet “god component”.
2. **Harmoniser la stratégie de routes API** (tout en `/api/v1/*` ou tout en `/api/*`) et documenter le choix.
3. **Finaliser les fichiers de gouvernance** (license, sécurité, contribution) pour crédibiliser la vitrine.

## 5) Hotspots LOC actuels

### Backend
- `backend/src/BikeVoyager.Infrastructure/Routing/ValhallaLoopService.cs` : **516**

### Frontend
- `frontend/src/ui/shell/AppContainer.tsx` : **4107**
- `frontend/src/i18n.ts` : **989**
- `frontend/src/features/routing/domain.ts` : **862**
- `frontend/src/ui/pages/MapPage.tsx` : **821**
- `frontend/src/components/CesiumRouteMap.tsx` : **725**
- `frontend/src/features/data/dataPortability.ts` : **644**

---

Cet audit reflète l'état observé du dépôt au **16 février 2026**.
