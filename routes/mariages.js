const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const mariageController = require('../controllers/mariageController');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

// Validation des données pour la création/mise à jour d'un acte de mariage
const mariageValidation = validate([
  check('numeroActe').notEmpty().withMessage('Le numéro d\'acte est requis'),
  check('dateEnregistrement').isISO8601().withMessage('Date d\'enregistrement invalide'),
  check('mairie').notEmpty().withMessage('La mairie est requise'),
  
  // Validation des informations du conjoint 1
  check('conjoint1').notEmpty().withMessage('Le nom du conjoint est requis'),
  check('conjoint1Prenom').notEmpty().withMessage('Le prénom du conjoint est requis'),
  check('dateNaissanceConjoint1').isISO8601().withMessage('Date de naissance du conjoint invalide'),
  check('lieuNaissanceConjoint1').notEmpty().withMessage('Le lieu de naissance du conjoint est requis'),
  check('professionConjoint1').notEmpty().withMessage('La profession du conjoint est requise'),
  check('adresseConjoint1').notEmpty().withMessage('L\'adresse du conjoint est requise'),
  check('nationaliteConjoint1').notEmpty().withMessage('La nationalité du conjoint est requise'),
  check('typePieceConjoint1').notEmpty().withMessage('Le type de pièce d\'identité du conjoint est requis'),
  check('numeroPieceConjoint1').notEmpty().withMessage('Le numéro de pièce d\'identité du conjoint est requis'),
  
  // Validation des informations de la conjointe 2
  check('conjointe2').notEmpty().withMessage('Le nom de la conjointe est requis'),
  check('conjoint2Prenom').notEmpty().withMessage('Le prénom de la conjointe est requis'),
  check('dateNaissanceConjointe2').isISO8601().withMessage('Date de naissance de la conjointe invalide'),
  check('lieuNaissanceConjointe2').notEmpty().withMessage('Le lieu de naissance de la conjointe est requis'),
  check('professionConjointe2').notEmpty().withMessage('La profession de la conjointe est requise'),
  check('adresseConjointe2').notEmpty().withMessage('L\'adresse de la conjointe est requise'),
  check('nationaliteConjointe2').notEmpty().withMessage('La nationalité de la conjointe est requise'),
  check('typePieceConjointe2').notEmpty().withMessage('Le type de pièce d\'identité de la conjointe est requis'),
  check('numeroPieceConjointe2').notEmpty().withMessage('Le numéro de pièce d\'identité de la conjointe est requis'),
  
  // Validation des détails du mariage
  check('dateMariage').isISO8601().withMessage('Date du mariage invalide'),
  check('lieuMariage').notEmpty().withMessage('Le lieu du mariage est requis'),
  check('regimeMatrimonial').notEmpty().withMessage('Le régime matrimonial est requis'),
  
  // Validation des témoins (au moins 2 témoins requis)
  check('temoins').isArray({ min: 2 }).withMessage('Au moins deux témoins sont requis'),
  check('temoins.*.nom').notEmpty().withMessage('Le nom du témoin est requis'),
  check('temoins.*.prenom').notEmpty().withMessage('Le prénom du témoin est requis'),
  check('temoins.*.profession').notEmpty().withMessage('La profession du témoin est requise'),
  check('temoins.*.adresse').notEmpty().withMessage('L\'adresse du témoin est requise'),
  
  // Informations complémentaires
  check('officierEtatCivil').notEmpty().withMessage('Le nom de l\'officier d\'état civil est requis')
]);

// Route pour générer un PDF d'acte de mariage
router.get('/:id/pdf', 
  authenticate,
  mariageController.generateMariagePdf
);

module.exports = router;
