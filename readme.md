# API Backend - Guide Frontend Complet

Ce README explique comment brancher le frontend sur toutes les fonctionnalites backend actuellement exposees.

## Base URL

Utilise une variable globale dans le frontend:

```js
const BACK_URL = "https://smail-app-production.up.railway.app";
```

## Endpoints disponibles

Le serveur monte les routes suivantes:

- `/api/auth`
- `/api/username`
- `/api/userpassword`
- `/api/password`
- `/api/changestatusclient`
- `/api/dashboardinformation`

La route `/api/password` pointe vers le meme fichier que `/api/userpassword`.

## Client API conseille (frontend)

```js
const BACK_URL = "https://smail-app-production.up.railway.app";

const authHeaders = () => {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

async function api(path, options = {}) {
  const res = await fetch(`${BACK_URL}${path}`, {
    ...options,
    headers: {
      ...authHeaders(),
      ...(options.headers || {}),
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || "Erreur serveur");
  }
  return data;
}
```

## 1) Authentification

### Google OAuth

- Demarrer le flow avec un lien navigateur (pas avec fetch):

```html
<a href="https://smail-app-production.up.railway.app/api/auth/google">
  Continuer avec Google
</a>
```

- En succes, le backend redirige vers:
  `CLIENT_URL/auth-callback.html?token=...`

- Cote frontend, dans `auth-callback.html`, recuperer `token` et le stocker:

```js
const params = new URLSearchParams(window.location.search);
const token = params.get("token");
if (token) {
  localStorage.setItem("token", token);
  window.location.href = "/dashboard";
} else {
  window.location.href = "/login";
}
```

### Register

- `POST /api/auth/register`

```js
await api("/api/auth/register", {
  method: "POST",
  body: JSON.stringify({
    username: "john_doe",
    email: "john@example.com",
    password: "monMotDePasse123",
  }),
});
```

### Login

- `POST /api/auth/login`

```js
const data = await api("/api/auth/login", {
  method: "POST",
  body: JSON.stringify({
    email: "john@example.com",
    password: "monMotDePasse123",
  }),
});
localStorage.setItem("token", data.token);
```

### Forgot password

- `POST /api/auth/forgot-password`

```js
await api("/api/auth/forgot-password", {
  method: "POST",
  body: JSON.stringify({ email: "john@example.com" }),
});
```

### Reset password

- `POST /api/auth/reset-password`

```js
const token = new URLSearchParams(window.location.search).get("token");
await api("/api/auth/reset-password", {
  method: "POST",
  body: JSON.stringify({
    token,
    newPassword: "nouveauMotDePasse123",
  }),
});
```

### Recuperer username par ID

- `GET /api/auth/user/:id`

```js
const user = await api(`/api/auth/user/${userId}`, { method: "GET" });
console.log(user.username);
```

## 2) Username utilisateur (token requis)

### Recuperer mon username

- `POST /api/username/me`

```js
const data = await api("/api/username/me", { method: "POST" });
console.log(data.username);
```

### Modifier mon username

- `PUT /api/username/edit-username`

```js
const data = await api("/api/username/edit-username", {
  method: "PUT",
  body: JSON.stringify({ newUsername: "nouveauPseudo" }),
});
console.log(data.username);
```

## 3) Changer mot de passe connecte (token requis)

Routes equivalentes:

- `PUT /api/userpassword/change-password`
- `PUT /api/password/change-password`

Le backend accepte soit `currentPassword`, soit `password` comme ancien mot de passe.

```js
await api("/api/userpassword/change-password", {
  method: "PUT",
  body: JSON.stringify({
    currentPassword: "ancienMotDePasse123",
    newPassword: "nouveauMotDePasse123",
  }),
});
```

## 4) Validation client (admin)

- `PUT /api/changestatusclient/:id/validate`
- Body attendu: `{ "status": true }` ou `{ "status": false }`
- Cette route est protegee par middleware admin.

```js
await api(`/api/changestatusclient/${clientId}/validate`, {
  method: "PUT",
  body: JSON.stringify({ status: true }),
});
```

## 5) Donnees du dashboard admin

- `GET /api/dashboardinformation/clients`
- Cette route est reservee aux administrateurs.
- Elle renvoie tous les clients avec `username`, `email` et `status`.

```js
const data = await api("/api/dashboardinformation/clients", {
  method: "GET",
});

console.log(data.clients);
```

### Exemple React

```jsx
import { useEffect, useState } from "react";

export default function AdminClientsTable() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadClients = async () => {
      try {
        const data = await api("/api/dashboardinformation/clients", {
          method: "GET",
        });
        setClients(data.clients || []);
      } finally {
        setLoading(false);
      }
    };

    loadClients();
  }, []);

  if (loading) return <p>Chargement...</p>;

  return (
    <table>
      <thead>
        <tr>
          <th>Username</th>
          <th>Email</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {clients.map((client) => (
          <tr key={client._id}>
            <td>{client.username}</td>
            <td>{client.email}</td>
            <td>{client.status ? "Valide" : "Non valide"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

## Gestion du token JWT

- Login et Google renvoient un token JWT.
- Le token expire apres 1h.
- L'envoyer dans `Authorization: Bearer <token>`.
- En cas de 401, deconnecter l'utilisateur et renvoyer vers login.

## Tableau recap des routes backend

| Methode | Route | Auth | Description |
|---|---|---|---|
| GET | /api/auth/google | Non | Demarre OAuth Google |
| GET | /api/auth/google/callback | Non | Callback Google (automatique) |
| GET | /api/auth/google/failure | Non | Echec OAuth Google |
| POST | /api/auth/register | Non | Creation de compte |
| POST | /api/auth/login | Non | Login email/password |
| POST | /api/auth/forgot-password | Non | Demande reset mot de passe |
| POST | /api/auth/reset-password | Non | Validation reset mot de passe |
| GET | /api/auth/user/:id | Non | Username par id |
| POST | /api/username/me | Oui (JWT) | Username du user connecte |
| PUT | /api/username/edit-username | Oui (JWT) | Modifier username |
| PUT | /api/userpassword/change-password | Oui (JWT) | Changer mot de passe |
| PUT | /api/password/change-password | Oui (JWT) | Alias de change-password |
| PUT | /api/changestatusclient/:id/validate | Oui (Admin) | Valider ou invalider un client |
| GET | /api/dashboardinformation/clients | Oui (Admin) | Lister tous les clients avec username, email et status |

## Important

- Le backend contient un fichier video (`routes/getTheVideo.js`) mais cette route n'est pas montee dans le serveur actuel.
- Donc le frontend ne peut pas encore appeler d'endpoint video tant que cette route n'est pas branchee dans [back/server.js](back/server.js).