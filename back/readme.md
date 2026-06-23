# API Backend - Guide Frontend Complet

Ce README decrit toutes les fonctionnalites backend disponibles pour le frontend: auth, admin dashboard, creation de formation/chapitres/videos, lecture video signee et progression.

## Base URL

En local:

```js
const BACK_URL = "http://localhost:3000";
```

En production:

```js
const BACK_URL = "";
```

## Prefixes de routes montees

- /api/auth
- /api/username
- /api/userpassword
- /api/password
- /api/changestatusclient
- /api/dashboardinformation
- /api/courses
- /api/videos
- /api/admin

## Client API conseille (frontend)

```js
const BACK_URL = "http://localhost:3000";

const authHeaders = () => {
  const token = localStorage.getItem("token");
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

async function api(path, options = {}) {
  const res = await fetch(`${BACK_URL}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...authHeaders(),
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Erreur serveur");
  return data;
}
```

## 1) Authentification

### Google OAuth

- GET /api/auth/google
- Le callback redirige vers CLIENT_URL/auth-callback.html?token=...

### Register

- POST /api/auth/register

```js
await api("/api/auth/register", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    username: "john_doe",
    email: "john@example.com",
    password: "monMotDePasse123",
  }),
});
```

### Login client

- POST /api/auth/login

### Login admin

- POST /api/auth/admin-login

### Forgot/Reset password

- POST /api/auth/forgot-password
- POST /api/auth/reset-password/:token

#### Variables d'environnement pour le reset password

- `RESEND_API_KEY`
- `CLIENT_URL`

Optionnel:

- `RESEND_FROM` pour personnaliser l'expediteur

Flux prod:

1. Le frontend envoie `POST /api/auth/forgot-password` avec `{ "email": "..." }`
2. Le backend genere un token, le stocke en base, puis envoie un email avec un lien vers `CLIENT_URL/reset-password?token=...`
3. Le frontend lit le token dans l'URL et appelle `POST /api/auth/reset-password/:token` avec `{ "newPassword": "..." }`

## 2) Profil utilisateur

- POST /api/username/me
- PUT /api/username/edit-username

## 3) Mot de passe connecte

- PUT /api/userpassword/change-password
- PUT /api/password/change-password

## 4) Validation client (admin)

- PUT /api/changestatusclient/:id/validate
- Body attendu:

```json
{
  "status": true
}
```

## 5) Dashboard admin clients

- GET /api/dashboardinformation/clients

## 6) Admin creation formation

Toutes les routes ci-dessous sont protegees admin (JWT admin requis).

### Lecture admin (listing)

- GET /api/admin/courses
- GET /api/admin/courses/:courseId/chapters
- GET /api/admin/chapters/:chapterId/videos

### Creer une formation

- POST /api/admin/courses

```json
{
  "title": "Masterclass Editing",
  "slug": "masterclasseditgn",
  "description": "Formation complete montage video"
}
```

### Creer un chapitre

- POST /api/admin/chapters

```json
{
  "courseId": "ID_DU_COURS",
  "title": "Chapitre 1",
  "order": 1,
  "description": "Introduction"
}
```

### Creer une video avec public_id existant

- POST /api/admin/videos

```json
{
  "courseSlug": "masterclasseditgn",
  "title": "Video 1",
  "b2FileId": "4_z943feaea53fc843a90d9001f_f114531abc91bd2a2_d20260417_m155009_c003_v0312031_t0038_u01776441009538",
  "b2FileName": "formations/masterclasseditgn/chapter-1/1712910012345-video-1-a1b2c3d4.mp4",
  "order": 1,
  "duration": 540,
  "description": "Premiere video"
}
```

### Upload video depuis dashboard admin

- POST /api/dashboardinformation/upload
- Alias disponible aussi: POST /api/admin/upload
- Content-Type: multipart/form-data
- Champs form-data:
  - video (fichier, obligatoire)
  - title (optionnel)
  - courseSlug (optionnel)
  - chapterOrder (optionnel)
- Contraintes backend:
  - Le fichier doit avoir un mimetype video/*
  - Taille max: 2GB (sinon 400)
  - title/courseSlug/chapterOrder sont sanitizes en slug (a-z0-9 + tirets)
  - Si title absent: video
  - Si courseSlug absent: cours
  - Si chapterOrder absent: 0

Reponse attendue:

```json
{
  "message": "Upload video reussi.",
  "publicId": "formations/masterclasseditgn/chapter-1/1712910012345-video-1-a1b2c3d4.mp4",
  "fileId": "4_z943feaea53fc843a90d9001f_f114531abc91bd2a2_d20260417_m155009_c003_v0312031_t0038_u01776441009538"
}
```

Le frontend doit ensuite envoyer ces valeurs dans `POST /api/admin/videos` avec ce mapping:

- `fileId` -> `b2FileId`
- `publicId` -> `b2FileName`

Flux frontend recommande (obligatoire pour lier upload + metadata):

1. Upload du fichier brut vers B2 via POST /api/dashboardinformation/upload
2. Creation de l'entree video Mongo via POST /api/admin/videos avec b2FileId + b2FileName

Exemple payload etape 2:

```json
{
  "courseSlug": "masterclasseditgn",
  "title": "Video 1",
  "b2FileId": "<fileId recu a l'etape 1>",
  "b2FileName": "<publicId recu a l'etape 1>",
  "order": 1,
  "duration": 540,
  "description": "Premiere video"
}
```

Erreurs frequentes cote upload admin:

- 400: pas de fichier video, mauvais type, ou fichier > 2GB
- 401/403: token absent/invalide ou non admin
- 500: variables B2 manquantes (B2_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET_ID)

### Mise a jour admin

- PUT /api/admin/courses/:courseId
- PUT /api/admin/chapters/:chapterId
- PUT /api/admin/videos/:videoId

#### Basculer une video active/inactive (admin)

Le basculement se fait via la route de mise a jour video:

- PUT /api/admin/videos/:videoId

Body JSON minimal:

```json
{
  "isActive": false
}
```

- `isActive: false` => masque/desactive la video
- `isActive: true` => reactive la video
- Le champ doit etre un boolean (`true` ou `false`), sinon la route renvoie `400`

Exemple Postman:

- Method: `PUT`
- URL: `http://localhost:3000/api/admin/videos/ID_VIDEO`
- Header: `Authorization: Bearer <TOKEN_ADMIN>`
- Header: `Content-Type: application/json`
- Body: `{"isActive": false}`

