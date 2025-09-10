# Documentation du Formulaire d'Engagement de Cial

## Structure du Projet

- **Fichier HTML Principal** : `views/engagement.html`
  - Contient la structure du formulaire et les styles CSS
  - Inclut les librairies nécessaires (Bootstrap, Font Awesome, jQuery)
  - Référence le fichier JavaScript externe

- **Fichier JavaScript** : `public/js/engagement.js`
  - Gère toute la logique du formulaire
  - Validation côté client
  - Communication avec l'API
  - Gestion des états du formulaire

## Fonctionnalités Implémentées

### 1. Validation Côté Client
- **Champs Requis** : Tous les champs marqués d'un astérisque (*) sont obligatoires
- **Validation des Dates** :
  - Les dates ne peuvent pas être dans le futur
  - La date de début de concubinage ne peut pas être postérieure à la date d'établissement
- **Retours Visuels** :
  - Bordure verte pour les champs valides
  - Bordure rouge pour les champs invalides
  - Messages d'erreur détaillés
  - Animation de secousse pour les champs invalides

### 2. Gestion des États
- **Mode Création** :
  - Génération automatique d'un numéro d'acte
  - Bouton "Enregistrer"
- **Mode Édition** :
  - Chargement des données existantes
  - Bouton "Mettre à jour"
  - Bouton d'impression activé

### 3. Communication avec l'API
- **Endpoints** :
  - `GET /api/engagements/:id` : Récupérer un engagement existant
  - `POST /api/engagements` : Créer un nouvel engagement
  - `PUT /api/engagements/:id` : Mettre à jour un engagement existant
- **Format des Données** :
  ```json
  {
    "numeroActe": "string",
    "dateEtablissement": "YYYY-MM-DD",
    "lieuEtablissement": "string",
    "dateDebutConcubinage": "YYYY-MM-DD",
    "adresseCommune": "string",
    "observations": "string",
    "concubin1": {
      "nom": "string",
      "dateNaissance": "YYYY-MM-DD",
      "lieuNaissance": "string",
      "domicile": "string"
    },
    "concubin2": {
      "nom": "string",
      "dateNaissance": "YYYY-MM-DD",
      "lieuNaissance": "string",
      "domicile": "string"
    }
  }
  ```

## Guide de Développement

### Pour Modifier le Formulaire
1. Ajoutez ou modifiez les champs dans `engagement.html`
2. Mettez à jour la validation dans `engagement.js` si nécessaire
3. Testez les deux modes (création et édition)

### Pour Déboguer
1. Ouvrez les outils de développement du navigateur (F12)
2. Vérifiez la console pour les erreurs JavaScript
3. Inspectez les requêtes réseau pour le débogage des appels API

### Bonnes Pratiques
- Toujours tester les deux modes (création/édition)
- Vérifier la validation sur différents appareils
- S'assurer que les messages d'erreur sont clairs et utiles
- Documenter toute nouvelle fonctionnalité

## Notes de Version

### 1.0.0 - [Date]
- Version initiale du formulaire d'engagement
- Validation côté client complète
- Intégration avec l'API backend
- Interface utilisateur réactive et moderne
