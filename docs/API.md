# API BikeVoyager

## Objectif
Documenter la surface HTTP canonique.

## Stratégie de versioning

- Canonique : **`/api/v1/*`**
- Les routes non versionnées ont été supprimées le **2026-02-17**.

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