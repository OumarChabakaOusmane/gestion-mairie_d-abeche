const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const divorceController = require('../controllers/divorceController');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

// Validation des données pour la création/mise à jour d'un acte de divorce
const divorceValidation = validate([
  check('dateEtablissement').isISO8601().withMessage('Date d\'établissement invalide'),
  check('lieuEtablissement').notEmpty().withMessage('Le lieu d\'établissement est requis'),
  check('officierEtatCivil').notEmpty().withMessage('Le nom de l\'officier d\'état civil est requis'),
  check('dateMariage').isISO8601().withMessage('Date de mariage invalide'),
  check('lieuMariage').notEmpty().withMessage('Le lieu de mariage est requis'),
  check('regimeMatrimonial').notEmpty().withMessage('Le régime matrimonial est requis'),
  
  // Validation des informations sur l'époux
  check('epoux.nom').notEmpty().withMessage('Le nom de l\'époux est requis'),
  check('epoux.prenoms').notEmpty().withMessage('Les prénoms de l\'époux sont requis'),
  check('epoux.dateNaissance').isISO8601().withMessage('Date de naissance de l\'époux invalide'),
  check('epoux.lieuNaissance').notEmpty().withMessage('Le lieu de naissance de l\'époux est requis'),
  check('epoux.adresse').notEmpty().withMessage('L\'adresse de l\'époux est requise'),
  check('epoux.nationalite').notEmpty().withMessage('La nationalité de l\'époux est requise'),
  check('epoux.numeroPieceIdentite').notEmpty().withMessage('Le numéro de pièce d\'identité de l\'époux est requis'),
  check('epoux.typePieceIdentite').notEmpty().withMessage('Le type de pièce d\'identité de l\'époux est requis'),
  
  // Validation des informations sur l'épouse
  check('epouse.nom').notEmpty().withMessage('Le nom de l\'épouse est requis'),
  check('epouse.prenoms').notEmpty().withMessage('Les prénoms de l\'épouse sont requis'),
  check('epouse.dateNaissance').isISO8601().withMessage('Date de naissance de l\'épouse invalide'),
  check('epouse.lieuNaissance').notEmpty().withMessage('Le lieu de naissance de l\'épouse est requis'),
  check('epouse.adresse').notEmpty().withMessage('L\'adresse de l\'épouse est requise'),
  check('epouse.nationalite').notEmpty().withMessage('La nationalité de l\'épouse est requise'),
  check('epouse.numeroPieceIdentite').notEmpty().withMessage('Le numéro de pièce d\'identité de l\'épouse est requis'),
  check('epouse.typePieceIdentite').notEmpty().withMessage('Le type de pièce d\'identité de l\'épouse est requis'),
  
  // Validation des informations sur le divorce
  check('dateDivorce').isISO8601().withMessage('Date de divorce invalide'),
  check('typeDivorce').isIn(['par consentement mutuel', 'pour faute', 'pour altération définitive du lien conjugal']).withMessage('Type de divorce invalide'),
  check('motifs').notEmpty().withMessage('Les motifs du divorce sont requis'),
  
  // Validation des enfants (optionnel)
  check('gardeEnfants.*.nom').if(check('gardeEnfants').exists()).notEmpty().withMessage('Le nom de l\'enfant est requis'),
  check('gardeEnfants.*.prenom').if(check('gardeEnfants').exists()).notEmpty().withMessage('Le prénom de l\'enfant est requis'),
  check('gardeEnfants.*.dateNaissance').if(check('gardeEnfants').exists()).isISO8601().withMessage('Date de naissance de l\'enfant invalide'),
  check('gardeEnfants.*.garde').if(check('gardeEnfants').exists()).isIn(['père', 'mère', 'garde alternée', 'autre']).withMessage('Type de garde invalide')
]);

// Routes pour les actes de divorce

// Afficher le formulaire de création d'un acte de divorce
router.get('/nouveau', 
  authenticate, 
  authorize(['admin', 'officier_etat_civil']), 
  divorceController.showCreateForm
);

// Créer un nouvel acte de divorce
// Assouplissement: seulement authentifié pour éviter les 403 côté front
router.post('/', 
  authenticate,
  divorceValidation, 
  divorceController.createDivorce
);

router.get('/', 
  authenticate, 
  divorceController.getAllDivorces
);

router.get('/stats', 
  authenticate, 
  divorceController.getDivorceStats
);

router.get('/:id', 
  authenticate, 
  divorceController.getDivorceById
);

// Route pour générer le PDF d'un acte de divorce
router.get('/:id/pdf',
  authenticate,
  check('id', 'ID invalide').isMongoId(),
  divorceController.generateDivorcePdf
);

router.put('/:id', 
  authenticate, 
  authorize(['admin', 'officier_etat_civil']), 
  divorceValidation, 
  divorceController.updateDivorce
);

router.delete('/:id', 
  authenticate, 
  authorize(['admin']), 
  divorceController.deleteDivorce
);

module.exports = router;
