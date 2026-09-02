# Configurer l'OAuth Google (« Sign in with Google »)

Ce document décrit **la partie à faire dans la Google Cloud Console**, puis le
contrat entre le front (ChromaFront) et le back pour la vérification du token.

## Flux retenu

**Authorization code**, piloté par le back (port `3000`) :

1. Le front envoie l'utilisateur vers le back (`GET /google/login` ou équivalent).
2. Le back redirige vers `https://accounts.google.com/o/oauth2/v2/auth`
   (`response_type=code`, `scope=openid email profile`, `state`, PKCE
   recommandé), avec `redirect_uri=http://localhost:3000/google/callback`.
3. Google redirige vers **`http://localhost:3000/google/callback?code=...&state=...`**.
4. Le back échange le `code` contre `id_token` + `access_token`
   (+ `refresh_token`) sur `https://oauth2.googleapis.com/token`, en utilisant
   `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`.
5. Le back vérifie l'`id_token` (cf. section « Ce que le back doit vérifier »),
   crée sa session, puis redirige vers le front.

Ce flux **nécessite le `client_secret`** — côté back uniquement, jamais dans le
bundle front. La callback URL exacte est
`http://localhost:3000/google/callback` (dev).

> Le bouton GIS *ID token* (`GoogleSignInButton.svelte`) est encore en place mais
> ne correspond pas à ce flux : il faudra le remplacer par un lien/redirection
> vers `/google/login` du back. Détails dans la section « Front à adapter ».

---

## Étapes dans la Google Cloud Console

### 1. Créer / choisir un projet

1. Aller sur <https://console.cloud.google.com/>.
2. Sélecteur de projet (en haut) → **Nouveau projet** → nom `chroma` (ou
   réutiliser un projet existant) → **Créer**.
3. Bien sélectionner ce projet dans le sélecteur avant la suite.

### 2. Configurer l'écran de consentement OAuth

`APIs & Services` → `OAuth consent screen` (ou `Branding` selon la nouvelle UI).

1. **User type** :
   - `Internal` si tout le monde est dans le même Google Workspace (seuls les
     comptes de l'organisation pourront se connecter).
   - `External` sinon. En mode *Testing*, il faut ajouter chaque compte
     autorisé dans **Test users**. Passer en *Production* (bouton **Publish
     app**) pour ouvrir à tous — pas besoin de *verification* Google tant qu'on
     ne demande que les scopes `openid`, `email`, `profile`.
2. **App information** : nom de l'app (`Chroma`), email de support, logo
   (optionnel).
3. **Scopes** : ajouter seulement `openid`, `.../auth/userinfo.email`,
   `.../auth/userinfo.profile`. Rien d'autre pour l'instant.
4. **Authorized domains** : ajouter le domaine de prod (ex. `chroma.app`) quand
   il existe. Pas nécessaire pour `localhost`.
5. Enregistrer.

### 3. Créer l'OAuth Client ID

`APIs & Services` → `Credentials` → **Create credentials** → **OAuth client ID**.

1. **Application type** : `Web application`.
2. **Name** : `chroma-web` (interne, peu importe).
3. **Authorized JavaScript origins** — c'est le champ **critique** pour GIS.
   Mettre l'origine exacte (schéma + host + port, **sans** slash final, **sans**
   chemin) :

   | Environnement | Origine |
   |---|---|
   | Dev (Vite) | `http://localhost:5173` |
   | Dev (port alt utilisé ici) | `http://localhost:5199` |
   | Preview (`npm run preview`) | `http://localhost:4173` |
   | Prod | `https://<domaine-de-prod>` |

   > Ajouter chaque port réellement utilisé. `127.0.0.1` et `localhost` sont
   > considérés comme des origines différentes — ajouter les deux si besoin.

4. **Authorized redirect URIs** — nécessaires car on part sur le flux
   *authorization code* piloté par le back (port **3000**) :

   | Environnement | Redirect URI |
   |---|---|
   | Dev | `http://localhost:3000/google/callback` |
   | Prod | `https://<api-prod>/google/callback` |

   > URI **exacte** : schéma + host + port + chemin, sans slash final. Doit
   > correspondre au caractère près à celle envoyée par le back dans la requête
   > d'autorisation, sinon `redirect_uri_mismatch`.
5. **Create**. Copier le **Client ID** (format
   `1234567890-xxxx.apps.googleusercontent.com`).
   Le *client secret* affiché n'est **pas** utilisé par ce flux — ne pas le
   mettre dans le front.

