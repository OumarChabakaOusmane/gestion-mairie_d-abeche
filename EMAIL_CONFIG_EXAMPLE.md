# Configuration Email pour l'Application État Civil Tchad

## Problème actuel
La fonctionnalité de mot de passe oublié nécessite une configuration email SMTP pour fonctionner correctement.

## Solution
Créez un fichier `.env` à la racine du projet avec la configuration suivante :

### 1. Configuration de base
```bash
# Configuration du serveur
PORT=3007

# Configuration MongoDB
MONGODB_URI=mongodb://localhost:27017/etat_civil_tchad

# Configuration JWT
JWT_SECRET=votre_secret_jwt_tres_securise_ici
JWT_EXPIRES_IN=7d

# Configuration CORS
CORS_ORIGIN=http://localhost:3007
```

### 2. Configuration Email (SMTP)

#### Option A : Gmail (Recommandé pour les tests)
```bash
# Configuration Email Gmail
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=votre_email@gmail.com
SMTP_PASS=votre_mot_de_passe_d_application
SMTP_FROM=noreply@etatcivil-tchad.com
```

**⚠️ Important pour Gmail :**
1. Activez l'authentification à 2 facteurs sur votre compte Gmail
2. Générez un "mot de passe d'application" dans les paramètres de sécurité
3. Utilisez ce mot de passe d'application, PAS votre mot de passe principal

#### Option B : Autres fournisseurs SMTP
```bash
# Exemple avec Outlook/Hotmail
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_USER=votre_email@outlook.com
SMTP_PASS=votre_mot_de_passe
SMTP_FROM=noreply@etatcivil-tchad.com

# Exemple avec un serveur SMTP personnalisé
SMTP_HOST=votre_serveur_smtp.com
SMTP_PORT=587
SMTP_USER=votre_utilisateur
SMTP_PASS=votre_mot_de_passe
SMTP_FROM=noreply@votre_domaine.com
```

## Étapes de configuration

### 1. Créer le fichier .env
```bash
# Dans le terminal, à la racine du projet
touch .env
```

### 2. Éditer le fichier .env
```bash
# Ouvrir avec votre éditeur préféré
nano .env
# ou
code .env
```

### 3. Ajouter la configuration
Copiez et modifiez la configuration ci-dessus selon votre fournisseur email.

### 4. Redémarrer le serveur
```bash
# Arrêter le serveur actuel (Ctrl+C)
# Puis redémarrer
node app.js
```

## Test de la configuration

### 1. Vérifier que le serveur démarre sans erreur
Vous devriez voir : "Transporteur email configuré avec succès"

### 2. Tester la fonctionnalité
1. Allez sur `/forgot-password`
2. Entrez un email valide d'un utilisateur existant
3. Vérifiez que vous recevez un email de réinitialisation

## Dépannage

### Erreur : "Service email non configuré"
- Vérifiez que le fichier `.env` existe
- Vérifiez que les variables SMTP sont correctement définies
- Redémarrez le serveur après modification

### Erreur : "Authentication failed"
- Vérifiez vos identifiants SMTP
- Pour Gmail, utilisez un mot de passe d'application
- Vérifiez que l'authentification à 2 facteurs est activée

### Erreur : "Connection timeout"
- Vérifiez que le port SMTP est correct
- Vérifiez votre connexion internet
- Vérifiez les paramètres de votre pare-feu

## Sécurité

### Variables sensibles
- Ne commitez jamais le fichier `.env` dans Git
- Le fichier `.env` est déjà dans `.gitignore`
- Gardez vos identifiants SMTP confidentiels

### Production
- Utilisez des variables d'environnement sécurisées
- Considérez l'utilisation d'un service d'email dédié (SendGrid, Mailgun, etc.)
- Limitez l'accès aux endpoints d'email

## Support
Si vous rencontrez des problèmes :
1. Vérifiez les logs du serveur
2. Testez avec un autre fournisseur SMTP
3. Vérifiez la documentation de votre fournisseur email
