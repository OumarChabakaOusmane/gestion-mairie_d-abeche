const { validationResult } = require('express-validator');
const mongoose = require('mongoose');
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
  const startTime = Date.now();
  const { id } = req.params;
  
  // Fonction utilitaire pour formater les dates
  const formatDate = (date) => {
    if (!date) return 'Non spécifiée';
    try {
      return format(new Date(date), 'dd MMMM yyyy', { locale: fr });
    } catch (e) {
      return date;
    }
  };

  try {
    // Utiliser le logger passé dans la requête ou le logger par défaut
    const log = req.log || ((message, data) => 
      console.log(`[${new Date().toISOString()}] ${message}`, data));
    
    log(`Début génération PDF pour l'acte de décès: ${id}`);
    
    // Vérifier si l'ID est valide
    if (!mongoose.Types.ObjectId.isValid(id)) {
      const errorMsg = `ID d'acte invalide: ${id}`;
      log(errorMsg);
      return res.status(400).json({ 
        success: false,
        message: errorMsg
      });
    }

    // Récupérer l'acte de décès avec les données associées
    log('Recherche de l\'acte dans la base de données...');
    const acte = await Acte.findOne({ _id: id, type: 'deces' })
      .populate('createdBy', 'nom prenom')
      .populate('mairie', 'nom ville')
      .lean()
      .maxTimeMS(10000); // Timeout de 10 secondes

    if (!acte) {
      const errorMsg = `Acte de décès non trouvé: ${id}`;
      log(errorMsg);
      return res.status(404).json({ 
        success: false,
        message: errorMsg
      });
    }
    
    log('Acte trouvé', {
      _id: acte._id,
      numeroActe: acte.numeroActe,
      type: acte.type,
      dateEnregistrement: acte.dateEnregistrement
    });

    // Vérifier que les détails existent
    if (!acte.details) {
      const errorMsg = 'Aucun détail trouvé pour cet acte de décès';
      log(errorMsg);
      return res.status(400).json({
        success: false,
        message: errorMsg
      });
    }

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

    log('Données préparées pour la génération du PDF');
    
    // Générer le PDF
    try {
      log('Début de la génération du PDF...');
      const pdfBuffer = await generatePdf('deces', pdfData);
      
      if (!pdfBuffer || !(pdfBuffer instanceof Buffer)) {
        const errorMsg = 'Le buffer du PDF est invalide';
        log(errorMsg, { 
          type: typeof pdfBuffer, 
          isBuffer: Buffer.isBuffer(pdfBuffer)
        });
        return res.status(500).json({
          success: false,
          message: errorMsg,
          requestId: req.id
        });
      }
      
      // Créer un nom de fichier sécurisé
      const safeFileName = `acte-deces-${(pdfData.numeroActe || 'sans-numero')
        .toString()
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')}-${Date.now()}.pdf`;
      
      log('PDF généré avec succès', { 
        bufferSize: pdfBuffer.length,
        fileName: safeFileName
      });
      
      // Configurer les en-têtes de la réponse
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${safeFileName}"`,
        'Content-Length': pdfBuffer.length,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Generated-At': new Date().toISOString(),
        'X-Acte-ID': id
      });
      
      // Envoyer le PDF
      return res.send(pdfBuffer);
      
    } catch (error) {
      log('Erreur lors de la génération du PDF', {
        error: error.message,
        stack: error.stack
      });
      
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la génération du PDF',
        error: error.message,
        requestId: req.id
      });
    }

  } catch (error) {
    const errorId = Math.random().toString(36).substr(2, 9);
    const errorDetails = {
      errorId,
      timestamp: new Date().toISOString(),
      message: error.message,
      name: error.name,
      stack: error.stack,
      acteId: id,
      params: req.params,
      query: req.query,
      duration: Date.now() - startTime
    };
    
    logger.error(`[${errorId}] Erreur lors de la génération du PDF`, errorDetails);
    
    // Préparer la réponse d'erreur
    const errorResponse = {
      success: false,
      message: 'Une erreur est survenue lors de la génération du PDF',
      errorId,
      timestamp: errorDetails.timestamp
    };
    
    // En mode développement, ajouter plus de détails
    if (process.env.NODE_ENV === 'development') {
      errorResponse.error = error.message;
      errorResponse.stack = error.stack;
      errorResponse.details = errorDetails;
    }
    
    res.status(500).json(errorResponse);
  }
};

module.exports = decesController;