### 4. Renseigner les identifiants côté back

Avec le flux *authorization code*, c'est **le back** qui détient tout. Dans le
`.env` de `chromaback` :

```dotenv
GOOGLE_CLIENT_ID=1234567890-xxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...                          # à régénérer avant la prod
GOOGLE_REDIRECT_URI=http://localhost:3000/google/callback
```

Le front n'a plus besoin de `PUBLIC_GOOGLE_CLIENT_ID` pour ce flux (le
`.env.example` de ChromaFront le garde tant que le bouton GIS n'est pas retiré —
mettre une valeur bidon suffit pour que `svelte-check` passe).

---

## Front (ChromaFront) — état actuel

Implémenté :

- `GoogleSignInButton.svelte` : `<a>` blanc (style Figma `home`) vers
  `${PUBLIC_API_BASE_URL}/google/login`. Plus aucun code GIS / ID token.
- `.env` / `.env.example` : `PUBLIC_API_BASE_URL=http://localhost:3000`.
- `src/lib/api.js` : `apiFetch()` (toujours `credentials: "include"`),
  `refreshSession()` → `POST /account/token`, `getSession()` →
  `GET /status/ping` (retry après refresh sur 401/403) qui renvoie
  `{ sub, email, name }` ou `null`, `isAuthenticated()`, `logout()` →
  `POST /logout`.
- `src/lib/session.svelte.js` : store rune partagé (`session.user`), rempli par
  le garde et lu par `NavSidebar` (affiche l'email/nom + bouton Déconnexion).
- Groupe de routes `src/routes/(protected)/` (`ssr = false`) avec un garde dans
  `+layout.svelte` : `loadSession()` au `onMount`, sinon `goto("/")`.
  `/dashboard` et `/entities` sont dedans (URL inchangées).
- `src/routes/login/` : cible du 302 post-login du back. Charge la session puis
  `goto("/dashboard")` ou `goto("/")`.
- `src/routes/Error/` : page d'erreur, lit `?type=&message=` (le back y redirige
  les échecs).

Contrat back (confirmé + implémenté par `chromaback`) :

- succès → `302 http://localhost:5173/login` (`APP_BASE_URL`)
- échec → `302 http://localhost:5173/Error?type=<code>&message=<text>`
- cookies posés sur `:3000` : `access_token` (15 min) + `refresh_token` (7 j),
  `HttpOnly; Secure; SameSite=None; Path=/`. Le front ne stocke rien.
- `GET /status/ping` (authentifié) →
  `{ "status": "ok", "sub", "email", "name": <string|null> }` ; non authentifié
  → `401`. **Un seul ping suffit** pour l'en-tête (email/nom sont dans les JWT,
  préservés au refresh).
- `POST /account/token` (body vide) → re-pose un `access_token` frais.
- `POST /logout` → `204`, supprime la ligne `refresh_tokens` et vide les deux
  cookies.
- CORS : `credentials: true`, allow-list `CORS_ORIGINS`
  (`http://localhost:5173,http://localhost:5199`).
