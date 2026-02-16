# Sécurité BikeVoyager

## Portée
Ce document décrit le modèle d'authentification API côté backend, en particulier:
- la session API anonyme;
- l'authentification cloud OAuth (Google Drive / OneDrive);
- les limites connues et les risques résiduels.

## Session API anonyme

### Principe
- Toute requête sur `/api/*` reçoit (ou réutilise) un cookie de session anonyme.
- Le cookie est protégé via ASP.NET Data Protection (signature + chiffrement applicatif).
- Le cookie transporte un identifiant de session et une date d'expiration.

### Propriétés du cookie
- `HttpOnly`: actif
- `SameSite=Lax`: actif
- `Secure`: activé si la requête est HTTPS
- `Path=/`
- Expiration configurable (`ApiSecurity:AnonymousSessionLifetimeHours`, minimum 1 heure)

### Usage
- L'identifiant de session anonyme sert à la corrélation applicative et au rate limiting.
- La session anonyme n'est pas un compte utilisateur.

## Authentification cloud OAuth

### Principe
- Démarrage OAuth via `/api/cloud/oauth/start`.
- Validation du callback via `/api/cloud/oauth/callback`.
- Stockage serveur des états OAuth "pending" et des sessions cloud "auth" (cache distribué + repli mémoire locale).

### Cookies cloud
- `bv_cloud_pending_sid`: référence serveur d'un état OAuth en cours.
- `bv_cloud_auth_sid`: référence serveur d'une session cloud connectée.

Les cookies cloud:
- sont `HttpOnly`, `SameSite=Lax`, `Path=/`;
- sont `Secure` si HTTPS;
- ne contiennent pas de token OAuth (ils pointent vers un état serveur).

### PKCE, state et callback
- `state` et `code_verifier` sont générés côté serveur (aléatoire cryptographique).
- Le challenge PKCE (`S256`) est dérivé du verifier.
- Le callback vérifie systématiquement:
  - les erreurs fournisseur OAuth,
  - la présence du `code`,
  - l'égalité en temps constant du `state`.

## Flux OAuth (mini diagramme)
```text
Client -> GET /api/cloud/oauth/start
API -> génère state + verifier(PKCE) -> stocke pending(session store) -> pose cookie pending
Client -> redirection fournisseur OAuth
Fournisseur -> retour code/state vers front -> POST /api/cloud/oauth/callback
API -> valide pending + state + code -> échange code/token -> crée session auth serveur -> pose cookie auth
```

## Risques et limites
- Sans HTTPS, les cookies ne sont pas marqués `Secure` et le risque d'interception augmente.
- Le modèle repose sur la confidentialité des cookies HttpOnly côté navigateur.
- Le repli mémoire locale du store de session cloud peut introduire une dégradation en environnement multi-instance (cohérence éventuelle selon topologie).
- La révocation distante des droits cloud n'est détectée qu'au moment des appels API cloud (upload/restore/refresh).

## Recommandations
- Forcer HTTPS en production.
- Déployer un cache distribué robuste pour les sessions cloud.
- Surveiller les erreurs OAuth et les erreurs de refresh token.
- Limiter la surface CORS aux origines strictement nécessaires.

## Politique de headers HTTP (API)

En environnement non `Development`, l'API applique un durcissement HTTP minimal via le pipeline ASP.NET:
- `UseHttpsRedirection` + `UseHsts` (header `Strict-Transport-Security` sur les réponses HTTPS);
- `X-Content-Type-Options: nosniff`;
- `Referrer-Policy: strict-origin-when-cross-origin`;
- `X-Frame-Options: DENY`;
- `Permissions-Policy: geolocation=(), camera=(), microphone=()`.

Objectif:
- réduire les risques de type MIME sniffing, clickjacking et exposition de métadonnées de navigation;
- conserver un comportement fonctionnel inchangé côté API.
