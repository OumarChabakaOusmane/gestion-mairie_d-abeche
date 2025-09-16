const mongoose = require('mongoose');
const { validationResult } = require('express-validator');
const { logger } = require('../config/logger');
const Mariage = require('../models/Mariage');
const { generatePdf } = require('../services/pdfService.unified');
const { format } = require('date-fns');
const { fr } = require('date-fns/locale');

// Définition du contrôleur
const mariageController = {};

/**
 * Crée un nouvel acte de mariage
 * @route POST /api/mariages
 * @access Privé (Admin, Officier d'état civil)
 */
mariageController.createMariage = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const {
      numeroActe,
      dateEnregistrement,
      mairie,
      // Données du conjoint 1
      conjoint1,
      conjoint1Prenom,
      dateNaissanceConjoint1,
      lieuNaissanceConjoint1,
      professionConjoint1,
      adresseConjoint1,
      nationaliteConjoint1,
      typePieceConjoint1,
      numeroPieceConjoint1,
      // Données du conjoint 2
      conjoint2,
      conjoint2Prenom,
      dateNaissanceConjoint2,
      lieuNaissanceConjoint2,
      professionConjoint2,
      adresseConjoint2,
      nationaliteConjoint2,
      typePieceConjoint2,
      numeroPieceConjoint2,
      // Détails du mariage
      dateMariage,
      lieuMariage,
      regimeMatrimonial,
      temoins = [],
      officierEtatCivil,
      observations
    } = req.body;

    // Créer un nouvel acte de mariage
    const nouvelActe = new Mariage({
      numeroActe,
      dateEnregistrement: dateEnregistrement || new Date(),
      mairie,
      // Données du conjoint 1
      conjoint1,
      conjoint1Prenom,
      dateNaissanceConjoint1: new Date(dateNaissanceConjoint1),
      lieuNaissanceConjoint1,
      professionConjoint1,
      adresseConjoint1,
      nationaliteConjoint1,
      typePieceConjoint1,
      numeroPieceConjoint1,
      // Données du conjoint 2
      conjoint2,
      conjoint2Prenom,
      dateNaissanceConjoint2: new Date(dateNaissanceConjoint2),
      lieuNaissanceConjoint2,
      professionConjoint2,
      adresseConjoint2,
      nationaliteConjoint2,
      typePieceConjoint2,
      numeroPieceConjoint2,
      // Détails du mariage
      dateMariage: new Date(dateMariage),
      lieuMariage,
      regimeMatrimonial,
      temoins,
      officierEtatCivil,
      observations,
      createdBy: req.user._id,
      lastModifiedBy: req.user._id
    });

    // Sauvegarder l'acte
    const acteSauvegarde = await nouvelActe.save({ session });
    
    // Valider la transaction
    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      success: true,
      message: 'Acte de mariage créé avec succès',
      data: acteSauvegarde
    });
  } catch (error) {
    // Annuler la transaction en cas d'erreur
    await session.abortTransaction();
    session.endSession();
    
    logger.error('Erreur lors de la création de l\'acte de mariage', {
      error: error.message,
      stack: error.stack,
      user: req.user ? req.user._id : 'non authentifié'
    });

    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de l\'acte de mariage',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Génère un PDF pour un acte de mariage
 * @route GET /api/actes/mariages/:id/pdf
 * @access Privé
 */
mariageController.generateMariagePdf = async (req, res) => {
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
    
    log(`Début génération PDF pour l'acte de mariage: ${id}`);
    
    // Vérifier si l'ID est valide
    if (!require('mongoose').Types.ObjectId.isValid(id)) {
      const errorMsg = `ID d'acte invalide: ${id}`;
      log(errorMsg);
      return res.status(400).json({ 
        success: false,
        message: errorMsg
      });
    }

    // Récupérer l'acte de mariage avec les relations
    log('Recherche de l\'acte dans la base de données...');
    const mariage = await Mariage.findById(id)
      .populate('conjoint1_details')
      .populate('conjoint2_details')
      .populate('temoins')
      .populate('mairie', 'nom ville')
      .lean()
      .maxTimeMS(10000); // Timeout de 10 secondes

    if (!mariage) {
      const errorMsg = `Acte de mariage non trouvé: ${id}`;
      log(errorMsg);
      return res.status(404).json({ 
        success: false,
        message: errorMsg
      });
    }

    log('Acte de mariage trouvé', {
      _id: mariage._id,
      numeroActe: mariage.numeroActe,
      dateMariage: mariage.dateMariage
    });

    // Vérifier les données requises
    const requiredFields = [
      'conjoint1', 'conjoint1Prenom', 'conjoint2Nom', 'conjoint2Prenom',
      'dateMariage', 'lieuMariage'
    ];
    const missingFields = requiredFields.filter(field => !mariage[field]);
    
    if (missingFields.length > 0) {
      const errorMsg = `Champs manquants pour la génération du PDF: ${missingFields.join(', ')}`;
      log(errorMsg);
      return res.status(400).json({
        success: false,
        message: errorMsg,
        missingFields
      });
    }

    // Convertir les témoins en tableau si ce n'est pas déjà le cas
    const temoins = Array.isArray(mariage.temoins) ? mariage.temoins : [];

    // Préparer les données pour le PDF dans le format attendu
    const pdfData = {
      // Informations générales
      numeroActe: mariage.numeroActe || 'En attente',
      ville: mariage.mairie?.ville || 'N\'Djamena',
      
      // Informations du conjoint 1 (Époux)
      conjoint1Nom: mariage.conjoint1 || 'Non renseigné',
      conjoint1Prenom: mariage.conjoint1Prenom || 'Non renseigné',
      dateNaissanceConjoint1: mariage.dateNaissanceConjoint1,
      lieuNaissanceConjoint1: mariage.lieuNaissanceConjoint1 || 'Non renseigné',
      professionConjoint1: mariage.professionConjoint1 || 'Non renseignée',
      adresseConjoint1: mariage.adresseConjoint1 || 'Non renseignée',
      nationaliteConjoint1: mariage.nationaliteConjoint1 || 'Non renseignée',
      
      // Informations du conjoint 2 (Épouse)
      conjoint2Nom: mariage.conjoint2Nom || 'Non renseigné',
      conjoint2Prenom: mariage.conjoint2Prenom || 'Non renseigné',
      dateNaissanceConjoint2: mariage.dateNaissanceConjointe2,
      lieuNaissanceConjoint2: mariage.lieuNaissanceConjointe2 || 'Non renseigné',
      professionConjoint2: mariage.professionConjointe2 || 'Non renseignée',
      adresseConjoint2: mariage.adresseConjointe2 || 'Non renseignée',
      nationaliteConjoint2: mariage.nationaliteConjointe2 || 'Non renseignée',
      
      // Détails du mariage
      dateMariage: mariage.dateMariage,
      lieuMariage: mariage.lieuMariage || 'Non spécifié',
      regimeMatrimonial: mariage.regimeMatrimonial || 'Non spécifié',
      contratMariage: mariage.contratMariage || false,
      
      // Témoins (limités à 4 témoins)
      temoins: temoins.slice(0, 4).map(temoin => ({
        nom: temoin.nom || 'Non renseigné',
        prenom: temoin.prenom || '',
        profession: temoin.profession || 'Non renseignée',
        adresse: temoin.adresse || 'Non renseignée'
      })),
      
      // Informations complémentaires
      observations: mariage.observations || 'Aucune observation',
      officierEtatCivil: mariage.officierEtatCivil || 'Non spécifié',
      
      // Métadonnées
      createdAt: formatDate(mariage.createdAt),
      createdBy: mariage.createdBy ? 
        `${mariage.createdBy.prenom} ${mariage.createdBy.nom}` : 
        'Utilisateur inconnu',
      
      // Données imbriquées pour la rétrocompatibilité
      conjoint1_details: mariage.conjoint1_details || {},
      conjoint2_details: mariage.conjoint2_details || {}
    };

    log('Données préparées pour la génération du PDF');
    
    // Générer le PDF
    try {
      log('Début de la génération du PDF...');
      const pdfBuffer = await generatePdf('mariage', pdfData);
      
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
      const safeFileName = `acte-mariage-${(pdfData.numeroActe || 'sans-numero')
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
      
      // Gestion spécifique des erreurs de police
      if (error.message.includes('font') || (error.stack && error.stack.includes('font'))) {
        log('ERREUR DE POLICE DÉTECTÉE - Vérifiez les polices système', {
          error: error.message
        });
      }
      
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la génération du PDF',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
        requestId: req.id,
        timestamp: new Date().toISOString()
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
    
    // Utiliser le logger de la requête s'il existe, sinon utiliser le logger par défaut
    const errorLog = req.log || logger.error;
    errorLog(`[${errorId}] Erreur lors de la génération du PDF de mariage`, errorDetails);
    
    res.status(500).json({
      success: false,
      message: 'Une erreur est survenue lors de la génération du PDF de mariage',
      errorId,
      timestamp: errorDetails.timestamp
    });
  }
};

/**
 * Récupère tous les actes de mariage avec pagination
 * @route GET /api/mariages
 * @access Privé
 */
mariageController.getAllMariages = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    const skip = (page - 1) * limit;
    
    // Construction de la requête de recherche
    const query = {};
    if (search) {
      query.$or = [
        { 'conjoint1': { $regex: search, $options: 'i' } },
        { 'conjoint1Prenom': { $regex: search, $options: 'i' } },
        { 'conjoint2': { $regex: search, $options: 'i' } },
        { 'conjoint2Prenom': { $regex: search, $options: 'i' } },
        { 'numeroActe': { $regex: search, $options: 'i' } }
      ];
    }

    const [mariages, total] = await Promise.all([
      Mariage.find(query)
        .sort({ dateMariage: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('mairie', 'nom ville')
        .lean(),
      Mariage.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: mariages,
      pagination: {
        total,
        page: parseInt(page),
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Erreur lors de la récupération des actes de mariage', {
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des actes de mariage',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Récupère un acte de mariage par son ID
 * @route GET /api/mariages/:id
 * @access Privé
 */
mariageController.getMariageById = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID invalide'
      });
    }

    const mariage = await Mariage.findById(id)
      .populate('mairie', 'nom ville')
      .populate('temoins', 'nom prenom profession adresse')
      .lean();

    if (!mariage) {
      return res.status(404).json({
        success: false,
        message: 'Acte de mariage non trouvé'
      });
    }

    res.json({
      success: true,
      data: mariage
    });
  } catch (error) {
    logger.error('Erreur lors de la récupération de l\'acte de mariage', {
      error: error.message,
      stack: error.stack,
      id: req.params.id
    });
    
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de l\'acte de mariage',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Met à jour un acte de mariage existant
 * @route PUT /api/mariages/:id
 * @access Privé (Admin, Officier d'état civil)
 */
mariageController.updateMariage = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { id } = req.params;
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID invalide'
      });
    }

    // Préparer les données de mise à jour
    const updateData = {
      ...req.body,
      lastModifiedBy: req.user._id,
      lastModifiedAt: new Date()
    };

    // Mettre à jour l'acte
    const mariage = await Mariage.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, session, runValidators: true }
    );

    if (!mariage) {
      return res.status(404).json({
        success: false,
        message: 'Acte de mariage non trouvé'
      });
    }

    await session.commitTransaction();
    session.endSession();

    res.json({
      success: true,
      message: 'Acte de mariage mis à jour avec succès',
      data: mariage
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
    logger.error('Erreur lors de la mise à jour de l\'acte de mariage', {
      error: error.message,
      stack: error.stack,
      id: req.params.id,
      user: req.user ? req.user._id : 'non authentifié'
    });

    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour de l\'acte de mariage',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Supprime un acte de mariage
 * @route DELETE /api/mariages/:id
 * @access Privé (Admin)
 */
mariageController.deleteMariage = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID invalide'
      });
    }

    const mariage = await Mariage.findByIdAndDelete(id, { session });
    
    if (!mariage) {
      return res.status(404).json({
        success: false,
        message: 'Acte de mariage non trouvé'
      });
    }

    await session.commitTransaction();
    session.endSession();

    res.json({
      success: true,
      message: 'Acte de mariage supprimé avec succès',
      data: { id }
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
    logger.error('Erreur lors de la suppression de l\'acte de mariage', {
      error: error.message,
      stack: error.stack,
      id: req.params.id,
      user: req.user ? req.user._id : 'non authentifié'
    });

    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression de l\'acte de mariage',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = mariageController;
