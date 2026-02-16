# Politique de securite BikeVoyager

Ce fichier est la source de verite securite du depot.

## Signaler une vulnerabilite

Ne publiez pas de details exploitables dans une issue publique.

Canal recommande (prive) :
- `https://github.com/arnaud-wissart/BikeVoyager/security/advisories/new`

Canal de secours :
- `https://github.com/arnaud-wissart/BikeVoyager/issues`
- Indiquer `[security]` dans le titre, sans details sensibles, puis demander un canal prive.

## Portee technique

Ce document couvre principalement :
- la session API anonyme ;
- l'authentification cloud OAuth (Google Drive / OneDrive) ;
- les limites connues et risques residuels ;
- la politique de headers HTTP cote API.

## Session API anonyme

### Principe
- Toute requete sur `/api/*` (y compris `/api/v1/*`) recoit ou reutilise un cookie de session anonyme.
- Le cookie est protege par ASP.NET Data Protection (signature + chiffrement applicatif).
- Le cookie transporte un identifiant de session et une expiration.

### Proprietes cookie
- `HttpOnly` actif
- `SameSite=Lax` actif
- `Secure` active si HTTPS
- `Path=/`
- expiration configurable (`ApiSecurity:AnonymousSessionLifetimeHours`, minimum 1h)

### Usage
- Correlation applicative et rate limiting.
- Ce n'est pas un compte utilisateur.

## Authentification cloud OAuth

### Principe
- Demarrage via `/api/v1/cloud/oauth/start`.
- Callback via `/api/v1/cloud/oauth/callback`.
- Etats OAuth `pending` et sessions cloud `auth` stockes cote serveur (cache distribue + fallback memoire).

### Cookies cloud
- `bv_cloud_pending_sid` : reference d'etat OAuth en cours.
- `bv_cloud_auth_sid` : reference de session cloud connectee.

Proprietes :
- `HttpOnly`, `SameSite=Lax`, `Path=/` ;
- `Secure` si HTTPS ;
- aucun token OAuth n'est stocke dans le cookie (reference serveur uniquement).

### PKCE, state, callback
- `state` et `code_verifier` generes cote serveur (aleatoire cryptographique).
- challenge PKCE en `S256`.
- callback valide : erreurs fournisseur, presence `code`, et egalite temps constant du `state`.

## Risques et limites

- Sans HTTPS, les cookies ne sont pas `Secure`.
- Le modele repose sur la confidentialite des cookies HttpOnly dans le navigateur.
- Le fallback memoire locale peut degrader la coherence en multi-instance.
- La revocation distante cloud est detectee lors des appels cloud (upload/restore/refresh).

## Recommandations

- Forcer HTTPS en production.
- Utiliser un cache distribue robuste pour les sessions cloud.
- Surveiller les erreurs OAuth et de refresh token.
- Limiter CORS aux origines strictement necessaires.

## Politique de headers HTTP (API)

En environnement non `Development`, l'API applique :
- `UseHttpsRedirection` + `UseHsts` ;
- `X-Content-Type-Options: nosniff` ;
- `Referrer-Policy: strict-origin-when-cross-origin` ;
- `X-Frame-Options: DENY` ;
- `Permissions-Policy: geolocation=(), camera=(), microphone=()`.

Objectif : reduire les risques MIME sniffing, clickjacking et exposition de metadonnees de navigation.
