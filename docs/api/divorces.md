# API Divorces

Cette documentation décrit les endpoints disponibles pour la gestion des actes de divorce.

## Base URL

```
/api/divorces
```

## Authentification

Toutes les requêtes nécessitent une authentification via JWT. Inclure le token dans le header `Authorization` :

```
Authorization: Bearer <votre_token_jwt>
```

## Modèle de données

### Divorce

```typescript
{
  _id: string;                     // ID unique de l'acte
  numeroActe: string;              // Numéro d'acte formaté (ex: DIV-2023-00001)
  dateEtablissement: Date;         // Date d'établissement de l'acte
  lieuEtablissement: string;       // Lieu d'établissement
  officierEtatCivil: string;       // Nom de l'officier d'état civil
  dateMariage: Date;               // Date du mariage
  lieuMariage: string;             // Lieu du mariage
  regimeMatrimonial: string;       // Régime matrimonial
  dateDivorce: Date;               // Date du divorce
  typeDivorce: string;             // Type de divorce
  motifs: string;                  // Motifs du divorce
  epoux: {                        // Informations sur l'époux
    nom: string;
    prenoms: string;
    dateNaissance: Date;
    lieuNaissance: string;
    profession: string;
    adresse: string;
    nationalite: string;
    typePieceIdentite: string;
    numeroPieceIdentite: string;
    situationMatrimoniale: string;
    nomConjoint?: string;
    dateMariage?: Date;
  };
  epouse: {                       // Informations sur l'épouse
    // Mêmes champs que pour l'époux
  };
  gardeEnfants?: Array<{          // Enfants mineurs
    nom: string;
    prenom: string;
    dateNaissance: Date;
    garde: string;                // 'père', 'mère', 'garde alternée', 'autre'
    details?: string;
  }>;
  documents?: Array<{             // Documents associés
    nom: string;
    url: string;
    type: string;
    dateAjout: Date;
  }>;
  createdBy: string;              // ID de l'utilisateur qui a créé l'acte
  updatedBy?: string;             // ID du dernier utilisateur ayant modifié l'acte
  statut: string;                 // 'en_attente', 'validé', 'rejeté', 'annulé'
  commentaires?: Array<{          // Historique des commentaires
    user: string;                // ID de l'utilisateur
    texte: string;
    date: Date;
  }>;
  createdAt: Date;                // Date de création
  updatedAt: Date;                // Date de dernière mise à jour
}
```

## Endpoints

### 1. Créer un nouvel acte de divorce

```http
POST /api/divorces
```

**Permissions requises** : `admin` ou `agent`

**Corps de la requête** :

```json
{
  "dateEtablissement": "2023-10-15T00:00:00.000Z",
  "lieuEtablissement": "Mairie d'Abéché",
  "officierEtatCivil": "Nom de l'officier",
  "dateMariage": "2015-05-20T00:00:00.000Z",
  "lieuMariage": "Mairie de N'Djamena",
  "regimeMatrimonial": "séparation de biens",
  "dateDivorce": "2023-10-10T00:00:00.000Z",
  "typeDivorce": "par consentement mutuel",
  "motifs": "Séparation de fait depuis plus de deux ans",
  "epoux": {
    "nom": "DUPONT",
    "prenoms": "Jean",
    "dateNaissance": "1985-03-15T00:00:00.000Z",
    "lieuNaissance": "N'Djamena",
    "profession": "Ingénieur",
    "adresse": "123 Rue de la Paix, N'Djamena",
    "nationalite": "Tchadienne",
    "typePieceIdentite": "CNI",
    "numeroPieceIdentite": "AB123456",
    "situationMatrimoniale": "marié(e)",
    "nomConjoint": "DUPONT Marie"
  },
  "epouse": {
    "nom": "MARTIN",
    "prenoms": "Marie",
    "dateNaissance": "1988-07-22T00:00:00.000Z",
    "lieuNaissance": "Moundou",
    "profession": "Médecin",
    "adresse": "123 Rue de la Paix, N'Djamena",
    "nationalite": "Tchadienne",
    "typePieceIdentite": "Passeport",
    "numeroPieceIdentite": "P1234567",
    "situationMatrimoniale": "marié(e)",
    "nomConjoint": "DUPONT Jean"
  },
  "gardeEnfants": [
    {
      "nom": "DUPONT",
      "prenom": "Lucas",
      "dateNaissance": "2016-02-10T00:00:00.000Z",
      "garde": "garde alternée"
    }
  ]
}
```

