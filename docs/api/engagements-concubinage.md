# API Engagements de Concubinage

Cette documentation décrit les endpoints disponibles pour la gestion des déclarations de concubinage.

## Base URL

```
/api/engagements
```

## Authentification

Toutes les requêtes nécessitent une authentification via JWT. Inclure le token dans le header `Authorization` :

```
Authorization: Bearer <votre_token_jwt>
```

## Modèle de données

### Engagement de Concubinage

```typescript
{
  _id: string;                     // ID unique de l'acte
  numeroActe: string;              // Numéro d'acte formaté (ex: CONC-2023-00001)
  dateEtablissement: Date;         // Date d'établissement de l'acte
  lieuEtablissement: string;       // Lieu d'établissement
  officierEtatCivil: string;       // Nom de l'officier d'état civil
  
  // Informations sur le concubinage
  dateDebutConcubinage: Date;      // Date de début du concubinage
  adresseCommune: string;          // Adresse commune des concubins
  regimeBiens: string;             // 'séparation de biens', 'indivision', 'autre'
  detailsRegimeBiens?: string;     // Détails sur le régime des biens
  observations?: string;           // Observations complémentaires
  
  // Informations sur les concubins
  concubin1: {                    // Premier concubin
    nom: string;
    prenoms: string;
    dateNaissance: Date;
    lieuNaissance: string;
    profession: string;
    adresse: string;
    nationalite: string;
    typePieceIdentite: string;    // 'CNI', 'Passeport', 'Acte de naissance', 'Autre'
    numeroPieceIdentite: string;
    situationMatrimoniale: string; // 'célibataire', 'marié(e)', 'divorcé(e)', 'veuf(ve)', 'séparé(e) de corps'
    nomConjoint?: string;         // Si marié(e)
    dateMariage?: Date;           // Si marié(e)
  };
  
  concubin2: {                    // Deuxième concubin
    // Mêmes champs que pour le premier concubin
  };
  
  // Témoins (2 minimum, 4 maximum)
  temoins: Array<{
    nom: string;
    prenoms: string;
    dateNaissance: Date;
    profession?: string;
    adresse: string;
    typePieceIdentite: string;
    numeroPieceIdentite: string;
  }>;
  
  // Documents associés
  documents?: Array<{
    nom: string;
    url: string;
    type: string;
    dateAjout: Date;
  }>;
  
  // Statut et historique
  statut: 'actif' | 'rompu' | 'converti_en_mariage';
  dateFin?: Date;                 // Date de fin si rompu ou converti en mariage
  motifFin?: string;              // Motif de la rupture
  
  // Métadonnées
  createdBy: string;              // ID de l'utilisateur qui a créé l'acte
  updatedBy?: string;             // ID du dernier utilisateur ayant modifié l'acte
  commentaires?: Array<{          // Historique des commentaires
    user: string;                // ID de l'utilisateur
    texte: string;
    date: Date;
  }>;
  
  // Horodatages
  createdAt: Date;                // Date de création
  updatedAt: Date;                // Date de dernière mise à jour
}
```

## Endpoints

### 1. Créer une nouvelle déclaration de concubinage

```http
POST /api/engagements
```

**Permissions requises** : `admin` ou `agent`

**Corps de la requête** :

```json
{
  "dateEtablissement": "2023-10-15T00:00:00.000Z",
  "lieuEtablissement": "Mairie d'Abéché",
  "officierEtatCivil": "Nom de l'officier",
  "dateDebutConcubinage": "2020-05-15T00:00:00.000Z",
  "adresseCommune": "123 Rue de la Paix, N'Djamena",
  "regimeBiens": "indivision",
  "detailsRegimeBiens": "Achat d'un bien immobilier en commun",
  "observations": "Aucune observation particulière",
  "concubin1": {
    "nom": "KODJIMI",
    "prenoms": "Paul",
    "dateNaissance": "1990-03-15T00:00:00.000Z",
    "lieuNaissance": "N'Djamena",
    "profession": "Ingénieur",
    "adresse": "123 Rue de la Paix, N'Djamena",
    "nationalite": "Tchadienne",
    "typePieceIdentite": "CNI",
    "numeroPieceIdentite": "AB123456",
    "situationMatrimoniale": "célibataire"
  },
  "concubin2": {
    "nom": "NGARNDI",
    "prenoms": "Amina",
    "dateNaissance": "1992-07-22T00:00:00.000Z",
    "lieuNaissance": "Moundou",
    "profession": "Médecin",
    "adresse": "123 Rue de la Paix, N'Djamena",
    "nationalite": "Tchadienne",
    "typePieceIdentite": "Passeport",
    "numeroPieceIdentite": "P1234567",
    "situationMatrimoniale": "divorcée"
  },
  "temoins": [
    {
      "nom": "MAHAMAT",
      "prenoms": "Ibrahim",
      "dateNaissance": "1985-11-10T00:00:00.000Z",
      "profession": "Commerçant",
      "adresse": "456 Avenue du Marché, N'Djamena",
      "typePieceIdentite": "CNI",
      "numeroPieceIdentite": "CD789012"
    },
    {
      "nom": "HASSAN",
      "prenoms": "Fatimé",
      "dateNaissance": "1988-04-25T00:00:00.000Z",
      "profession": "Enseignante",
      "adresse": "789 Boulevard de l'Université, N'Djamena",
      "typePieceIdentite": "CNI",
      "numeroPieceIdentite": "EF345678"
    }
  ]
}
```

