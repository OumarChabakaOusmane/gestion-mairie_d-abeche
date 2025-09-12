# CAHIER DES CHARGES
## SYSTÈME DE GESTION DE L'ÉTAT CIVIL D'ABÉCHÉ

---

## 1. PRÉSENTATION GÉNÉRALE

### 1.1 Contexte
Le présent cahier des charges définit les spécifications techniques et fonctionnelles pour le développement d'un système de gestion numérique de l'état civil pour la mairie d'Abéché, République du Tchad.

### 1.2 Objectifs
- Digitaliser la gestion des actes d'état civil
- Améliorer la traçabilité et la sécurité des documents
- Faciliter l'accès aux services d'état civil
- Moderniser l'administration municipale

### 1.3 Périmètre
Le système couvre la gestion complète des actes d'état civil :
- Actes de naissance
- Actes de mariage
- Actes de décès
- Actes de divorce
- Engagements de concubinage

---

## 2. SPÉCIFICATIONS FONCTIONNELLES

### 2.1 Gestion des Utilisateurs

#### 2.1.1 Authentification
- **Connexion sécurisée** : Système d'authentification par email/mot de passe
- **Récupération de mot de passe** : Envoi d'email avec lien de réinitialisation
- **Vérification OTP** : Code de vérification par email
- **Sessions sécurisées** : Tokens JWT avec expiration

#### 2.1.2 Rôles et Permissions
- **Administrateur** : Accès complet au système
- **Officier d'état civil** : Création et modification des actes
- **Agent** : Consultation et impression des actes
- **Utilisateur en attente** : Validation des comptes

### 2.2 Gestion des Actes

#### 2.2.1 Actes de Naissance
**Informations obligatoires :**
- Nom et prénom(s) de l'enfant
- Date et heure de naissance
- Lieu de naissance
- Sexe de l'enfant
- Poids et taille

**Filiation :**
- Informations du père (nom, prénom, date/lieu de naissance, profession, nationalité)
- Informations de la mère (nom, prénom, date/lieu de naissance, profession, nationalité)

**Déclaration :**
- Nom du déclarant
- Lien avec l'enfant
- Pièce d'identité du déclarant
- Date et lieu de délivrance de la pièce

#### 2.2.2 Actes de Mariage
**Informations des conjoints :**
- Identité complète (nom, prénom, date/lieu de naissance)
- Profession et nationalité
- Statut matrimonial antérieur
- Pièces d'identité

**Cérémonie :**
- Date et lieu du mariage
- Témoins (nom, prénom, profession)
- Officier célébrant

#### 2.2.3 Actes de Décès
**Informations du défunt :**
- Identité complète
- Date et lieu du décès
- Cause du décès
- Profession du défunt

**Déclaration :**
- Déclarant (nom, lien avec le défunt)
- Pièce d'identité du déclarant
- Certificat médical de décès

#### 2.2.4 Actes de Divorce
**Informations des époux :**
- Identité des deux conjoints
- Date et lieu du mariage
- Motif du divorce
- Jugement de divorce

#### 2.2.5 Engagements de Concubinage
**Informations des partenaires :**
- Identité complète des deux partenaires
- Date de début de l'union
- Déclaration commune
- Témoins

### 2.3 Fonctionnalités Transversales

#### 2.3.1 Numérotation Automatique
- Génération automatique des numéros d'actes
- Format : N° + numéro séquentiel + année
- Unicité garantie

#### 2.3.2 Génération de PDF
- Templates officiels pour chaque type d'acte
- En-tête avec armoiries de la République du Tchad
- Signature numérique de l'officier
- Filigrane de sécurité

#### 2.3.3 Recherche et Filtrage
- Recherche par nom, prénom, numéro d'acte
- Filtrage par type d'acte, date, mairie
- Export des résultats en PDF/Excel/CSV

#### 2.3.4 Messagerie Interne
- Communication entre utilisateurs
- Pièces jointes (documents)
- Notifications de lecture
- Historique des conversations

#### 2.3.5 Tableau de Bord
- Statistiques en temps réel
- Graphiques d'évolution
- Activités récentes
- Indicateurs de performance

---

## 3. SPÉCIFICATIONS TECHNIQUES

