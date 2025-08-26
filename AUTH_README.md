# Système d'Authentification

Ce document explique comment utiliser le système d'authentification complet qui a été ajouté à votre application.

## 🚀 Fonctionnalités Ajoutées

- ✅ **Enregistrement d'utilisateur** avec confirmation par email
- ✅ **Connexion utilisateur** avec protection contre les attaques par force brute
- ✅ **Confirmation d'email** obligatoire avant connexion
- ✅ **Réinitialisation de mot de passe** par email
- ✅ **Modification de mot de passe** pour utilisateurs connectés
- ✅ **Protection des routes** avec middleware d'authentification
- ✅ **Gestion des rôles** (agent/admin)
- ✅ **Verrouillage de compte** après 5 tentatives échouées

## 📋 Configuration Requise

### 1. Installer les nouvelles dépendances

```bash
npm install jsonwebtoken nodemailer
```

### 2. Variables d'environnement

Ajoutez ces variables à votre fichier `.env` :

```env
# JWT Configuration
JWT_SECRET=your_jwt_secret_key_here_change_this_in_production
JWT_EXPIRES_IN=7d

# Configuration Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
SMTP_FROM=noreply@yourapp.com
```

**⚠️ Important :** 
- Changez `JWT_SECRET` par une clé secrète forte en production
- Configurez vos identifiants SMTP pour l'envoi d'emails

## 🔗 Routes d'Authentification

### POST `/api/auth/register`
Enregistrer un nouvel utilisateur
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "motdepasse123",
  "role": "agent" // optionnel, par défaut "agent"
}
```

### POST `/api/auth/login`
Connecter un utilisateur
```json
{
  "email": "john@example.com",
  "password": "motdepasse123"
}
```

### GET `/api/auth/confirm-email/:token`
Confirmer l'email (lien envoyé par email)

### POST `/api/auth/forgot-password`
Demander la réinitialisation du mot de passe
```json
{
  "email": "john@example.com"
}
```

### POST `/api/auth/reset-password/:token`
Réinitialiser le mot de passe
```json
{
  "password": "nouveaumotdepasse123"
}
```

### POST `/api/auth/change-password`
Modifier le mot de passe (utilisateur connecté)
```json
{
  "currentPassword": "ancienMotDePasse",
  "newPassword": "nouveauMotDePasse123"
}
```

### GET `/api/auth/current`
Obtenir les informations de l'utilisateur connecté

## 🛡️ Protection des Routes

### Utilisation du Middleware

```javascript
const { authenticate, authorize, optionalAuth } = require('./middleware/auth');

// Route protégée (authentification requise)
router.get('/protected', authenticate, (req, res) => {
  res.json({ user: req.user });
});

// Route admin seulement
router.get('/admin-only', authenticate, authorize('admin'), (req, res) => {
  res.json({ message: 'Accès admin' });
});

// Route avec authentification optionnelle
router.get('/public', optionalAuth, (req, res) => {
  const message = req.user ? `Bonjour ${req.user.name}` : 'Bonjour visiteur';
  res.json({ message });
});
```

### Types de Middleware

1. **`authenticate`** : Authentification obligatoire
2. **`authorize(...roles)`** : Vérification des rôles (après authenticate)
3. **`optionalAuth`** : Authentification optionnelle

## 📧 Configuration Email

### Gmail
1. Activez l'authentification à 2 facteurs
2. Générez un mot de passe d'application
3. Utilisez ce mot de passe dans `SMTP_PASS`

### Autres fournisseurs
Adaptez `SMTP_HOST` et `SMTP_PORT` selon votre fournisseur.

## 🔒 Sécurité

- Mots de passe hachés avec bcrypt
- Tokens JWT sécurisés
- Protection contre les attaques par force brute
- Verrouillage automatique des comptes
- Tokens de réinitialisation avec expiration courte (10 min)
- Tokens de confirmation email avec expiration (24h)

## 📝 Exemple d'Utilisation Frontend

```javascript
// Connexion
const login = async (email, password) => {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  
  const data = await response.json();
  if (data.success) {
    localStorage.setItem('token', data.data.token);
  }
};

// Requête authentifiée
const makeAuthRequest = async (url) => {
  const token = localStorage.getItem('token');
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return response.json();
};
```

## 🚨 Messages d'Erreur

- `401` : Token manquant, invalide, ou email non confirmé
- `423` : Compte verrouillé (trop de tentatives)
- `403` : Accès refusé (rôle insuffisant)
- `400` : Données invalides
- `404` : Utilisateur non trouvé

## 🔄 Prochaines Étapes

1. Testez les routes avec Postman ou votre frontend
2. Personnalisez les templates d'email
3. Ajoutez la protection aux routes existantes
4. Configurez votre serveur SMTP en production
