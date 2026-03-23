# 🔐 Auth API — Documentation Frontend
# Destinée au développeur frontend et responsable UX Abdou Amalou

> Base URL :  let backUrl = smail-app-production.up.railway.app




---

## 📋 Table des matières

- [Google OAuth — Se connecter avec Google](#1-google-oauth--se-connecter-avec-google)
- [Register — Créer un compte](#2-register--créer-un-compte)
- [Login — Se connecter](#3-login--se-connecter)
- [Forgot Password — Mot de passe oublié](#4-forgot-password--mot-de-passe-oublié)
- [Reset Password — Réinitialiser le mot de passe](#5-reset-password--réinitialiser-le-mot-de-passe)
- [Utiliser le token JWT](#utiliser-le-token-jwt)
- [Gestion des erreurs](#gestion-des-erreurs)

---

## 1. Google OAuth — Se connecter avec Google

### Flow complet

```
Utilisateur clique "Google"
        ↓
GET /api/auth/google   (redirige vers Google)
        ↓
Google demande confirmation à l'utilisateur
        ↓
GET /api/auth/google/callback   (Google rappelle le backend)
        ↓
Backend génère un JWT et redirige vers :
https://ton-frontend.com/auth/callback?token=eyJhbGc...
        ↓
Frontend récupère le token depuis l'URL et le stocke
```

---

### `GET /api/auth/google`

Lance le processus d'authentification Google. À appeler via un simple lien ou bouton.

```html
<!-- Dans ton HTML / JSX -->
<a href="https://ton-backend.com/api/auth/google">
  Se connecter avec Google
</a>
```

> ⚠️ Ne pas appeler avec `fetch` — c'est une redirection navigateur, pas une requête AJAX.

---

### `GET /api/auth/google/callback`

Route appelée automatiquement par Google après connexion. **Tu n'appelles pas cette route toi-même.**

**En cas de succès**, le backend redirige vers :
```
https://ton-frontend.com/auth/callback?token=eyJhbGc...
```

**En cas d'échec**, retourne :
```json
{
  "message": "Échec de l'authentification Google."
}
```

---

### Page frontend `/auth/callback`

Crée cette page dans ton frontend pour récupérer le token :

```javascript
// AuthCallback.jsx
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    if (token) {
      localStorage.setItem("token", token);
      navigate("/dashboard"); // redirige après stockage
    } else {
      navigate("/login"); // échec
    }
  }, []);

  return <p>Connexion en cours...</p>;
}
```

---

## 2. Register — Créer un compte

### `POST /api/auth/register`

Crée un nouveau compte utilisateur avec email et mot de passe.

### Request

**Headers**
```
Content-Type: application/json
```

**Body**
```json
{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "monMotDePasse123"
}
```

| Champ      | Type   | Requis | Description                        |
|------------|--------|--------|------------------------------------|
| `username` | string | ✅ oui  | Nom d'utilisateur                  |
| `email`    | string | ✅ oui  | Adresse email unique               |
| `password` | string | ✅ oui  | Mot de passe (minimum 8 caractères)|

### Responses

**✅ 201 — Succès**
```json
{
  "message": "Utilisateur créé avec succès."
}
```

**❌ 400 — Champs manquants**
```json
{
  "message": "Tous les champs sont requis."
}
```

**❌ 400 — Email déjà utilisé**
```json
{
  "message": "Email déjà utilisé."
}
```

**❌ 500 — Erreur serveur**
```json
{
  "message": "Erreur serveur."
}
```

### Exemple avec `fetch`

```javascript
const register = async (username, email, password) => {
  const response = await fetch("https://ton-backend.com/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, email, password }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message);
  }

  return data;
};
```

### Exemple avec `axios`

```javascript
import axios from "axios";

const register = async (username, email, password) => {
  try {
    const { data } = await axios.post("https://ton-backend.com/api/auth/register", {
      username,
      email,
      password,
    });
    return data;
  } catch (error) {
    throw new Error(error.response?.data?.message || "Erreur serveur");
  }
};
```

---

## 3. Login — Se connecter

### `POST /api/auth/login`

Authentifie un utilisateur et retourne un **token JWT**.

> ⚠️ Si l'utilisateur s'est inscrit via Google, il ne peut pas se connecter ici avec un mot de passe.

### Request

**Headers**
```
Content-Type: application/json
```

**Body**
```json
{
  "email": "john@example.com",
  "password": "monMotDePasse123"
}
```

| Champ      | Type   | Requis | Description   |
|------------|--------|--------|---------------|
| `email`    | string | ✅ oui  | Adresse email |
| `password` | string | ✅ oui  | Mot de passe  |

### Responses

**✅ 200 — Succès**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

> ⚠️ Le token expire après **1 heure**.

**❌ 400 — Champs manquants**
```json
{
  "message": "Email et mot de passe requis."
}
```

**❌ 400 — Email introuvable**
```json
{
  "message": "Email introuvable."
}
```

**❌ 400 — Compte Google**
```json
{
  "message": "Ce compte utilise Google. Connectez-vous avec Google."
}
```

**❌ 400 — Mot de passe incorrect**
```json
{
  "message": "Mot de passe incorrect."
}
```

**❌ 500 — Erreur serveur**
```json
{
  "message": "Erreur serveur."
}
```

### Exemple avec `fetch`

```javascript
const login = async (email, password) => {
  const response = await fetch("https://ton-backend.com/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message);
  }

  localStorage.setItem("token", data.token);
  return data.token;
};
```

### Exemple avec `axios`

```javascript
import axios from "axios";

const login = async (email, password) => {
  try {
    const { data } = await axios.post("https://ton-backend.com/api/auth/login", {
      email,
      password,
    });
    localStorage.setItem("token", data.token);
    return data.token;
  } catch (error) {
    throw new Error(error.response?.data?.message || "Erreur serveur");
  }
};
```

---

## 4. Forgot Password — Mot de passe oublié

### `POST /api/auth/forgot-password`

Génère un lien de réinitialisation de mot de passe.

> 📌 Le lien est actuellement affiché en console côté serveur (mode dev). Il sera envoyé par email en production.

### Request

**Headers**
```
Content-Type: application/json
```

**Body**
```json
{
  "email": "john@example.com"
}
```

| Champ   | Type   | Requis | Description   |
|---------|--------|--------|---------------|
| `email` | string | ✅ oui  | Adresse email |

### Responses

**✅ 200 — Succès (même réponse si l'email n'existe pas — sécurité)**
```json
{
  "message": "Si cet email existe, un lien de réinitialisation a été envoyé."
}
```

**❌ 400 — Email manquant**
```json
{
  "message": "Email requis."
}
```

**❌ 500 — Erreur serveur**
```json
{
  "message": "Erreur serveur."
}
```

### Exemple avec `fetch`

```javascript
const forgotPassword = async (email) => {
  const response = await fetch("https://ton-backend.com/api/auth/forgot-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message);
  }

  return data;
};
```

---

## 5. Reset Password — Réinitialiser le mot de passe

### `POST /api/auth/reset-password`

Réinitialise le mot de passe avec le token reçu dans l'email.

### Flow

```
1. Utilisateur reçoit un email avec un lien :
   https://ton-frontend.com/reset-password?token=a3f9c2...

2. La page /reset-password récupère le token depuis l'URL :
   const token = new URLSearchParams(window.location.search).get("token");

3. L'utilisateur saisit son nouveau mot de passe

4. Le frontend envoie token + newPassword dans le body au backend
```

### Request

**Headers**
```
Content-Type: application/json
```

**Body**
```json
{
  "token": "a3f9c2d8e1f4b7a2c9d3e6f1a4b8c2d5e9f3a7b1c4d8e2f6a9b3c7d1e5f2a8",
  "newPassword": "nouveauMotDePasse123"
}
```

| Champ         | Type   | Requis | Description                             |
|---------------|--------|--------|-----------------------------------------|
| `token`       | string | ✅ oui  | Token reçu dans l'URL de l'email        |
| `newPassword` | string | ✅ oui  | Nouveau mot de passe (minimum 8 caractères) |

### Responses

**✅ 200 — Succès**
```json
{
  "message": "Mot de passe mis à jour avec succès."
}
```

**❌ 400 — Champs manquants**
```json
{
  "message": "Token et nouveau mot de passe requis."
}
```

**❌ 400 — Mot de passe trop court**
```json
{
  "message": "Le mot de passe doit contenir au moins 8 caractères."
}
```

**❌ 400 — Token invalide ou expiré**
```json
{
  "message": "Token invalide ou expiré."
}
```

**❌ 500 — Erreur serveur**
```json
{
  "message": "Erreur serveur."
}
```

### Exemple avec `fetch`

```javascript
const resetPassword = async (token, newPassword) => {
  const response = await fetch("https://ton-backend.com/api/auth/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, newPassword }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message);
  }

  return data;
};

// Usage dans la page /reset-password
const token = new URLSearchParams(window.location.search).get("token");
await resetPassword(token, "nouveauMotDePasse123");
```

---

## Utiliser le token JWT

Une fois connecté (via login ou Google), ajoute le token dans le header `Authorization` de chaque requête protégée.

```javascript
const token = localStorage.getItem("token");

const response = await fetch("https://ton-backend.com/api/protected-route", {
  headers: {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json",
  },
});
```

### Avec axios — intercepteur global

```javascript
import axios from "axios";

// Ajoute automatiquement le token à toutes les requêtes
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Gère l'expiration du token (401)
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);
```

---

## Gestion des erreurs

Tableau récapitulatif de tous les codes d'erreur :

| Code | Route                | Message                                              | Cause                                  |
|------|----------------------|------------------------------------------------------|----------------------------------------|
| 400  | /register            | "Tous les champs sont requis."                       | username, email ou password manquant   |
| 400  | /register            | "Email déjà utilisé."                                | Email déjà en base                     |
| 400  | /login               | "Email et mot de passe requis."                      | Champs manquants                       |
| 400  | /login               | "Email introuvable."                                 | Aucun compte avec cet email            |
| 400  | /login               | "Ce compte utilise Google. Connectez-vous avec Google." | Compte créé via Google              |
| 400  | /login               | "Mot de passe incorrect."                            | Mauvais mot de passe                   |
| 400  | /forgot-password     | "Email requis."                                      | Email manquant                         |
| 400  | /reset-password      | "Token et nouveau mot de passe requis."              | Champs manquants                       |
| 400  | /reset-password      | "Le mot de passe doit contenir au moins 8 caractères." | Mot de passe trop court              |
| 400  | /reset-password      | "Token invalide ou expiré."                          | Token inexistant ou expiré (> 1h)      |
| 401  | /google/failure      | "Échec de l'authentification Google."                | Google a refusé ou annulé             |
| 500  | toutes               | "Erreur serveur."                                    | Problème côté serveur                  |

---

## Résumé des routes

| Méthode | Route                        | Description                        | Auth requise |
|---------|------------------------------|------------------------------------|--------------|
| GET     | /api/auth/google             | Lance le flow Google OAuth         | ❌ non        |
| GET     | /api/auth/google/callback    | Callback Google (automatique)      | ❌ non        |
| GET     | /api/auth/google/failure     | Échec Google                       | ❌ non        |
| POST    | /api/auth/register           | Créer un compte                    | ❌ non        |
| POST    | /api/auth/login              | Se connecter                       | ❌ non        |
| POST    | /api/auth/forgot-password    | Demander un reset                  | ❌ non        |
| POST    | /api/auth/reset-password     | Réinitialiser le mot de passe      | ❌ non        |

---

> 📌 **Notes importantes :**
> - Le token JWT contient l'`id` de l'utilisateur et expire après **1h**
> - Le token de reset password expire après **1h**
> - Un compte Google ne peut pas se connecter avec email/password et vice versa
> - Le forgot-password retourne toujours la même réponse (sécurité anti-énumération)