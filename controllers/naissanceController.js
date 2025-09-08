const { validationResult } = require('express-validator');
const { logger } = require('../config/logger');
const Naissance = require('../models/Naissance');
const { generatePdf } = require('../services/pdfService');

// Définition du contrôleur
const naissanceController = {};

/**
 * Génère un PDF pour un acte de naissance
 * @route GET /api/naissances/:id/pdf
 * @access Privé
 */
naissanceController.generateNaissancePdf = async (req, res) => {
  try {
    // Vérifier les erreurs de validation
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('Validation failed', { errors: errors.array() });
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    
    // Récupérer l'acte de naissance
    const naissance = await Naissance.findById(id)
      .populate('enfant')
      .populate('pere')
      .populate('mere')
      .populate('declarant');

    if (!naissance) {
      logger.warn('Acte de naissance non trouvé', { id });
      return res.status(404).json({ message: 'Acte de naissance non trouvé' });
    }

    // Préparer les données pour le PDF dans le format attendu
    const pdfData = {
      numeroActe: naissance.numeroActe,
      dateEtablissement: naissance.dateEtablissement,
      mairie: naissance.mairie,
      // Données de l'enfant (format plat)
      nomEnfant: naissance.enfant.nom,
      prenomsEnfant: naissance.enfant.prenom,
      dateNaissance: naissance.enfant.dateNaissance,
      heureNaissance: naissance.enfant.heureNaissance,
      lieuNaissance: naissance.enfant.lieuNaissance,
      sexe: naissance.enfant.sexe,
      
      // Données du père (format plat)
      nomPere: naissance.pere.nom,
      prenomsPere: naissance.pere.prenom,
      dateNaissancePere: naissance.pere.dateNaissance,
      lieuNaissancePere: naissance.pere.lieuNaissance,
      professionPere: naissance.pere.profession,
      
      // Données de la mère (format plat)
      nomMere: naissance.mere.nom,
      prenomsMere: naissance.mere.prenom,
      dateNaissanceMere: naissance.mere.dateNaissance,
      lieuNaissanceMere: naissance.mere.lieuNaissance,
      professionMere: naissance.mere.profession,
      
      // Informations du déclarant
      nomDeclarant: naissance.declarant.nom,
      prenomsDeclarant: naissance.declarant.prenom,
      lienDeclarant: naissance.lienDeclarant,
      adresseDeclarant: naissance.adresseDeclarant,
      
      // Observations
      observations: naissance.observations
    };

    // Générer le PDF
    const pdfBuffer = await generatePdf('naissance', pdfData);

    // Configurer les en-têtes de la réponse
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="acte-naissance-${pdfData.numeroActe}.pdf"`,
      'Content-Length': pdfBuffer.length
    });

    // Envoyer le PDF
    logger.info('PDF généré avec succès', { id: naissance._id });
    res.send(pdfBuffer);

  } catch (error) {
    logger.error('Erreur lors de la génération du PDF', { 
      error: error.message,
      stack: error.stack 
    });
    res.status(500).json({ 
      message: 'Une erreur est survenue lors de la génération du PDF',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = naissanceController;
