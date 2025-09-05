const { body, param } = require('express-validator');
const { validate } = require('../middleware/validate');

// Schéma de validation pour la création d'un acte de divorce
const createDivorceSchema = [
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
    
  body('dateMariage')
    .isISO8601()
    .withMessage('La date de mariage doit être une date valide')
    .toDate(),
    
  body('lieuMariage')
    .trim()
    .notEmpty()
    .withMessage('Le lieu de mariage est requis')
    .isLength({ max: 100 })
    .withMessage('Le lieu de mariage ne doit pas dépasser 100 caractères'),
    
  body('dateDivorce')
    .isISO8601()
    .withMessage('La date de divorce doit être une date valide')
    .toDate(),
    
  body('typeDivorce')
    .isIn(['par consentement mutuel', 'pour faute', 'pour altération définitive du lien conjugal'])
    .withMessage('Type de divorce invalide'),
    
  body('regimeMatrimonial')
    .trim()
    .notEmpty()
    .withMessage('Le régime matrimonial est requis'),
    
  body('motifs')
    .trim()
    .notEmpty()
    .withMessage('Les motifs du divorce sont requis'),
    
  // Validation des informations de l'époux
  body('epoux.nom')
    .trim()
    .notEmpty()
    .withMessage('Le nom de l\'époux est requis'),
    
  body('epoux.prenoms')
    .trim()
    .notEmpty()
    .withMessage('Les prénoms de l\'époux sont requis'),
    
  // Validation des informations de l'épouse
  body('epouse.nom')
    .trim()
    .notEmpty()
    .withMessage('Le nom de l\'épouse est requis'),
    
  body('epouse.prenoms')
    .trim()
    .notEmpty()
    .withMessage('Les prénoms de l\'épouse sont requis'),
    
  // Validation optionnelle des enfants
  body('gardeEnfants')
    .optional({ checkFalsy: true })
    .isArray()
    .withMessage('La garde des enfants doit être un tableau'),
    
  body('gardeEnfants.*.nom')
    .if(body('gardeEnfants').exists())
    .trim()
    .notEmpty()
    .withMessage('Le nom de l\'enfant est requis'),
    
  body('gardeEnfants.*.prenom')
    .if(body('gardeEnfants').exists())
    .trim()
    .notEmpty()
    .withMessage('Le prénom de l\'enfant est requis'),
    
  body('gardeEnfants.*.dateNaissance')
    .if(body('gardeEnfants').exists())
    .isISO8601()
    .withMessage('La date de naissance de l\'enfant doit être une date valide')
    .toDate(),
    
  body('gardeEnfants.*.garde')
    .if(body('gardeEnfants').exists())
    .isIn(['père', 'mère', 'garde alternée', 'autre'])
    .withMessage('Type de garde invalide')
];

// Schéma de validation pour la mise à jour d'un acte de divorce
const updateDivorceSchema = [
  param('id')
    .isMongoId()
    .withMessage('ID invalide'),
  ...createDivorceSchema
];

// Schéma de validation pour l'ID de divorce
const divorceIdSchema = [
  param('id')
    .isMongoId()
    .withMessage('ID invalide')
];

// Middlewares exportés
module.exports = {
  validateCreateDivorce: validate(createDivorceSchema),
  validateUpdateDivorce: validate(updateDivorceSchema),
  validateDivorceId: validate(divorceIdSchema)
};
