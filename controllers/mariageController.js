const { validationResult } = require('express-validator');
const { logger } = require('../config/logger');
const Mariage = require('../models/Mariage');
const { generatePdf } = require('../services/pdfService');

// Définition du contrôleur
const mariageController = {};

/**
 * Génère un PDF pour un acte de mariage
 * @route GET /api/mariages/:id/pdf
 * @access Privé
 */
mariageController.generateMariagePdf = async (req, res) => {
  try {
    // Vérifier les erreurs de validation
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('Validation failed', { errors: errors.array() });
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    
    // Récupérer l'acte de mariage avec les relations
    const mariage = await Mariage.findById(id)
      .populate('conjoint1_details')
      .populate('conjoint2_details')
      .populate('temoins');

    if (!mariage) {
      logger.warn('Acte de mariage non trouvé', { id });
      return res.status(404).json({ message: 'Acte de mariage non trouvé' });
    }

    // Convertir les témoins en tableau si ce n'est pas déjà le cas
    const temoins = Array.isArray(mariage.temoins) ? mariage.temoins : [];

    // Préparer les données pour le PDF dans le format attendu
    const pdfData = {
      // Informations générales
      numeroActe: mariage.numeroActe,
      dateEnregistrement: mariage.dateEnregistrement,
      mairie: mariage.mairie,
      
      // Informations du conjoint 1
      conjoint1: mariage.conjoint1,
      conjoint1Prenom: mariage.conjoint1Prenom,
      dateNaissanceConjoint1: mariage.dateNaissanceConjoint1,
      lieuNaissanceConjoint1: mariage.lieuNaissanceConjoint1,
      professionConjoint1: mariage.professionConjoint1,
      adresseConjoint1: mariage.adresseConjoint1,
      nationaliteConjoint1: mariage.nationaliteConjoint1,
      typePieceConjoint1: mariage.typePieceConjoint1,
      numeroPieceConjoint1: mariage.numeroPieceConjoint1,
      pereConjoint1: mariage.pereConjoint1,
      mereConjoint1: mariage.mereConjoint1,
      
      // Informations du conjoint 2
      conjoint2Nom: mariage.conjoint2Nom,
      conjoint2Prenom: mariage.conjoint2Prenom,
      dateNaissanceConjointe2: mariage.dateNaissanceConjointe2,
      lieuNaissanceConjointe2: mariage.lieuNaissanceConjointe2,
      professionConjointe2: mariage.professionConjointe2,
      adresseConjointe2: mariage.adresseConjointe2,
      nationaliteConjointe2: mariage.nationaliteConjointe2,
      typePieceConjointe2: mariage.typePieceConjointe2,
      numeroPieceConjointe2: mariage.numeroPieceConjointe2,
      pereConjointe2: mariage.pereConjointe2,
      mereConjointe2: mariage.mereConjointe2,
      
      // Détails du mariage
      dateMariage: mariage.dateMariage,
      lieuMariage: mariage.lieuMariage,
      regimeMatrimonial: mariage.regimeMatrimonial,
      contratMariage: mariage.contratMariage,
      
      // Témoins
      temoins: temoins.map(temoin => ({
        nom: temoin.nom,
        prenom: temoin.prenom,
        profession: temoin.profession,
        adresse: temoin.adresse,
        residence: temoin.residence
      })),
      
      // Informations complémentaires
      observations: mariage.observations,
      officierEtatCivil: mariage.officierEtatCivil,
      
      // Données imbriquées pour la rétrocompatibilité
      conjoint1_details: mariage.conjoint1_details,
      conjoint2_details: mariage.conjoint2_details
    };

    // Générer le PDF
    const pdfBuffer = await generatePdf('mariage', pdfData);

    // Configurer les en-têtes de la réponse
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="acte-mariage-${pdfData.numeroActe}.pdf"`,
      'Content-Length': pdfBuffer.length
    });

    // Envoyer le PDF
    logger.info('PDF généré avec succès', { id: mariage._id });
    res.send(pdfBuffer);

  } catch (error) {
    logger.error('Erreur lors de la génération du PDF de mariage', { 
      error: error.message,
      stack: error.stack 
    });
    res.status(500).json({ 
      message: 'Une erreur est survenue lors de la génération du PDF',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = mariageController;