### 3.1 Architecture

#### 3.1.1 Stack Technologique
- **Backend** : Node.js avec Express.js
- **Base de données** : MongoDB avec Mongoose
- **Frontend** : HTML5, CSS3, JavaScript (ES6+)
- **Framework CSS** : Bootstrap 5
- **Authentification** : JWT (JSON Web Tokens)
- **Génération PDF** : PDFKit
- **Serveur** : Node.js avec PM2

#### 3.1.2 Structure du Projet
```
wenaklabs/
├── app.js                 # Point d'entrée principal
├── config/                # Configuration (DB, email, logger)
├── controllers/           # Logique métier par ressource
├── middleware/            # Middlewares (auth, security, validation)
├── models/               # Modèles Mongoose
├── routes/               # Définition des routes API
├── services/             # Services (PDF, email)
├── public/               # Assets statiques (CSS, JS, images)
├── views/                # Templates HTML
├── uploads/              # Fichiers uploadés
└── tests/                # Tests unitaires
```

### 3.2 Base de Données

#### 3.2.1 Collections Principales
- **users** : Utilisateurs du système
- **actes** : Actes d'état civil
- **documents** : Fichiers attachés
- **conversations** : Messages entre utilisateurs
- **pending_users** : Utilisateurs en attente de validation

#### 3.2.2 Modèles de Données
- **User** : Profil utilisateur avec rôles
- **Acte** : Acte générique avec détails spécifiques
- **Naissance, Mariage, Décès, Divorce, EngagementConcubinage** : Modèles spécialisés
- **Document** : Gestion des fichiers
- **Conversation/Message** : Système de messagerie

### 3.3 Sécurité

#### 3.3.1 Authentification
- Hachage des mots de passe (bcrypt)
- Tokens JWT avec expiration
- Middleware d'authentification sur toutes les routes protégées

#### 3.3.2 Autorisation
- Système de rôles (admin, officier, agent, pending)
- Vérification des permissions par ressource
- Protection CSRF

#### 3.3.3 Sécurité des Données
- Validation des entrées utilisateur
- Sanitisation des données
- Chiffrement des données sensibles
- Logs de sécurité

### 3.4 Performance

#### 3.4.1 Optimisations
- Pagination des listes
- Indexation MongoDB
- Compression des réponses
- Mise en cache des statistiques

#### 3.4.2 Monitoring
- Logs d'application
- Monitoring des erreurs
- Métriques de performance

---

## 4. INTERFACE UTILISATEUR

### 4.1 Design
- **Responsive Design** : Compatible mobile/tablette/desktop
- **Thème** : Interface moderne avec support mode sombre
- **Accessibilité** : Conformité WCAG 2.1
- **Multilingue** : Français, Arabe, Anglais

### 4.2 Navigation
- **Sidebar** : Navigation principale
- **Breadcrumbs** : Fil d'Ariane
- **Recherche globale** : Barre de recherche universelle
- **Notifications** : Système d'alertes

### 4.3 Formulaires
- **Validation en temps réel** : Feedback immédiat
- **Sauvegarde automatique** : Prévention de perte de données
- **Upload de fichiers** : Drag & drop
- **Prévisualisation** : Aperçu avant validation

---

## 5. INTÉGRATIONS

### 5.1 Services Externes
- **Email** : Envoi de notifications et récupération de mot de passe
- **SMS** : Notifications importantes (optionnel)
- **Imprimante** : Impression directe des actes

### 5.2 APIs
- **API REST** : Endpoints standardisés
- **Documentation** : Swagger/OpenAPI
- **Versioning** : Gestion des versions d'API

---

## 6. DÉPLOIEMENT

### 6.1 Environnements
- **Développement** : Environnement local
- **Test** : Environnement de validation
- **Production** : Serveur de production

### 6.2 Configuration
- **Variables d'environnement** : Configuration sécurisée
- **Base de données** : MongoDB Atlas ou serveur local
- **Serveur web** : Nginx en reverse proxy
- **Processus** : PM2 pour la gestion des processus

### 6.3 Maintenance
- **Sauvegardes** : Automatiques quotidiennes
- **Mises à jour** : Procédure de déploiement
- **Monitoring** : Surveillance 24/7
- **Logs** : Centralisation et rotation

