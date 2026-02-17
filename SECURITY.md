# Politique de sécurité BikeVoyager

Ce fichier est la source de vérité sécurité du dépôt.

## Signaler une vulnérabilité

Ne publiez pas de détails exploitables dans une issue publique.

Canal recommandé (privé) :
- Utiliser l'onglet `Security` du dépôt pour ouvrir un advisory privé.

Canal de secours :
- Ouvrir une issue via l'onglet `Issues` du dépôt.
- Indiquer `[security]` dans le titre, sans détails sensibles, puis demander un canal privé.

## Portée technique

Ce document couvre principalement :
- la session API anonyme ;
- l'authentification cloud OAuth (Google Drive / OneDrive) ;
- les limites connues et risques résiduels ;
- la politique de headers HTTP côté API.

## Session API anonyme

### Principe
- Toute requête sur `/api/v1/*` reçoit ou réutilise un cookie de session anonyme.
- Le cookie est protégé par ASP.NET Data Protection (signature + chiffrement applicatif).
- Le cookie transporte un identifiant de session et une expiration.

### Propriétés cookie
- `HttpOnly` actif
- `SameSite=Lax` actif
- `Secure` active si HTTPS
- `Path=/`
- expiration configurable (`ApiSecurity:AnonymousSessionLifetimeHours`, minimum 1h)

### Usage
- Corrélation applicative et rate limiting.
- Ce n'est pas un compte utilisateur.

## Authentification cloud OAuth

### Principe
- Démarrage via `/api/v1/cloud/oauth/start`.
- Callback via `/api/v1/cloud/oauth/callback`.
- États OAuth `pending` et sessions cloud `auth` stockés côté serveur (cache distribué + fallback mémoire).

### Cookies cloud
- `bv_cloud_pending_sid` : référence d'état OAuth en cours.
- `bv_cloud_auth_sid` : référence de session cloud connectée.

Propriétés :
- `HttpOnly`, `SameSite=Lax`, `Path=/` ;
- `Secure` si HTTPS ;
- aucun token OAuth n'est stocké dans le cookie (référence serveur uniquement).

### PKCE, state, callback
- `state` et `code_verifier` générés côté serveur (aléatoire cryptographique).
- challenge PKCE en `S256`.
- callback validé : erreurs fournisseur, présence `code`, et égalité temps constant du `state`.

## Risques et limites

- Sans HTTPS, les cookies ne sont pas `Secure`.
- Le modèle repose sur la confidentialité des cookies HttpOnly dans le navigateur.
- Le fallback mémoire locale peut dégrader la cohérence en multi-instance.
- La révocation distante cloud est détectée lors des appels cloud (upload/restore/refresh).

## Recommandations

- Forcer HTTPS en production.
- Utiliser un cache distribué robuste pour les sessions cloud.
- Surveiller les erreurs OAuth et de refresh token.
- Limiter CORS aux origines strictement nécessaires.

## Politique de headers HTTP (API)

En environnement non `Development`, l'API applique :
- `UseHttpsRedirection` + `UseHsts` ;
- `X-Content-Type-Options: nosniff` ;
- `Referrer-Policy: strict-origin-when-cross-origin` ;
- `X-Frame-Options: DENY` ;
- `Permissions-Policy: geolocation=(), camera=(), microphone=()`.

Objectif : réduire les risques MIME sniffing, clickjacking et exposition de métadonnées de navigation.
