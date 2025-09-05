const { body, param } = require('express-validator');
const { validate } = require('../middleware/validate');

// Schéma de validation pour la création d'un engagement de concubinage
const createEngagementSchema = [
  body('dateEtablissement')
    .isISO8601()
    .withMessage('La date d\'établissement doit être une date valide')
    .toDate(),
    
  body('lieuEtablissement')
    .trim()
    .notEmpty()
    .withMessage('Le lieu d\'établissement est requis')
    .isLength({ max: 100 })
    .withMessage('Le lieu d\'établissement ne doit pas dépasser 100 caractères'),
    
  body('officierEtatCivil')
    .trim()
    .notEmpty()
    .withMessage('Le nom de l\'officier d\'état civil est requis')
    .isLength({ max: 100 })
    .withMessage('Le nom de l\'officier ne doit pas dépasser 100 caractères'),
    
  body('dateDebutConcubinage')
    .isISO8601()
    .withMessage('La date de début du concubinage doit être une date valide')
    .toDate(),
    
  body('adresseCommune')
    .trim()
    .notEmpty()
    .withMessage('L\'adresse commune est requise')
    .isLength({ max: 200 })
    .withMessage('L\'adresse commune ne doit pas dépasser 200 caractères'),
    
  body('regimeBiens')
    .isIn(['séparation de biens', 'indivision', 'autre'])
    .withMessage('Régime de biens invalide'),
    
  body('detailsRegimeBiens')
    .optional({ checkFalsy: true })
    .isLength({ max: 500 })
    .withMessage('Les détails du régime de biens ne doivent pas dépasser 500 caractères'),
    
  body('observations')
    .optional({ checkFalsy: true })
    .isLength({ max: 1000 })
    .withMessage('Les observations ne doivent pas dépasser 1000 caractères'),
    
  // Validation des informations du premier concubin
  body('concubin1.nom')
    .trim()
    .notEmpty()
    .withMessage('Le nom du premier concubin est requis'),
    
  body('concubin1.prenoms')
    .trim()
    .notEmpty()
    .withMessage('Les prénoms du premier concubin sont requis'),
    
  body('concubin1.dateNaissance')
    .isISO8601()
    .withMessage('La date de naissance du premier concubin doit être une date valide')
    .toDate(),
    
  body('concubin1.lieuNaissance')
    .trim()
    .notEmpty()
    .withMessage('Le lieu de naissance du premier concubin est requis'),
    
  body('concubin1.adresse')
    .trim()
    .notEmpty()
    .withMessage('L\'adresse du premier concubin est requise'),
    
  body('concubin1.nationalite')
    .trim()
    .notEmpty()
    .withMessage('La nationalité du premier concubin est requise'),
    
  body('concubin1.typePieceIdentite')
    .isIn(['CNI', 'Passeport', 'Acte de naissance', 'Autre'])
    .withMessage('Type de pièce d\'identité invalide pour le premier concubin'),
    
  body('concubin1.numeroPieceIdentite')
    .trim()
    .notEmpty()
    .withMessage('Le numéro de pièce d\'identité du premier concubin est requis'),
    
  body('concubin1.situationMatrimoniale')
    .isIn(['célibataire', 'marié(e)', 'divorcé(e)', 'veuf(ve)', 'séparé(e) de corps'])
    .withMessage('Situation matrimoniale invalide pour le premier concubin'),
    
  body('concubin1.nomConjoint')
    .if((value, { req }) => req.body.concubin1?.situationMatrimoniale === 'marié(e)')
    .trim()
    .notEmpty()
    .withMessage('Le nom du conjoint est requis pour un concubin marié'),
    
  body('concubin1.dateMariage')
    .if((value, { req }) => req.body.concubin1?.situationMatrimoniale === 'marié(e)')
    .isISO8601()
    .withMessage('La date de mariage doit être une date valide')
    .toDate(),
    
  // Validation des informations du deuxième concubin
  body('concubin2.nom')
    .trim()
    .notEmpty()
    .withMessage('Le nom du deuxième concubin est requis'),
    
  body('concubin2.prenoms')
    .trim()
    .notEmpty()
    .withMessage('Les prénoms du deuxième concubin sont requis'),
    
  body('concubin2.dateNaissance')
    .isISO8601()
    .withMessage('La date de naissance du deuxième concubin doit être une date valide')
    .toDate(),
    
  body('concubin2.lieuNaissance')
    .trim()
    .notEmpty()
    .withMessage('Le lieu de naissance du deuxième concubin est requis'),
    
  body('concubin2.adresse')
    .trim()
    .notEmpty()
    .withMessage('L\'adresse du deuxième concubin est requise'),
    
  body('concubin2.nationalite')
    .trim()
    .notEmpty()
    .withMessage('La nationalité du deuxième concubin est requise'),
    
  body('concubin2.typePieceIdentite')
    .isIn(['CNI', 'Passeport', 'Acte de naissance', 'Autre'])
    .withMessage('Type de pièce d\'identité invalide pour le deuxième concubin'),
    
  body('concubin2.numeroPieceIdentite')
    .trim()
    .notEmpty()
    .withMessage('Le numéro de pièce d\'identité du deuxième concubin est requis'),
    
  body('concubin2.situationMatrimoniale')
    .isIn(['célibataire', 'marié(e)', 'divorcé(e)', 'veuf(ve)', 'séparé(e) de corps'])
    .withMessage('Situation matrimoniale invalide pour le deuxième concubin'),
    
  body('concubin2.nomConjoint')
    .if((value, { req }) => req.body.concubin2?.situationMatrimoniale === 'marié(e)')
    .trim()
    .notEmpty()
    .withMessage('Le nom du conjoint est requis pour un concubin marié'),
    
  body('concubin2.dateMariage')
    .if((value, { req }) => req.body.concubin2?.situationMatrimoniale === 'marié(e)')
    .isISO8601()
    .withMessage('La date de mariage doit être une date valide')
    .toDate(),
    
  // Validation des témoins (optionnels mais limités à 4)
  body('temoins')
    .optional({ checkFalsy: true })
    .isArray({ max: 4 })
    .withMessage('Le nombre maximum de témoins est de 4'),
    
  body('temoins.*.nom')
    .if(body('temoins').exists())
    .trim()
    .notEmpty()
    .withMessage('Le nom du témoin est requis'),
    
  body('temoins.*.prenoms')
    .if(body('temoins').exists())
    .trim()
    .notEmpty()
    .withMessage('Les prénoms du témoin sont requis'),
    
  body('temoins.*.dateNaissance')
    .if(body('temoins').exists())
    .isISO8601()
    .withMessage('La date de naissance du témoin doit être une date valide')
    .toDate(),
    
  body('temoins.*.adresse')
    .if(body('temoins').exists())
    .trim()
    .notEmpty()
    .withMessage('L\'adresse du témoin est requise'),
    
  body('temoins.*.typePieceIdentite')
    .if(body('temoins').exists())
    .isIn(['CNI', 'Passeport', 'Acte de naissance', 'Autre'])
    .withMessage('Type de pièce d\'identité invalide pour le témoin'),
    
  body('temoins.*.numeroPieceIdentite')
    .if(body('temoins').exists())
    .trim()
    .notEmpty()
    .withMessage('Le numéro de pièce d\'identité du témoin est requis')
];