---

## 7. TESTS

### 7.1 Tests Unitaires
- **Coverage** : Minimum 80% de couverture
- **Framework** : Jest
- **Tests** : Modèles, services, utilitaires

### 7.2 Tests d'Intégration
- **API** : Tests des endpoints
- **Base de données** : Tests des requêtes
- **Authentification** : Tests de sécurité

### 7.3 Tests de Performance
- **Charge** : Tests de montée en charge
- **Temps de réponse** : < 2 secondes
- **Concurrence** : 100 utilisateurs simultanés

---

## 8. FORMATION ET DOCUMENTATION

### 8.1 Documentation Utilisateur
- **Manuel utilisateur** : Guide complet
- **Tutoriels vidéo** : Formation visuelle
- **FAQ** : Questions fréquentes

### 8.2 Documentation Technique
- **Documentation API** : Swagger
- **Guide de déploiement** : Procédures
- **Architecture** : Diagrammes techniques

### 8.3 Formation
- **Formation administrateurs** : 2 jours
- **Formation utilisateurs** : 1 jour
- **Support** : Assistance technique

---

## 9. LIVRABLES

### 9.1 Code Source
- Code source complet et documenté
- Tests unitaires et d'intégration
- Scripts de déploiement

### 9.2 Documentation
- Manuel utilisateur
- Documentation technique
- Guide de déploiement

### 9.3 Formation
- Sessions de formation
- Supports de formation
- Accompagnement post-déploiement

---

## 10. CRITÈRES D'ACCEPTATION

### 10.1 Fonctionnels
- ✅ Tous les types d'actes peuvent être créés
- ✅ Génération PDF fonctionnelle
- ✅ Recherche et filtrage opérationnels
- ✅ Messagerie interne fonctionnelle
- ✅ Tableau de bord avec statistiques

### 10.2 Techniques
- ✅ Temps de réponse < 2 secondes
- ✅ Disponibilité > 99%
- ✅ Sécurité conforme aux standards
- ✅ Interface responsive
- ✅ Accessibilité WCAG 2.1

### 10.3 Qualité
- ✅ Code coverage > 80%
- ✅ Documentation complète
- ✅ Tests automatisés
- ✅ Formation utilisateurs réalisée

---

## 11. PLANNING

### 11.1 Phase 1 - Développement (4 semaines)
- Semaine 1-2 : Backend et API
- Semaine 3 : Frontend et interface
- Semaine 4 : Tests et intégration

### 11.2 Phase 2 - Déploiement (1 semaine)
- Configuration production
- Migration des données
- Tests de recette

### 11.3 Phase 3 - Formation (1 semaine)
- Formation administrateurs
- Formation utilisateurs
- Mise en production

---

## 12. BUDGET ET RESSOURCES

### 12.1 Ressources Humaines
- **Développeur Full-Stack** : 1 personne
- **Chef de projet** : 0.5 personne
- **Formateur** : 1 personne

### 12.2 Infrastructure
- **Serveur** : VPS ou cloud
- **Base de données** : MongoDB
- **Domaine** : Nom de domaine
- **SSL** : Certificat sécurisé

---

## 13. RISQUES ET MITIGATION

### 13.1 Risques Techniques
- **Perte de données** : Sauvegardes automatiques
- **Panne serveur** : Redondance et monitoring
- **Sécurité** : Audit de sécurité régulier

### 13.2 Risques Fonctionnels
- **Résistance au changement** : Formation et accompagnement
- **Bugs critiques** : Tests approfondis et recette
- **Performance** : Optimisations et monitoring

---

## 14. ÉVOLUTIONS FUTURES

### 14.1 Fonctionnalités Additionnelles
- **Signature électronique** : Intégration de certificats
- **API publique** : Ouverture aux partenaires
- **Mobile App** : Application mobile native
- **Intelligence artificielle** : Reconnaissance de documents

### 14.2 Intégrations
- **Système national** : Connexion au registre national
- **Services financiers** : Paiement en ligne
- **SMS Gateway** : Notifications SMS
- **Archivage** : Système d'archivage légal

---

*Document rédigé le : [Date]*
*Version : 1.0*
*Statut : Finalisé*
