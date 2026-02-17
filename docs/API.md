# API BikeVoyager

## Objectif
Documenter la surface HTTP canonique et la compatibilité legacy.

## Stratégie de versioning

- Canonique : **`/api/v1/*`**
- Compatibilité temporaire : certains anciens chemins **`/api/*`** sont aliasés vers `/api/v1/*` côté backend.

## Dépréciation du legacy `/api/*`

- Les appels legacy `/api/*` restent supportés temporairement.
- Chaque réponse legacy inclut les headers :
  - `Deprecation: true`
  - `Sunset: Tue, 30 Jun 2026 23:59:59 GMT`
- Date cible de suppression du mode legacy : **2026-07-01**.
- Les routes canoniques `/api/v1/*` ne portent pas ces headers de dépréciation.

## Routes canoniques (`/api/v1/*`)

### Santé et demos
- `GET /api/v1/health`
- `GET /api/v1/trips`
- `POST /api/v1/trips`
- `GET /api/v1/external/ping`

### Routage et carte
- `POST /api/v1/route`
- `POST /api/v1/loop`
- `GET /api/v1/places/search`
- `GET /api/v1/places/reverse`
- `GET /api/v1/poi/around-route`
- `POST /api/v1/poi/around-route`
- `POST /api/v1/export/gpx`

### Valhalla
- `GET /api/v1/valhalla/status`
- `POST /api/v1/valhalla/update/start`
- `GET /api/v1/valhalla/ready`

### Cloud sync
- `GET /api/v1/cloud/providers`
- `GET /api/v1/cloud/session`
- `GET /api/v1/cloud/status`
- `GET /api/v1/cloud/oauth/start`
- `POST /api/v1/cloud/oauth/callback`
- `POST /api/v1/cloud/disconnect`
- `POST /api/v1/cloud/backup/upload`
- `GET /api/v1/cloud/backup/restore`

### Feedback
- `POST /api/v1/feedback`

## Mapping de compatibilité legacy (`/api/*` -> `/api/v1/*`)

| Legacy | Canonique |
|---|---|
| `/api/route` | `/api/v1/route` |
| `/api/loop` | `/api/v1/loop` |
| `/api/places/*` | `/api/v1/places/*` |
| `/api/poi/*` | `/api/v1/poi/*` |
| `/api/export/*` | `/api/v1/export/*` |
| `/api/cloud/*` | `/api/v1/cloud/*` |
| `/api/feedback` | `/api/v1/feedback` |
| `/api/valhalla/*` | `/api/v1/valhalla/*` |

Note : les chemins legacy ci-dessus restent fonctionnels uniquement à titre transitoire, jusqu'à la date cible de suppression.