// Schéma de validation pour la mise à jour d'un engagement de concubinage
const updateEngagementSchema = [
  param('id')
    .isMongoId()
    .withMessage('ID invalide'),
  ...createEngagementSchema
];

// Schéma de validation pour la rupture d'un engagement
const rompreEngagementSchema = [
  param('id')
    .isMongoId()
    .withMessage('ID invalide'),
    
  body('motif')
    .trim()
    .notEmpty()
    .withMessage('Le motif de la rupture est requis')
    .isLength({ max: 500 })
    .withMessage('Le motif ne doit pas dépasser 500 caractères')
];

// Schéma de validation pour la conversion en mariage
const convertirEnMariageSchema = [
  param('id')
    .isMongoId()
    .withMessage('ID invalide')
];

// Schéma de validation pour l'ID d'engagement
const engagementIdSchema = [
  param('id')
    .isMongoId()
    .withMessage('ID invalide')
];

// Middlewares exportés
module.exports = {
  validateCreateEngagement: validate(createEngagementSchema),
  validateUpdateEngagement: validate(updateEngagementSchema),
  validateRompreEngagement: validate(rompreEngagementSchema),
  validateConvertirEnMariage: validate(convertirEnMariageSchema),
  validateEngagementId: validate(engagementIdSchema)
};
