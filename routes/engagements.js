const express = require('express');
const router = express.Router();
const { check, body } = require('express-validator');
const engagementController = require('../controllers/engagementConcubinageController');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

// Validation des données pour la création/mise à jour d'un engagement de concubinage
const engagementValidation = validate([
  
  check('lieuEtablissement').notEmpty().withMessage('Le lieu d\'établissement est requis'),
  check('officierEtatCivil').notEmpty().withMessage('Le nom de l\'officier d\'état civil est requis'),
  
  // Validation des informations sur le premier concubin
  check('concubin1.nom').notEmpty().withMessage('Le nom du premier concubin est requis'),
  check('concubin1.prenoms').notEmpty().withMessage('Les prénoms du premier concubin sont requis'),
  check('concubin1.dateNaissance').isISO8601().withMessage('Date de naissance du premier concubin invalide'),
  check('concubin1.lieuNaissance').notEmpty().withMessage('Le lieu de naissance du premier concubin est requis'),
  check('concubin1.adresse').notEmpty().withMessage('L\'adresse du premier concubin est requise'),
  check('concubin1.nationalite').notEmpty().withMessage('La nationalité du premier concubin est requise'),
  check('concubin1.numeroPieceIdentite').notEmpty().withMessage('Le numéro de pièce d\'identité du premier concubin est requis'),
  check('concubin1.typePieceIdentite').notEmpty().withMessage('Le type de pièce d\'identité du premier concubin est requis'),
  check('concubin1.situationMatrimoniale').isIn(['célibataire', 'divorcé(e)', 'veuf(ve)', 'séparé(e) de corps']).withMessage('Situation matrimoniale invalide'),
  
  // Validation des informations sur le deuxième concubin
  check('concubin2.nom').notEmpty().withMessage('Le nom du deuxième concubin est requis'),
  check('concubin2.prenoms').notEmpty().withMessage('Les prénoms du deuxième concubin sont requis'),
  check('concubin2.dateNaissance').isISO8601().withMessage('Date de naissance du deuxième concubin invalide'),
  check('concubin2.lieuNaissance').notEmpty().withMessage('Le lieu de naissance du deuxième concubin est requis'),
  check('concubin2.adresse').notEmpty().withMessage('L\'adresse du deuxième concubin est requise'),
  check('concubin2.nationalite').notEmpty().withMessage('La nationalité du deuxième concubin est requise'),
  check('concubin2.numeroPieceIdentite').notEmpty().withMessage('Le numéro de pièce d\'identité du deuxième concubin est requis'),
  check('concubin2.typePieceIdentite').notEmpty().withMessage('Le type de pièce d\'identité du deuxième concubin est requis'),
  check('concubin2.situationMatrimoniale').isIn(['célibataire', 'divorcé(e)', 'veuf(ve)', 'séparé(e) de corps']).withMessage('Situation matrimoniale invalide'),
  
  // Validation des informations sur l'engagement
  check('dateDebutConcubinage').isISO8601().withMessage('Date de début de concubinage invalide'),
  check('adresseCommune').notEmpty().withMessage('L\'adresse commune est requise'),
  check('regimeBiens').isIn(['séparation de biens', 'indivision', 'autre']).withMessage('Régime de biens invalide'),
  
  // Validation des témoins (optionnel mais si présents, valider leurs champs)
  check('temoins.*.nom').if(check('temoins').exists()).notEmpty().withMessage('Le nom du témoin est requis'),
  check('temoins.*.prenoms').if(check('temoins').exists()).notEmpty().withMessage('Les prénoms du témoin sont requis'),
  check('temoins.*.dateNaissance').if(check('temoins').exists()).isISO8601().withMessage('Date de naissance du témoin invalide'),
  
  // Validation des documents fournis (optionnel mais si présents, valider leurs champs)
  check('documentsFournis.*.type').if(check('documentsFournis').exists()).notEmpty().withMessage('Le type de document est requis'),
  check('documentsFournis.*.reference').if(check('documentsFournis').exists()).notEmpty().withMessage('La référence du document est requise')
]);

// Routes pour les engagements de concubinage
router.post('/', 
  authenticate, 
  authorize(['admin', 'officier_etat_civil']), 
  engagementValidation, 
  engagementController.createEngagement
);

router.get('/', 
  authenticate, 
  engagementController.listEngagements
);

router.get('/stats', 
  authenticate, 
  engagementController.getEngagementStats
);

router.get('/:id', 
  authenticate, 
  engagementController.getEngagementById
);

router.put('/:id', 
  authenticate, 
  authorize(['admin', 'officier_etat_civil']), 
  engagementValidation, 
  engagementController.updateEngagement
);

// Route spécifique pour rompre un engagement
router.post('/:id/terminer', 
  authenticate, 
  authorize(['admin', 'officier_etat_civil']),
  validate([
    check('motif').notEmpty().withMessage('Le motif de la rupture est requis'),
    check('dateFin').optional().isISO8601().withMessage('Date de fin invalide')
  ]),
  engagementController.terminateEngagement
);

router.delete('/:id', 
  authenticate, 
  authorize(['admin', 'officier_etat_civil']), 
  engagementController.deleteEngagement
);

router.get('/:id/pdf', 
  authenticate, 
  engagementController.generateEngagementPdf
);

module.exports = router;
