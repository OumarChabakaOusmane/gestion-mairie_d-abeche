# WenaKlabs - Gestion Municipale

Solution complète de gestion municipale moderne développée avec Node.js, MongoDB et Socket.IO.

## 🚀 Fonctionnalités

- **Gestion des Actes** : Naissance, mariage, décès avec génération automatique de documents
- **Documents & Rapports** : Génération PDF, archivage numérique, statistiques
- **Messagerie Temps Réel** : Communication entre services avec Socket.IO
- **Calendrier** : Planification d'événements et rendez-vous municipaux
- **Gestion Utilisateurs** : Système de rôles et permissions sécurisé
- **Tableau de Bord** : Vue d'ensemble avec indicateurs de performance
- **Gestion des Comptes** : Gestion des comptes utilisateurs

## Technologies

- **Backend** : Node.js, Express.js
- **Base de données** : MongoDB avec Mongoose
- **Authentification** : JWT (JSON Web Tokens)
- **Temps réel** : Socket.IO
- **Sécurité** : Helmet, CORS, Rate Limiting, Validation des données
- **Documents** : PDFKit, jsPDF
- **Email** : Nodemailer

## Prérequis

- Node.js (v16 ou supérieur)
- MongoDB (v4.4 ou supérieur)
- npm ou yarn

## Installation

1. **Cloner le projet**
```bash
git clone <repository-url>
cd wenaklabs
```

2. **Installer les dépendances**
```bash
npm install
```

3. **Configuration**
```bash
cp .env.example .env
# Modifier les variables dans .env
```

4. **Variables d'environnement requises**
```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/mairie
JWT_SECRET=your_secure_jwt_secret_here
JWT_EXPIRES_IN=7d
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
CORS_ORIGIN=http://localhost:3000
```

## Démarrage

**Mode développement**
```bash
npm run dev
```

**Mode production**
```bash
npm start
```

L'application sera accessible sur `http://localhost:3000`

## PDF en Arabe (RTL)

- **Dépendances RTL**
  - Installer le shaping arabe et le réordonnancement visuel:
  ```bash
  npm i arabic-reshaper bidi-js
  ```

- **Polices arabes**
  - Placez une police arabe dans `public/fonts/` (au moins l'une de):
    - `public/fonts/Amiri-Regular.ttf`
    - `public/fonts/NotoNaskhArabic-Regular.ttf`
  - Le service détecte aussi ces chemins si vous avez extrait un dossier:
    - `public/fonts/Amiri-Regular.ttf/Amiri-Regular.ttf`
  - Les logs indiquent si la police a été trouvée.

- **Fichier de génération PDF**
  - `services/pdfService.js` est le service utilisé par la route `/api/actes/:id/pdf`.
  - Le service prend en charge les types d'actes suivants : naissance, mariage, décès et divorce.

- **Où ajuster le rendu arabe**
  - La génération de PDF utilise maintenant le service unifié `pdfService`.
  - Les modèles de PDF sont gérés dans le service avec une structure standardisée.
  - Pour modifier le rendu, consultez les fonctions de génération dans `services/pdfService.js`.

- **Regénérer un PDF**
  - Redémarrez l'application après chaque changement de code: `node app.js`.
  - Générez un PDF via l'interface (ou `/api/actes/:id/pdf`).

- **Dépannage rapide**
  - Texte arabe inversé ou non connecté:
    - Vérifiez la présence d'une police arabe dans `public/fonts/`.
    - Assurez-vous que les libellés sont correctement formatés pour l'arabe.
    - Consultez les logs du serveur pour les erreurs de génération de PDF.
    - Redémarrez le serveur pour recharger les modules.

## Structure du projet

```
wenaklabs/
├── config/          # Configuration (email, etc.)
├── middleware/      # Middlewares (authentification)
├── models/          # Modèles MongoDB
│   ├── User.js
│   ├── Acte.js
│   ├── Document.js
│   └── ...
├── routes/          # Routes API
│   ├── auth.js
│   ├── actes.js
│   ├── documents.js
│   └── ...
├── views/           # Pages HTML
├── public/          # Assets statiques (CSS, JS, images)
├── uploads/         # Fichiers uploadés
├── app.js           # Point d'entrée principal
└── package.json
```

## Authentification

Le système utilise JWT pour l'authentification :
- Tokens stockés dans les cookies HTTP-only
- Middleware d'authentification sur toutes les routes protégées
- Système de rôles (admin, utilisateur)

## API Endpoints

### Authentification
- `POST /api/auth/login` - Connexion
- `POST /api/auth/register` - Inscription
- `POST /api/auth/logout` - Déconnexion
- `POST /api/auth/forgot-password` - Mot de passe oublié

### Actes
- `GET /api/actes` - Liste des actes
- `POST /api/actes` - Créer un acte
- `PUT /api/actes/:id` - Modifier un acte
- `DELETE /api/actes/:id` - Supprimer un acte

### Documents
- `GET /api/documents` - Liste des documents
- `POST /api/documents/upload` - Upload de document
- `GET /api/documents/:id/download` - Télécharger un document

## 💬 Messagerie Temps Réel

Socket.IO est configuré avec :
- Limitation des connexions par IP (max 5)
- Timeout d'inactivité (30 minutes)
- Validation des données des messages
- Gestion des salles de conversation

## 🔒 Sécurité

- **Helmet** : Headers de sécurité HTTP
- **CORS** : Configuration des origines autorisées
- **Rate Limiting** : Limitation des requêtes
- **Validation** : express-validator pour les données d'entrée
- **Sanitization** : Protection contre les injections MongoDB
- **HPP** : Protection contre la pollution des paramètres

## 📊 Base de données

### Modèles principaux
- **User** : Utilisateurs du système
- **Acte** : Actes d'état civil
- **Document** : Documents et fichiers
- **Conversation** : Conversations de messagerie
- **Message** : Messages individuels

## 🧪 Tests

```bash
npm test
```

## 📝 Logs

Les logs sont affichés dans la console en mode développement.
Pour la production, configurer un système de logs approprié.

## 🤝 Contribution

1. Fork le projet
2. Créer une branche feature (`git checkout -b feature/nouvelle-fonctionnalite`)
3. Commit les changements (`git commit -am 'Ajouter nouvelle fonctionnalité'`)
4. Push vers la branche (`git push origin feature/nouvelle-fonctionnalite`)
5. Créer une Pull Request

## 📄 Licence

Ce projet est sous licence ISC.

## 🆘 Support