### Suppression admin

- DELETE /api/admin/courses/:courseId
- DELETE /api/admin/chapters/:chapterId
- DELETE /api/admin/videos/:videoId

Important (etat actuel du code):

- DELETE /api/admin/courses/:courseId supprime le cours + chapitres + videos en base Mongo
- DELETE /api/admin/chapters/:chapterId supprime uniquement le chapitre en base Mongo
- DELETE /api/admin/videos/:videoId supprime uniquement la video en base Mongo
- Aucun DELETE admin ne supprime actuellement le fichier Backblaze B2

## 7) Cote client: lire le cours et la video

### Recuperer un cours complet

- GET /api/courses/:courseSlug
- Ex: /api/courses/masterclasseditgn
- Auth: token optionnel (route accessible sans token)
- Reponse: course + chapters + videos + progression utilisateur (si token valide)

### Demander une URL video signee

- GET /api/videos/:videoId/url
- Reponse:

```json
{
  "url": "https://cdn.votre-domaine.com/formations/masterclasseditgn/chapter-1/1712910012345-video-1-a1b2c3d4.mp4",
  "expiresAt": 1775750885,
  "videoTitle": "Video 1"
}
```

La valeur url est temporaire (expire vite). Si elle expire, il faut rappeler le backend pour en generer une nouvelle.

### Marquer une video comme vue

- POST /api/videos/:videoId/mark-watched

```json
{
  "watchedDuration": 320
}
```

### Route debug CDN (dev)

- GET /api/videos/:videoId/check
- Permet de verifier si le `publicId` est accessible via le CDN.

## 8) Securite appliquee