**Réponse en cas de succès (201)** :

```json
{
  "success": true,
  "message": "Déclaration de concubinage créée avec succès",
  "data": {
    "_id": "5f8d0d55b54764421b4396f4",
    "numeroActe": "CONC-2023-00001",
    // ... autres champs
  }
}
```

### 2. Récupérer la liste des déclarations de concubinage

```http
GET /api/engagements
```

**Paramètres de requête** :
- `page` : Numéro de page (par défaut: 1)
- `limit` : Nombre d'éléments par page (par défaut: 10)
- `search` : Terme de recherche (recherche dans les noms, prénoms, numéro d'acte)
- `statut` : Filtrer par statut ('actif', 'rompu', 'converti_en_mariage')

**Réponse en cas de succès (200)** :

```json
{
  "success": true,
  "data": [
    {
      "_id": "5f8d0d55b54764421b4396f4",
      "numeroActe": "CONC-2023-00001",
      "dateDebutConcubinage": "2020-05-15T00:00:00.000Z",
      "concubin1": {
        "nom": "KODJIMI",
        "prenoms": "Paul"
      },
      "concubin2": {
        "nom": "NGARNDI",
        "prenoms": "Amina"
      },
      "statut": "actif"
    }
    // ... autres déclarations
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "totalPages": 1,
    "limit": 10
  }
}
```

### 3. Récupérer une déclaration par son ID

```http
GET /api/engagements/:id
```

**Paramètres** :
- `id` : ID de la déclaration de concubinage

**Réponse en cas de succès (200)** :

```json
{
  "success": true,
  "data": {
    // Tous les champs de la déclaration
  }
}
```

### 4. Mettre à jour une déclaration de concubinage

```http
PUT /api/engagements/:id
```

**Permissions requises** : `admin` ou `agent`

**Corps de la requête** : Mêmes champs que pour la création

**Réponse en cas de succès (200)** :

```json
{
  "success": true,
  "message": "Déclaration de concubinage mise à jour avec succès",
  "data": {
    // Déclaration mise à jour
  }
}
```

### 5. Rompre un engagement de concubinage

```http
POST /api/engagements/:id/rompre
```

**Permissions requises** : `admin` ou `agent`

**Corps de la requête** :

```json
{
  "motif": "Séparation à l'amiable"
}
```

**Réponse en cas de succès (200)** :

```json
{
  "success": true,
  "message": "Engagement de concubinage rompu avec succès",
  "data": {
    // Déclaration mise à jour avec statut 'rompu'
  }
}
```

### 6. Convertir un engagement en mariage

```http
POST /api/engagements/:id/convertir-en-mariage
```

**Permissions requises** : `admin` ou `agent`

**Réponse en cas de succès (200)** :

```json
{
  "success": true,
  "message": "Engagement converti en mariage avec succès",
  "data": {
    "engagement": {
      // Détails de l'engagement mis à jour
      "statut": "converti_en_mariage"
    },
    "mariageId": "5f8d0d55b54764421b4397a5"
  }
}
```

### 7. Supprimer une déclaration de concubinage

```http
DELETE /api/engagements/:id
```

**Permissions requises** : `admin`

**Réponse en cas de succès (200)** :

```json
{
  "success": true,
  "message": "Déclaration de concubinage supprimée avec succès"
}
```

### 8. Générer un PDF pour une déclaration de concubinage

```http
GET /api/engagements/:id/pdf
```

**Réponse** : Fichier PDF en téléchargement

## Gestion des erreurs

Toutes les erreurs suivent le format standard :

```json
{
  "success": false,
  "message": "Message d'erreur",
  "error": "Détails de l'erreur (en développement)"
}
```

### Codes d'erreur courants

- **400** : Requête invalide (données manquantes ou invalides)
- **401** : Non authentifié
- **403** : Non autorisé
- **404** : Déclaration non trouvée
- **409** : Conflit (ex: déclaration déjà existante)
- **422** : Validation échouée (données invalides)
- **500** : Erreur serveur

## Exemple d'utilisation avec fetch

```javascript
// Créer une nouvelle déclaration de concubinage
const createEngagement = async (engagementData) => {
  const response = await fetch('/api/engagements', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    },
    body: JSON.stringify(engagementData)
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Erreur lors de la création de la déclaration');
  }
  
  return response.json();
};

// Rompre un engagement de concubinage
const rompreEngagement = async (id, motif) => {
  const response = await fetch(`/api/engagements/${id}/rompre`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    },
    body: JSON.stringify({ motif })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Erreur lors de la rupture de l\'engagement');
  }
  
  return response.json();
};

// Télécharger le PDF d'une déclaration
const downloadEngagementPdf = async (id) => {
  const response = await fetch(`/api/engagements/${id}/pdf`, {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    }
  });
  
  if (!response.ok) {
    throw new Error('Erreur lors du téléchargement du PDF');
  }
  
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `declaration-concubinage-${id}.pdf`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  a.remove();
};
```

## Notes supplémentaires

- Les dates doivent être au format ISO 8601
- Les champs marqués comme obligatoires dans le modèle doivent être fournis
- Un engagement ne peut être rompu ou converti en mariage que s'il est actif
- La conversion en mariage crée automatiquement un nouvel acte de mariage
- Les fichiers PDF générés incluent le logo de la mairie et les signatures nécessaires