**Réponse en cas de succès (201)** :

```json
{
  "success": true,
  "message": "Acte de divorce créé avec succès",
  "data": {
    "_id": "5f8d0d55b54764421b4396e3",
    "numeroActe": "DIV-2023-00001",
    // ... autres champs
  }
}
```

### 2. Récupérer la liste des divorces

```http
GET /api/divorces
```

**Paramètres de requête** :
- `page` : Numéro de page (par défaut: 1)
- `limit` : Nombre d'éléments par page (par défaut: 10)
- `search` : Terme de recherche (recherche dans les noms, prénoms, numéro d'acte)
- `statut` : Filtrer par statut

**Réponse en cas de succès (200)** :

```json
{
  "success": true,
  "data": [
    {
      "_id": "5f8d0d55b54764421b4396e3",
      "numeroActe": "DIV-2023-00001",
      "dateDivorce": "2023-10-10T00:00:00.000Z",
      "epoux": {
        "nom": "DUPONT",
        "prenoms": "Jean"
      },
      "epouse": {
        "nom": "MARTIN",
        "prenoms": "Marie"
      },
      "statut": "validé"
    }
    // ... autres actes
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "totalPages": 1,
    "limit": 10
  }
}
```

### 3. Récupérer un acte de divorce par son ID

```http
GET /api/divorces/:id
```

**Paramètres** :
- `id` : ID de l'acte de divorce

**Réponse en cas de succès (200)** :

```json
{
  "success": true,
  "data": {
    // Tous les champs de l'acte de divorce
  }
}
```

### 4. Mettre à jour un acte de divorce

```http
PUT /api/divorces/:id
```

**Permissions requises** : `admin` ou `agent`

**Corps de la requête** : Mêmes champs que pour la création

**Réponse en cas de succès (200)** :

```json
{
  "success": true,
  "message": "Acte de divorce mis à jour avec succès",
  "data": {
    // Acte mis à jour
  }
}
```

### 5. Supprimer un acte de divorce

```http
DELETE /api/divorces/:id
```

**Permissions requises** : `admin`

**Réponse en cas de succès (200)** :

```json
{
  "success": true,
  "message": "Acte de divorce supprimé avec succès"
}
```

### 6. Générer un PDF pour un acte de divorce

```http
GET /api/divorces/:id/pdf
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
- **404** : Acte non trouvé
- **409** : Conflit (ex: acte déjà existant)
- **500** : Erreur serveur

## Exemple d'utilisation avec fetch

```javascript
// Créer un nouvel acte de divorce
const createDivorce = async (divorceData) => {
  const response = await fetch('/api/divorces', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    },
    body: JSON.stringify(divorceData)
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Erreur lors de la création de l\'acte');
  }
  
  return response.json();
};

// Télécharger le PDF d'un acte
const downloadDivorcePdf = async (id) => {
  const response = await fetch(`/api/divorces/${id}/pdf`, {
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
  a.download = `acte-divorce-${id}.pdf`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  a.remove();
};
```

## Notes supplémentaires

- Les dates doivent être au format ISO 8601
- Les champs marqués comme obligatoires dans le modèle doivent être fournis
- Les fichiers PDF générés incluent le logo de la mairie et les signatures nécessaires
- L'historique des modifications est automatiquement enregistré dans le champ `commentaires`
