const { validationResult } = require('express-validator');
const { logger } = require('../config/logger');
const Acte = require('../models/Acte');
const { generatePdf } = require('../services/pdfService');
const { format } = require('date-fns');
const { fr } = require('date-fns/locale');

// Définition du contrôleur
const decesController = {};

/**
 * Génère un PDF pour un acte de décès
 * @route GET /api/actes/deces/:id/pdf
 * @access Privé
 */
decesController.generateDecesPdf = async (req, res) => {
  try {
    // Vérifier les erreurs de validation
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('Validation failed', { errors: errors.array() });
      return res.status(400).json({ 
        success: false,
        errors: errors.array() 
      });
    }

    const { id } = req.params;
    
    // Récupérer l'acte de décès avec les données associées
    const acte = await Acte.findOne({ _id: id, type: 'deces' })
      .populate('createdBy', 'nom prenom')
      .populate('mairie', 'nom ville')
      .lean();

    if (!acte) {
      logger.warn('Acte de décès non trouvé', { id });
      return res.status(404).json({ 
        success: false,
        message: 'Acte de décès non trouvé' 
      });
    }

    // Formater les dates pour l'affichage
    const formatDate = (date) => {
      if (!date) return 'Non spécifiée';
      try {
        return format(new Date(date), 'dd MMMM yyyy', { locale: fr });
      } catch (e) {
        return date;
      }
    };

    // Préparer les données pour le PDF dans le format attendu
    const pdfData = {
      // Informations administratives
      numeroActe: acte.numeroActe || 'En attente',
      dateEnregistrement: formatDate(acte.dateEnregistrement) || 'Non spécifiée',
      mairie: acte.mairie?.nom || 'Mairie non spécifiée',
      ville: acte.mairie?.ville || '',
      
      // Informations du défunt
      nomDefunt: acte.details.nomDefunt || 'Non renseigné',
      prenomsDefunt: acte.details.prenomsDefunt || 'Non renseigné',
      dateNaissanceDefunt: formatDate(acte.details.dateNaissanceDefunt),
      lieuNaissanceDefunt: acte.details.lieuNaissanceDefunt || 'Non renseigné',
      professionDefunt: acte.details.professionDefunt || 'Non renseignée',
      domicileDefunt: acte.details.domicileDefunt || 'Non renseigné',
      dateDeces: formatDate(acte.details.dateDeces) || 'Non spécifiée',
      heureDeces: acte.details.heureDeces || 'Non spécifiée',
      lieuDeces: acte.details.lieuDeces || 'Non renseigné',
      causeDeces: acte.details.causeDeces || 'Non spécifiée',
      
      // Informations du déclarant
      nomDeclarant: acte.details.nomDeclarant || 'Non renseigné',
      prenomsDeclarant: acte.details.prenomsDeclarant || 'Non renseigné',
      dateNaissanceDeclarant: formatDate(acte.details.dateNaissanceDeclarant),
      lieuNaissanceDeclarant: acte.details.lieuNaissanceDeclarant || 'Non renseigné',
      professionDeclarant: acte.details.professionDeclarant || 'Non renseignée',
      domicileDeclarant: acte.details.domicileDeclarant || 'Non renseigné',
      lienDeclarant: acte.details.lienDeclarant || 'Non spécifié',
      
      // Métadonnées
      createdAt: formatDate(acte.createdAt),
      createdBy: acte.createdBy ? 
        `${acte.createdBy.prenom} ${acte.createdBy.nom}` : 
        'Utilisateur inconnu'
    };

    // Générer le PDF
    const pdfBuffer = await generatePdf('deces', pdfData);

    // Configurer les en-têtes de la réponse
    const fileName = `acte-deces-${pdfData.numeroActe || 'sans-numero'}-${new Date().toISOString().split('T')[0]}.pdf`;
    
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': pdfBuffer.length,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    // Envoyer le PDF
    logger.info('PDF d\'acte de décès généré avec succès', { 
      id: acte._id,
      fileName,
      size: `${(pdfBuffer.length / 1024).toFixed(2)} KB`
    });
    
    res.send(pdfBuffer);

  } catch (error) {
    const errorId = Math.random().toString(36).substring(2, 9);
    const errorDetails = {
      id: errorId,
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
      method: req.method,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    };
    
    logger.error(`Erreur [${errorId}] lors de la génération du PDF de décès`, errorDetails);
    
    res.status(500).json({ 
      success: false,
      message: 'Une erreur est survenue lors de la génération du PDF de décès',
      errorId,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = decesController;