- Accès verrouillé au seul compte `softwayback@gmail.com` (email vérifié sur
  l'`id_token`), session clé sur le `sub` Google.

État : **login end-to-end vérifié en dev** (vrai compte Google, `/google/login`
→ consentement → `/google/callback` → cookies → `302 /login` → session reprise
par le front). Le back dev pointe sur la base `TIME-dev`.

Reste à faire **avant la prod** (côté user — le back n'a pas le droit de toucher
la DB ni les secrets) :

- **DB prod (`TIME`)** : `refresh_tokens.user_id` est encore en `integer`, le
  flux Google renverra un 500 tant que :
  `ALTER TABLE refresh_tokens ALTER COLUMN user_id TYPE text USING user_id::text`
  n'est pas passé sur `TIME`. (`TIME-dev` est déjà en `text`.)
- **`GOOGLE_CLIENT_SECRET`** : à régénérer dans la Console (il a fuité dans le
  chat) et à reporter dans la config prod du back.
- Ajouter les URLs de prod : *Authorized JavaScript origins* + *redirect URI*
  `https://<api-prod>/google/callback`, et publier l'écran de consentement si
  l'accès doit dépasser le compte unique actuel.

---

## Ce que le back doit vérifier sur l'ID token

Ne **jamais** faire confiance au contenu du JWT sans vérification.

1. **Signature** : contre les clés publiques Google
   (`https://www.googleapis.com/oauth2/v3/certs`, JWKS, avec cache/refresh).
2. **`iss`** = `https://accounts.google.com` ou `accounts.google.com`.
3. **`aud`** = exactement le `GOOGLE_CLIENT_ID`.
4. **`exp`** non dépassé (et `iat`/`nbf` cohérents).
5. Optionnel : **`hd`** = domaine Workspace attendu si on veut restreindre.
6. Optionnel : **`nonce`** si le front en fournit un (recommandé, cf. plus bas).

Claims utiles ensuite :

| Claim | Usage |
|---|---|
| `sub` | **identifiant stable** du compte Google → clé primaire côté back. Ne pas utiliser l'email comme identité. |
| `email` + `email_verified` | n'accepter que si `email_verified === true`. |
| `name`, `picture` | affichage. |

### Implémentation recommandée (back Node)

```bash
npm i google-auth-library
```

```js
import { OAuth2Client } from "google-auth-library";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/** @param {string} idToken JWT reçu du front */
export async function verifyGoogleIdToken(idToken) {
  const ticket = await client.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID
  });
  const payload = ticket.getPayload(); // signature + iss + aud + exp déjà validés
  if (!payload?.email_verified) throw new Error("email non vérifié");
  return {
    googleId: payload.sub,
    email: payload.email,
    name: payload.name,
    picture: payload.picture
  };
}
```

Autres stacks : `google.oauth2.id_token.verify_oauth2_token` (Python),
`google-api-client` (Go), ou n'importe quelle lib JWT + JWKS Google.
Le endpoint de debug `https://oauth2.googleapis.com/tokeninfo?id_token=...` sert
uniquement au **dev manuel**, pas en production (latence + rate limit).

### Après vérification

- `upsert` de l'utilisateur par `googleId`.
- Émettre la session applicative : cookie `HttpOnly` + `Secure` + `SameSite=Lax`
  (ou JWT applicatif court + refresh). Le front ne renvoie plus l'ID token Google
  ensuite.

---

## Durcissement (à prévoir)

- **HTTPS obligatoire** en prod (GIS refuse les origines non `localhost` en
  clair).
- **Nonce** : générer un nonce aléatoire côté front, le passer à
  `google.accounts.id.initialize({ nonce })`, le stocker (cookie court), et le
  comparer au claim `nonce` côté back → protège contre le rejeu.
- **CORS** du back limité aux origines front connues.
- Ne pas logguer les tokens.
- Prévoir la rotation : si le Client ID change, mettre à jour front **et** back.

---

## Erreurs fréquentes

| Symptôme | Cause | Fix |
|---|---|---|
| `[GSI_LOGGER] ... origin is not allowed` / `idpiframe_initialization_failed` | l'origine courante n'est pas dans *Authorized JavaScript origins* | ajouter l'URL exacte (schéma+host+port, sans slash) et attendre quelques minutes |
| `redirect_uri_mismatch` | l'URI envoyée par le back ≠ une *Authorized redirect URI* enregistrée | aligner au caractère près : `http://localhost:3000/google/callback` |
| `invalid_client` | `client_secret` absent/erroné côté back | vérifier `GOOGLE_CLIENT_SECRET` dans le `.env` du back |
| Back : `Wrong recipient` | `aud` du token ≠ Client ID du back | même Client ID des deux côtés |
| Seuls certains comptes marchent | consent screen en *Testing* | ajouter en *Test users* ou publier l'app |
| Changement d'origine non pris en compte | propagation Google | patienter 5 min à quelques heures, vider le cache |

---

## Détail d'implémentation du flux (back)

1. **`GET /google/login`** : générer `state` (aléatoire, stocké en cookie court)
   et un `code_verifier`/`code_challenge` PKCE, puis `302` vers
   `https://accounts.google.com/o/oauth2/v2/auth` avec
   `client_id`, `redirect_uri=GOOGLE_REDIRECT_URI`,
   `response_type=code`, `scope=openid email profile`, `state`,
   `code_challenge`, `code_challenge_method=S256`,
   `access_type=offline` + `prompt=consent` si on veut un `refresh_token`.
2. **`GET /google/callback`** : vérifier `state` (CSRF), échanger `code` sur
   `POST https://oauth2.googleapis.com/token`
   (`client_id`, `client_secret`, `code`, `code_verifier`, `grant_type=authorization_code`,
   `redirect_uri`).
3. Vérifier l'`id_token` reçu (cf. « Ce que le back doit vérifier »), `upsert`
   user par `sub`, poser la session, `302` vers le front.