- JWT requis sur routes protegees (admin, username, userpassword, changestatusclient)
- Role admin exige sur /api/admin/*
- status client exige pour l'URL video signee et mark-watched
- URL videos generees depuis le CDN
- Rate limit sur demande d'URL video
- Headers no-store/no-cache sur reponse URL signee
- Secrets B2 conserves cote backend uniquement
- Validation des inputs (order, IDs, doublons, etc.)

## 9) Point d'attention important pour le frontend

Le backend actuel ne stocke pas de champ chapterId dans le modele Video. Consequences:

- POST /api/admin/videos ne prend pas chapterId
- GET /api/admin/chapters/:chapterId/videos retourne les videos du cours, pas un filtrage strict par chapitre

Si le frontend doit absolument afficher des videos par chapitre avec certitude, il faut ajouter chapterId dans le modele + routes backend.

## 10) Codes d'erreur frequents

- 400: payload invalide (champ manquant ou type incorrect)
- 401: token manquant/invalide
- 403: role/status insuffisant
- 404: resource non trouvee (cours/chapitre/video)
- 409: doublon (slug, order, publicId)
- 429: trop de requetes (rate limit)
- 500: erreur serveur/config manquante

## 11) Tableau recap des routes

| Methode | Route | Auth | Description |
|---|---|---|---|
| GET | /api/auth/google | Non | Demarre OAuth Google |
| GET | /api/auth/google/callback | Non | Callback Google |
| GET | /api/auth/google/failure | Non | Echec OAuth Google |
| POST | /api/auth/register | Non | Creation compte |
| POST | /api/auth/login | Non | Login client |
| POST | /api/auth/admin-login | Non | Login admin |
| POST | /api/auth/forgot-password | Non | Demande reset |
| POST | /api/auth/reset-password | Non | Validation reset |
| GET | /api/auth/user/:id | Non | Username par id |
| POST | /api/username/me | Oui (JWT) | Profil courant |
| PUT | /api/username/edit-username | Oui (JWT) | Modifier username |
| PUT | /api/userpassword/change-password | Oui (JWT) | Changer mot de passe |
| PUT | /api/password/change-password | Oui (JWT) | Alias mot de passe |
| PUT | /api/changestatusclient/:id/validate | Oui (Admin) | Valider/invalider client |
| GET | /api/dashboardinformation/clients | Oui (Admin) | Liste clients |
| GET | /api/admin/courses | Oui (Admin) | Lister formations |
| GET | /api/admin/courses/:courseId/chapters | Oui (Admin) | Lister chapitres d'une formation |
| GET | /api/admin/chapters/:chapterId/videos | Oui (Admin) | Lister videos d'un chapitre |
| POST | /api/admin/courses | Oui (Admin) | Creer formation |
| POST | /api/admin/chapters | Oui (Admin) | Creer chapitre |
| POST | /api/admin/videos | Oui (Admin) | Creer video (b2FileId + b2FileName) |
| POST | /api/dashboardinformation/upload | Oui (Admin) | Upload video vers B2 |
| POST | /api/admin/upload | Oui (Admin) | Alias upload video vers B2 |
| PUT | /api/admin/courses/:courseId | Oui (Admin) | Modifier formation |
| PUT | /api/admin/chapters/:chapterId | Oui (Admin) | Modifier chapitre |
| PUT | /api/admin/videos/:videoId | Oui (Admin) | Modifier video (dont `isActive`) |
| DELETE | /api/admin/courses/:courseId | Oui (Admin) | Supprimer formation (cascade chapitres/videos) |
| DELETE | /api/admin/chapters/:chapterId | Oui (Admin) | Supprimer chapitre |
| DELETE | /api/admin/videos/:videoId | Oui (Admin) | Supprimer video |
| GET | /api/courses/:courseSlug | Optionnel | Lire cours complet |
| GET | /api/videos/:videoId/url | Oui (Client avec status=true) | URL video signee |
| POST | /api/videos/:videoId/mark-watched | Oui (Client avec status=true) | Marquer video vue |
| GET | /api/videos/:videoId/check | Oui (JWT requis) | Debug existence CDN |