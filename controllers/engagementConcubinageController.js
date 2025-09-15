const EngagementConcubinage = require('../models/EngagementConcubinage');
const { generatePdf } = require('../services/pdfService');
const logger = require('../config/logger');
const mongoose = require('mongoose');
const { validationResult } = require('express-validator');
const { body, param } = require('express-validator');

// Middleware de validation pour les paramètres d'ID
const validateIdParam = [
  param('id')
    .notEmpty().withMessage('L\'ID est requis')
    .isMongoId().withMessage('ID invalide')
];

// Middleware de validation pour la création d'un engagement
const validateCreateEngagement = [
  body('concubin1.nom').notEmpty().withMessage('Le nom du premier concubin est requis'),
  body('concubin1.prenoms').notEmpty().withMessage('Les prénoms du premier concubin sont requis'),
  body('concubin1.dateNaissance').isISO8601().withMessage('Date de naissance invalide pour le premier concubin'),
  body('concubin2.nom').notEmpty().withMessage('Le nom du deuxième concubin est requis'),
  body('concubin2.prenoms').notEmpty().withMessage('Les prénoms du deuxième concubin sont requis'),
  body('concubin2.dateNaissance').isISO8601().withMessage('Date de naissance invalide pour le deuxième concubin'),
  body('dateDebutConcubinage').isISO8601().withMessage('Date de début de concubinage invalide'),
  body('lieuEtablissement').notEmpty().withMessage('Le lieu d\'établissement est requis'),
  body('officierEtatCivil').notEmpty().withMessage('Le nom de l\'officier d\'état civil est requis')
];

// Middleware de validation pour la mise à jour d'un engagement
const validateUpdateEngagement = [
  ...validateIdParam,
  body('concubin1.nom').optional().notEmpty().withMessage('Le nom du premier concubin ne peut pas être vide'),
  body('concubin1.prenoms').optional().notEmpty().withMessage('Les prénoms du premier concubin ne peuvent pas être vides'),
  body('concubin2.nom').optional().notEmpty().withMessage('Le nom du deuxième concubin ne peut pas être vide'),
  body('concubin2.prenoms').optional().notEmpty().withMessage('Les prénoms du deuxième concubin ne peuvent pas être vides'),
  body('dateDebutConcubinage').optional().isISO8601().withMessage('Date de début de concubinage invalide')
];

// Middleware de validation pour la rupture d'un engagement
const validateTerminateEngagement = [
  ...validateIdParam,
  body('motif').notEmpty().withMessage('Le motif de la rupture est requis')
];

// Gestionnaire d'erreurs centralisé
const handleError = (res, error, context = '') => {
  const errorId = Math.random().toString(36).substr(2, 9);
  const errorMessage = error.message || 'Une erreur est survenue';
  const errorStack = process.env.NODE_ENV === 'development' ? error.stack : undefined;
  
  logger.error(`${context} [${errorId}]`, {
    error: errorMessage,
    stack: errorStack,
    errorId
  });

  // Gestion des erreurs de validation
  if (error.name === 'ValidationError') {
    const errors = Object.values(error.errors).map(err => ({
      field: err.path,
      message: err.message
    }));
    
    return res.status(400).json({
      success: false,
      message: 'Erreur de validation des données',
      errors,
      errorId
    });
  }

  // Gestion des erreurs de doublon
  if (error.code === 11000) {
    const field = Object.keys(error.keyPattern)[0];
    return res.status(409).json({
      success: false,
      message: `La valeur du champ ${field} est déjà utilisée`,
      field,
      errorId
    });
  }

  // Gestion des erreurs Mongoose
  if (error.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: 'Identifiant invalide',
      errorId
    });
  }

  // Erreur serveur par défaut
  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'development' ? errorMessage : 'Erreur serveur',
    errorId: process.env.NODE_ENV === 'development' ? errorId : undefined
  });
};

/**
 * Créer un nouvel engagement de concubinage
 */
/**
 * Crée un nouvel engagement de concubinage
 * @route POST /api/engagements
 * @access Privé (admin, officier_etat_civil)
 * @param {Object} req - La requête HTTP
 * @param {Object} res - La réponse HTTP
 * @returns {Promise<void>}
 */
exports.createEngagement = [
  ...validateCreateEngagement,
  async (req, res) => {
    try {
      // Vérifier les erreurs de validation
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Erreur de validation des données',
          errors: errors.array()
        });
      }

      const engagementData = req.body;
      
      // Vérifier si un engagement similaire existe déjà
      const existingEngagement = await EngagementConcubinage.findOne({
        $or: [
          {
            'concubin1.numeroPieceIdentite': engagementData.concubin1.numeroPieceIdentite,
            'concubin2.numeroPieceIdentite': engagementData.concubin2.numeroPieceIdentite,
            statut: 'actif'
          },
          {
            'concubin1.numeroPieceIdentite': engagementData.concubin2.numeroPieceIdentite,
            'concubin2.numeroPieceIdentite': engagementData.concubin1.numeroPieceIdentite,
            statut: 'actif'
          }
        ]
      }).lean();

      if (existingEngagement) {
        return res.status(409).json({
          success: false,
          message: 'Un engagement de concubinage actif existe déjà entre ces deux personnes',
          existingEngagementId: existingEngagement._id
        });
      }

      // Nettoyer et valider les données
      const cleanData = {
        ...engagementData,
        concubin1: {
          ...engagementData.concubin1,
          nom: engagementData.concubin1.nom.trim(),
          prenoms: engagementData.concubin1.prenoms.trim(),
          dateNaissance: new Date(engagementData.concubin1.dateNaissance)
        },
        concubin2: {
          ...engagementData.concubin2,
          nom: engagementData.concubin2.nom.trim(),
          prenoms: engagementData.concubin2.prenoms.trim(),
          dateNaissance: new Date(engagementData.concubin2.dateNaissance)
        },
        dateDebutConcubinage: new Date(engagementData.dateDebutConcubinage),
        statut: 'actif',
        createdBy: req.user.id,
        mairie: req.user.mairie // Associer automatiquement à la mairie de l'utilisateur
      };

      const engagement = new EngagementConcubinage(cleanData);
      await engagement.save();
      
      // Peupler les références pour la réponse
      const savedEngagement = await EngagementConcubinage.findById(engagement._id)
        .populate('createdBy', 'nom prenom')
        .populate('mairie', 'nom ville')
        .lean();
      
      logger.info('Engagement de concubinage créé avec succès', { 
        engagementId: savedEngagement._id, 
        userId: req.user.id,
        mairie: req.user.mairie,
        requestId: req.id
      });
      
      res.status(201).json({
        success: true,
        message: 'Engagement de concubinage créé avec succès',
        data: savedEngagement
      });
    } catch (error) {
      handleError(res, error, 'Erreur lors de la création de l\'engagement de concubinage');
    }
  }
];

/**
 * Récupère un engagement de concubinage par son ID
 * @route GET /api/engagements/:id
 * @access Privé
 * @param {Object} req - La requête HTTP
 * @param {string} req.params.id - L'ID de l'engagement
 * @param {Object} res - La réponse HTTP
 * @returns {Promise<void>}
 */
exports.getEngagementById = [
  ...validateIdParam,
  async (req, res) => {
    const { id } = req.params;
    
    try {
      // Vérifier si l'utilisateur a le droit d'accéder à cette mairie
      const userMairie = req.user.mairie;
      
      const query = { _id: id };
      
      // Si l'utilisateur n'est pas admin, filtrer par mairie
      if (req.user.role !== 'admin') {
        query.mairie = userMairie;
      }
      
      const engagement = await EngagementConcubinage.findOne(query)
        .populate('createdBy', 'nom prenom')
        .populate('updatedBy', 'nom prenom')
        .populate('mairie', 'nom ville')
        .lean({ getters: true })
        .maxTimeMS(10000); // 10 secondes timeout
        
      if (!engagement) {
        logger.warn('Engagement de concubinage non trouvé ou accès non autorisé', { 
          engagementId: id,
          userId: req.user.id,
          userMairie,
          requestId: req.id
        });
        
        return res.status(404).json({
          success: false,
          message: 'Engagement de concubinage non trouvé ou accès non autorisé',
          requestId: req.id
        });
      }
      
      // Formater les dates pour l'affichage
      const formatDate = (date) => {
        if (!date) return null;
        return new Date(date).toISOString().split('T')[0];
      };
      
      const formattedEngagement = {
        ...engagement,
        dateDebutConcubinage: formatDate(engagement.dateDebutConcubinage),
        concubin1: {
          ...engagement.concubin1,
          dateNaissance: formatDate(engagement.concubin1.dateNaissance)
        },
        concubin2: {
          ...engagement.concubin2,
          dateNaissance: formatDate(engagement.concubin2.dateNaissance)
        },
        // Masquer les champs sensibles si l'utilisateur n'est pas admin ou officier
        ...(req.user.role === 'utilisateur' ? {
          concubin1: {
            ...engagement.concubin1,
            numeroPieceIdentite: '******',
            adresse: '******'
          },
          concubin2: {
            ...engagement.concubin2,
            numeroPieceIdentite: '******',
            adresse: '******'
          }
        } : {})
      };
      
      logger.info('Engagement de concubinage récupéré avec succès', {
        engagementId: id,
        userId: req.user.id,
        requestId: req.id
      });
      
      res.json({
        success: true,
        data: formattedEngagement
      });
    } catch (error) {
      handleError(res, error, 'Erreur lors de la récupération de l\'engagement de concubinage');
    }
  }
];

/**
 * Met à jour un engagement de concubinage existant
 * @route PUT /api/engagements/:id
 * @access Privé (admin, officier_etat_civil)
 * @param {Object} req - La requête HTTP
 * @param {string} req.params.id - L'ID de l'engagement à mettre à jour
 * @param {Object} req.body - Les données de mise à jour
 * @param {Object} res - La réponse HTTP
 * @returns {Promise<void>}
 */
exports.updateEngagement = [
  ...validateUpdateEngagement,
  async (req, res) => {
    const { id } = req.params;
    
    try {
      // Vérifier les erreurs de validation
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Erreur de validation des données',
          errors: errors.array(),
          requestId: req.id
        });
      }
      
      const updates = req.body;
      
      // Construire la requête avec contrôle d'accès
      const query = { _id: id };
      
      // Si l'utilisateur n'est pas admin, limiter à sa mairie
      if (req.user.role !== 'admin') {
        query.mairie = req.user.mairie;
      }
      
      // Vérifier si l'engagement existe et est accessible
      let engagement = await EngagementConcubinage.findOne(query);
      
      if (!engagement) {
        logger.warn('Tentative de mise à jour d\'un engagement inexistant ou non autorisé', { 
          engagementId: id,
          userId: req.user.id,
          userRole: req.user.role,
          userMairie: req.user.mairie,
          requestId: req.id
        });
        
        return res.status(404).json({
          success: false,
          message: 'Engagement de concubinage non trouvé ou accès non autorisé',
          requestId: req.id
        });
      }
      
      // Vérifier si l'engagement peut être modifié (statut actif)
      if (engagement.statut !== 'actif') {
        return res.status(400).json({
          success: false,
          message: 'Seuls les engagements actifs peuvent être modifiés',
          currentStatus: engagement.statut,
          requestId: req.id
        });
      }
      
      // Nettoyer et valider les données de mise à jour
      const cleanUpdates = {};
      
      // Champs autorisés pour la mise à jour
      const allowedFields = [
        'concubin1', 'concubin2', 'dateDebutConcubinage', 'lieuEtablissement',
        'officierEtatCivil', 'regimeMatrimonial', 'observations'
      ];
      
      // Filtrer et nettoyer les mises à jour
      Object.keys(updates).forEach(key => {
        if (allowedFields.includes(key)) {
          if (key === 'concubin1' || key === 'concubin2') {
            // Nettoyer les champs des concubins
            cleanUpdates[key] = {
              ...updates[key],
              nom: updates[key].nom?.trim(),
              prenoms: updates[key].prenoms?.trim(),
              dateNaissance: updates[key].dateNaissance ? new Date(updates[key].dateNaissance) : undefined
            };
          } else if (key === 'dateDebutConcubinage') {
            cleanUpdates[key] = new Date(updates[key]);
          } else {
            cleanUpdates[key] = updates[key];
          }
        }
      });
      
      // Appliquer les mises à jour
      Object.assign(engagement, cleanUpdates);
      
      // Mettre à jour les métadonnées
      engagement.updatedBy = req.user.id;
      engagement.updatedAt = new Date();
      
      // Sauvegarder avec validation
      await engagement.save({ validateBeforeSave: true });
      
      // Récupérer l'engagement mis à jour avec les données peuplées
      const updatedEngagement = await EngagementConcubinage.findById(id)
        .populate('createdBy', 'nom prenom')
        .populate('updatedBy', 'nom prenom')
        .populate('mairie', 'nom ville')
        .lean();
      
      logger.info('Engagement de concubinage mis à jour avec succès', { 
        engagementId: id, 
        userId: req.user.id,
        updatedFields: Object.keys(cleanUpdates),
        requestId: req.id
      });
      
      res.json({
        success: true,
        message: 'Engagement de concubinage mis à jour avec succès',
        data: updatedEngagement,
        requestId: req.id
      });
      
    } catch (error) {
      // Gestion des erreurs de doublon
      if (error.code === 11000) {
        const field = Object.keys(error.keyPattern)[0];
        return res.status(409).json({
          success: false,
          message: `La valeur du champ ${field} est déjà utilisée`,
          field,
          requestId: req.id
        });
      }
      
      // Gestion des autres erreurs
      logger.error('Erreur lors de la mise à jour de l\'engagement de concubinage', {
        error: error.message,
        stack: error.stack,
        engagementId: id,
        userId: req.user?.id,
        requestId: req.id
      });
      
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la mise à jour de l\'engagement de concubinage',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur serveur',
        requestId: req.id
      });
    }
  }
];

/**
 * Rompt un engagement de concubinage existant
 * @route POST /api/engagements/:id/terminer
 * @access Privé (admin, officier_etat_civil)
 * @param {Object} req - La requête HTTP
 * @param {string} req.params.id - L'ID de l'engagement à rompre
 * @param {Object} req.body - Les données de rupture
 * @param {string} req.body.motif - Le motif de la rupture
 * @param {Object} res - La réponse HTTP
 * @returns {Promise<void>}
 */
exports.terminateEngagement = [
  ...validateTerminateEngagement,
  async (req, res) => {
    const { id } = req.params;
    const { motif } = req.body;
    
    try {
      // Vérifier les erreurs de validation
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Erreur de validation des données',
          errors: errors.array(),
          requestId: req.id
        });
      }
      
      // Construire la requête avec contrôle d'accès
      const query = { _id: id };
      
      // Si l'utilisateur n'est pas admin, limiter à sa mairie
      if (req.user.role !== 'admin') {
        query.mairie = req.user.mairie;
      }
      
      // Vérifier si l'engagement existe et est accessible
      const engagement = await EngagementConcubinage.findOne(query);
      
      if (!engagement) {
        logger.warn('Tentative de rupture d\'un engagement inexistant ou non autorisé', { 
          engagementId: id,
          userId: req.user.id,
          userRole: req.user.role,
          userMairie: req.user.mairie,
          requestId: req.id
        });
        
        return res.status(404).json({
          success: false,
          message: 'Engagement de concubinage non trouvé ou accès non autorisé',
          requestId: req.id
        });
      }
      
      // Vérifier si l'engagement peut être rompu (doit être actif)
      if (engagement.statut !== 'actif') {
        return res.status(400).json({
          success: false,
          message: `Impossible de rompre un engagement qui n'est pas actif (statut actuel: ${engagement.statut})`,
          currentStatus: engagement.statut,
          requestId: req.id
        });
      }
      
      // Mettre à jour l'engagement
      const now = new Date();
      engagement.statut = 'rompu';
      engagement.dateFinConcubinage = now;
      engagement.motifRupture = motif.trim();
      engagement.updatedBy = req.user.id;
      engagement.updatedAt = now;
      
      await engagement.save({ validateBeforeSave: true });
      
      // Récupérer l'engagement mis à jour avec les données peuplées
      const updatedEngagement = await EngagementConcubinage.findById(id)
        .populate('createdBy', 'nom prenom')
        .populate('updatedBy', 'nom prenom')
        .populate('mairie', 'nom ville')
        .lean();
      
      logger.info('Engagement de concubinage rompu avec succès', { 
        engagementId: id, 
        userId: req.user.id,
        motif: motif,
        requestId: req.id
      });
      
      res.json({
        success: true,
        message: 'Engagement de concubinage rompu avec succès',
        data: updatedEngagement,
        requestId: req.id
      });
      
    } catch (error) {
      handleError(res, error, 'Erreur lors de la rupture de l\'engagement de concubinage');
    }
  }
];

/**
 * Supprime un engagement de concubinage (marquage comme supprimé)
 * @route DELETE /api/engagements/:id
 * @access Privé (admin, officier_etat_civil)
 * @param {Object} req - La requête HTTP
 * @param {string} req.params.id - L'ID de l'engagement à supprimer
 * @param {Object} res - La réponse HTTP
 * @returns {Promise<void>}
 */
exports.deleteEngagement = [
  ...validateIdParam,
  async (req, res) => {
    const { id } = req.params;
    
    try {
      // Construire la requête avec contrôle d'accès
      const query = { _id: id };
      
      // Si l'utilisateur n'est pas admin, limiter à sa mairie
      if (req.user.role !== 'admin') {
        query.mairie = req.user.mairie;
      }
      
      // Vérifier si l'engagement existe et est accessible
      const engagement = await EngagementConcubinage.findOne(query);
      
      if (!engagement) {
        logger.warn('Tentative de suppression d\'un engagement inexistant ou non autorisé', { 
          engagementId: id,
          userId: req.user.id,
          userRole: req.user.role,
          userMairie: req.user.mairie,
          requestId: req.id
        });
        
        return res.status(404).json({
          success: false,
          message: 'Engagement de concubinage non trouvé ou accès non autorisé',
          requestId: req.id
        });
      }
      
      // Vérifier si l'engagement peut être supprimé (statut actif ou rompu)
      if (!['actif', 'rompu'].includes(engagement.statut)) {
        return res.status(400).json({
          success: false,
          message: `Impossible de supprimer un engagement avec le statut: ${engagement.statut}`,
          currentStatus: engagement.statut,
          requestId: req.id
        });
      }
      
      // Marquer comme supprimé (soft delete)
      engagement.statut = 'supprime';
      engagement.updatedBy = req.user.id;
      engagement.updatedAt = new Date();
      
      await engagement.save({ validateBeforeSave: true });
      
      logger.info('Engagement de concubinage marqué comme supprimé', { 
        engagementId: id, 
        userId: req.user.id,
        requestId: req.id
      });
      
      res.json({
        success: true,
        message: 'Engagement de concubinage marqué comme supprimé avec succès',
        data: { _id: id },
        requestId: req.id
      });
      
    } catch (error) {
      handleError(res, error, 'Erreur lors de la suppression de l\'engagement de concubinage');
    }
  }
];

/**
 * Génère un PDF pour un engagement de concubinage
 * @route GET /api/engagements-concubinage/:id/pdf
 * @access Privé
 * @param {Object} req - La requête HTTP
 * @param {Object} res - La réponse HTTP
 * @returns {Promise<void>}
 */
exports.generateEngagementPdf = [
  ...validateIdParam,
  async (req, res) => {
    const { id } = req.params;
    
    try {
      // Construire la requête avec contrôle d'accès
      const query = { _id: id };
      
      // Si l'utilisateur n'est pas admin, limiter à sa mairie
      if (req.user.role !== 'admin') {
        query.mairie = req.user.mairie;
      }
      
      // Récupérer l'engagement avec les données peuplées
      const engagement = await EngagementConcubinage.findOne(query)
        .populate('createdBy', 'nom prenom')
        .populate('mairie', 'nom ville adresse')
        .lean();
      
      if (!engagement) {
        logger.warn('Tentative de génération PDF d\'un engagement inexistant ou non autorisé', { 
          engagementId: id,
          userId: req.user.id,
          userRole: req.user.role,
          userMairie: req.user.mairie,
          requestId: req.id
        });
        
        return res.status(404).json({
          success: false,
          message: 'Engagement de concubinage non trouvé ou accès non autorisé',
          requestId: req.id
        });
      }
      
      // Générer le PDF
      const pdfBuffer = await generatePdf('engagement-concubinage', {
        ...engagement,
        // Formater les dates pour l'affichage
        dateDebutConcubinage: engagement.dateDebutConcubinage?.toLocaleDateString('fr-FR'),
        dateFinConcubinage: engagement.dateFinConcubinage?.toLocaleDateString('fr-FR'),
        // Ajouter les informations de l'utilisateur connecté
        generatedBy: `${req.user.prenom} ${req.user.nom}`,
        generationDate: new Date().toLocaleDateString('fr-FR')
      });
      
      // Envoyer le PDF en réponse
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=engagement-concubinage-${id}.pdf`,
        'Content-Length': pdfBuffer.length
      });
      
      logger.info('PDF généré avec succès pour l\'engagement de concubinage', { 
        engagementId: id, 
        userId: req.user.id,
        requestId: req.id
      });
      
      res.send(pdfBuffer);
      
    } catch (error) {
      handleError(res, error, 'Erreur lors de la génération du PDF de l\'engagement de concubinage');
    }
  }
];


/**
 * Supprime un engagement de concubinage
 * @route DELETE /api/engagements/:id
 * @access Privé (Admin)
 * @param {Object} req - La requête HTTP
 * @param {string} req.params.id - L'ID de l'engagement à supprimer
 * @param {Object} res - La réponse HTTP
 * @returns {Promise<void>}
 */
exports.deleteEngagement = async (req, res) => {
  const { id } = req.params;
  
  try {
    // Vérifier d'abord si l'engagement existe
    const engagement = await EngagementConcubinage.findById(id);
    
    if (!engagement) {
      logger.warn('Tentative de suppression d\'un engagement non trouvé', {
        engagementId: id,
        userId: req.user?.id,
        requestId: req.id
      });
      
      return res.status(404).json({
        success: false,
        message: 'Engagement de concubinage non trouvé',
        requestId: req.id
      });
    }
    
    // Supprimer l'engagement
    await EngagementConcubinage.findByIdAndDelete(id);
    
    logger.info('Engagement de concubinage supprimé avec succès', { 
      engagementId: id, 
      userId: req.user?.id,
      requestId: req.id
    });
    
    res.json({
      success: true,
      message: 'Engagement de concubinage supprimé avec succès',
      requestId: req.id
    });
  } catch (error) {
    logger.error('Erreur lors de la suppression de l\'engagement de concubinage', {
      error: error.message,
      stack: error.stack,
      engagementId: id,
      userId: req.user?.id,
      requestId: req.id
    });
    
    // Gestion des erreurs spécifiques
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'ID d\'engagement invalide',
        requestId: req.id
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Une erreur est survenue lors de la suppression de l\'engagement de concubinage',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur serveur',
      requestId: req.id
    });
  }
};

/**
 * Liste les engagements de concubinage avec pagination et filtres
 * @route GET /api/engagements
 * @access Privé
 * @param {Object} req - La requête HTTP
 * @param {string} [req.query.page=1] - Numéro de la page
 * @param {string} [req.query.limit=10] - Nombre d'éléments par page
 * @param {string} [req.query.search=''] - Terme de recherche (nom, prénom, numéro de pièce d'identité)
 * @param {string} [req.query.statut] - Filtre par statut (actif, rompu, etc.)
 * @param {string} [req.query.dateDebut] - Filtre par date de début (format: YYYY-MM-DD)
 * @param {string} [req.query.dateFin] - Filtre par date de fin (format: YYYY-MM-DD)
 * @param {Object} res - La réponse HTTP
 * @returns {Promise<void>}
 */
exports.listEngagements = async (req, res) => {
  try {
    // Récupération et validation des paramètres de requête
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
    const { search = '', statut, dateDebut, dateFin } = req.query;
    const skip = (page - 1) * limit;
    
    // Construction de la requête de base
    const query = {};
    
    // Filtre par statut si fourni
    if (statut) {
      query.statut = statut;
    }
    
    // Filtre par date de début si fournie
    if (dateDebut) {
      query.dateDebut = { $gte: new Date(dateDebut) };
    }
    
    // Filtre par date de fin si fournie
    if (dateFin) {
      if (!query.dateDebut) query.dateDebut = {};
      query.dateDebut.$lte = new Date(dateFin);
    }
    
    // Recherche par nom/prénom/numéro de pièce d'identité
    if (search) {
      const searchRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [
        { 'concubin1.nom': searchRegex },
        { 'concubin1.prenom': searchRegex },
        { 'concubin2.nom': searchRegex },
        { 'concubin2.prenom': searchRegex },
        { 'concubin1.numeroPieceIdentite': search },
        { 'concubin2.numeroPieceIdentite': search }
      ];
    }
    
    // Exécution des requêtes en parallèle pour la pagination
    const [engagements, total] = await Promise.all([
      EngagementConcubinage.find(query)
        .sort({ dateDebut: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .populate('createdBy', 'nom prenom')
        .populate('updatedBy', 'nom prenom')
        .populate('mairie', 'nom ville')
        .lean()
        .maxTimeMS(30000), // 30 secondes de timeout
      
      EngagementConcubinage.countDocuments(query)
        .maxTimeMS(30000) // 30 secondes de timeout
    ]);
    
    // Calcul du nombre total de pages
    const totalPages = Math.ceil(total / limit);
    
    logger.info('Liste des engagements récupérée avec succès', {
      count: engagements.length,
      total,
      page,
      limit,
      requestId: req.id
    });
    
    // Construction de la réponse
    const response = {
      success: true,
      data: engagements,
      pagination: {
        total,
        page,
        limit,
        pages: totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    };
    
    // Ajout des liens pour la pagination (si HATEOAS est activé)
    if (req.query.hateoas === 'true') {
      const baseUrl = `${req.protocol}://${req.get('host')}${req.baseUrl}?page=`;
      
      response.links = {
        first: `${baseUrl}1&limit=${limit}`,
        last: `${baseUrl}${totalPages}&limit=${limit}`,
        prev: page > 1 ? `${baseUrl}${page - 1}&limit=${limit}` : null,
        next: page < totalPages ? `${baseUrl}${page + 1}&limit=${limit}` : null
      };
    }
    
    res.json(response);
  } catch (error) {
    logger.error('Erreur lors de la récupération de la liste des engagements', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id,
      requestId: req.id,
      query: req.query
    });
    
    // Gestion des erreurs spécifiques
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Paramètres de requête invalides',
        requestId: req.id
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Une erreur est survenue lors de la récupération des engagements',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur serveur',
      requestId: req.id
    });
  }
};

/**
 * Obtient des statistiques sur les engagements de concubinage
 * @route GET /api/engagements/stats
 * @access Privé
 * @param {Object} req - La requête HTTP
 * @param {Object} res - La réponse HTTP
 * @returns {Promise<void>}
 */
exports.getEngagementStats = async (req, res) => {
  try {
    // Construire la requête avec contrôle d'accès
    const matchStage = {};
    
    // Filtrage par mairie pour les non-admins
    if (req.user.role !== 'admin') {
      matchStage.mairie = new mongoose.Types.ObjectId(req.user.mairie);
    }
    
    // Agrégation pour obtenir les statistiques
    const stats = await EngagementConcubinage.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$statut',
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          statut: '$_id',
          count: 1
        }
      },
      { $sort: { statut: 1 } }
    ]);
    
    // Calculer le total
    const total = stats.reduce((sum, stat) => sum + stat.count, 0);
    
    // Formater la réponse
    res.json({
      success: true,
      data: {
        total,
        stats
      },
      requestId: req.id
    });
    
  } catch (error) {
    handleError(res, error, 'Erreur lors de la récupération des statistiques des engagements');
  }
};

/**
 * Génère un PDF pour un engagement de concubinage
 * @route GET /api/engagements-concubinage/:id/pdf
 * @access Privé
 * @param {Object} req - La requête HTTP
 * @param {Object} res - La réponse HTTP
 * @returns {Promise<void>}
 */
exports.generateEngagementPdf = async (req, res) => {
    const startTime = Date.now();
    const { id } = req.params;
    
    // Fonction utilitaire pour formater les dates
    const formatDate = (date) => {
        if (!date) return 'Non spécifiée';
        try {
            const { format } = require('date-fns');
            const { fr } = require('date-fns/locale');
            return format(new Date(date), 'dd MMMM yyyy', { locale: fr });
        } catch (e) {
            return date;
        }
    };

    // Utiliser le logger passé dans la requête ou le logger par défaut
    const log = req.log || ((message, data) => 
        console.log(`[${new Date().toISOString()}] ${message}`, data));
    
    log(`Début génération PDF pour l'engagement de concubinage: ${id}`, { 
        requestId: req.id,
        userId: req.user?._id,
        userRole: req.user?.role
    });
    
    // Vérifier si l'ID est valide
    if (!require('mongoose').Types.ObjectId.isValid(id)) {
        const errorMsg = `ID d'engagement invalide: ${id}`;
        log(errorMsg, { requestId: req.id, status: 400 });
        return res.status(400).json({ 
            success: false,
            message: errorMsg,
            requestId: req.id
        });
    }

    try {
        // Récupérer l'engagement avec les données associées
        log('Recherche de l\'engagement dans la base de données...', { requestId: req.id });
        
        const engagement = await EngagementConcubinage.findById(id)
            .populate('createdBy', 'nom prenom')
            .populate('updatedBy', 'nom prenom')
            .populate('mairie', 'nom ville')
            .lean()
            .maxTimeMS(10000) // Timeout de 10 secondes
            .catch(error => {
                log('Erreur lors de la recherche de l\'engagement', { 
                    error: error.message,
                    stack: error.stack,
                    requestId: req.id,
                    status: 500
                });
                throw new Error('Erreur lors de la récupération des données de l\'engagement');
            });

        if (!engagement) {
            const errorMsg = `Engagement de concubinage non trouvé: ${id}`;
            log(errorMsg, { requestId: req.id, status: 404 });
            return res.status(404).json({ 
                success: false,
                message: errorMsg,
                requestId: req.id
            });
        }

        log('Engagement de concubinage trouvé', {
            _id: engagement._id,
            numeroActe: engagement.numeroActe,
            dateDebut: engagement.dateDebut,
            statut: engagement.statut
        });

        // Vérifier les données requises
        const requiredFields = [
            'concubin1.nom', 'concubin1.prenom', 'concubin2.nom', 'concubin2.prenom',
            'dateDebut', 'lieuDebut'
        ];
        
        const missingFields = requiredFields.filter(fieldPath => {
            const parts = fieldPath.split('.');
            let value = engagement;
            for (const part of parts) {
                if (value && value[part] !== undefined) {
                    value = value[part];
                } else {
                    return true; // Champ manquant
                }
            }
            return !value; // Vérifie si la valeur est fausse (null, undefined, '', etc.)
        });
        
        if (missingFields.length > 0) {
            const errorMsg = `Champs manquants pour la génération du PDF: ${missingFields.join(', ')}`;
            log(errorMsg);
            return res.status(400).json({
                success: false,
                message: errorMsg,
                missingFields
            });
        }

        // Préparer les données pour le PDF
        const pdfData = {
            // Informations administratives
            numeroActe: engagement.numeroActe,
            dateDebut: formatDate(engagement.dateDebut),
            mairie: engagement.mairie?.nom || 'Mairie non spécifiée',
            ville: engagement.mairie?.ville || 'Ville non spécifiée',
            statut: engagement.statut || 'Actif',
            
            // Informations du premier concubin avec des valeurs par défaut sécurisées
            concubin1: {
                nom: engagement.concubin1?.nom || 'Non renseigné',
                prenom: engagement.concubin1?.prenom || 'Non renseigné',
                dateNaissance: formatDate(engagement.concubin1?.dateNaissance),
                lieuNaissance: engagement.concubin1?.lieuNaissance || 'Non renseigné',
                profession: engagement.concubin1?.profession || 'Non renseignée',
                adresse: engagement.concubin1?.adresse || 'Non renseignée',
                nationalite: engagement.concubin1?.nationalite || 'Non renseignée',
                typePiece: engagement.concubin1?.typePieceIdentite || 'Non spécifié',
                numeroPiece: engagement.concubin1?.numeroPieceIdentite || 'Non renseigné',
                pere: engagement.concubin1?.pere || 'Non renseigné',
                mere: engagement.concubin1?.mere || 'Non renseignée'
            },
            
            // Informations du deuxième concubin avec des valeurs par défaut sécurisées
            concubin2: {
                nom: engagement.concubin2?.nom || 'Non renseigné',
                prenom: engagement.concubin2?.prenom || 'Non renseigné',
                dateNaissance: formatDate(engagement.concubin2?.dateNaissance),
                lieuNaissance: engagement.concubin2?.lieuNaissance || 'Non renseigné',
                profession: engagement.concubin2?.profession || 'Non renseignée',
                adresse: engagement.concubin2?.adresse || 'Non renseignée',
                nationalite: engagement.concubin2?.nationalite || 'Non renseignée',
                typePiece: engagement.concubin2?.typePieceIdentite || 'Non spécifié',
                numeroPiece: engagement.concubin2?.numeroPieceIdentite || 'Non renseigné',
                pere: engagement.concubin2?.pere || 'Non renseigné',
                mere: engagement.concubin2?.mere || 'Non renseignée'
            },
            
            // Détails de l'engagement avec des valeurs par défaut sécurisées
            lieuDebut: engagement.lieuDebut || 'Non spécifié',
            temoins: Array.isArray(engagement.temoins) 
                ? engagement.temoins.slice(0, 4).map(temoin => ({
                    nom: temoin?.nom || 'Non renseigné',
                    prenom: temoin?.prenom || '',
                    profession: temoin?.profession || 'Non renseignée',
                    adresse: temoin?.adresse || 'Non renseignée',
                    residence: temoin?.residence || 'Non renseignée'
                }))
                : [],
            
            // Informations complémentaires avec des valeurs par défaut
            observations: engagement.observations || 'Aucune observation',
            officierEtatCivil: engagement.officierEtatCivil || 'Non spécifié',
            motifFin: engagement.motifFin || 'Non spécifié',
            
            // Métadonnées
            createdAt: formatDate(engagement.createdAt),
            createdBy: engagement.createdBy 
                ? `${engagement.createdBy.prenom || ''} ${engagement.createdBy.nom || ''}`.trim() 
                : 'Utilisateur inconnu',
            updatedAt: formatDate(engagement.updatedAt),
            updatedBy: engagement.updatedBy 
                ? `${engagement.updatedBy.prenom || ''} ${engagement.updatedBy.nom || ''}`.trim()
                : null
        };
        
        log('Données préparées pour la génération du PDF', {
            requestId: req.id,
            hasConcubin1: !!engagement.concubin1,
            hasConcubin2: !!engagement.concubin2,
            temoinsCount: engagement.temoins?.length || 0
        });

        log('Données préparées pour la génération du PDF');
        
        // Générer le PDF
        try {
            log('Début de la génération du PDF...', { requestId: req.id });
            
            // Importer le service PDF
            const { generatePdf } = require('../services/pdfService');
            
            // Vérifier que la fonction generatePdf existe
            if (typeof generatePdf !== 'function') {
                throw new Error('La fonction generatePdf n\'est pas disponible dans le service PDF');
            }
            
            // Générer le PDF avec un timeout
            const pdfBuffer = await Promise.race([
                generatePdf('engagement-concubinage', pdfData),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('La génération du PDF a dépassé le temps d\'attente (15s)')), 15000)
                )
            ]);
            
            // Vérifier que le buffer est valide
            if (!pdfBuffer || !(pdfBuffer instanceof Buffer)) {
                const errorMsg = 'Le buffer du PDF est invalide';
                log(errorMsg, { 
                    type: typeof pdfBuffer, 
                    isBuffer: Buffer.isBuffer(pdfBuffer),
                    requestId: req.id,
                    status: 500
                });
                
                return res.status(500).json({
                    success: false,
                    message: errorMsg,
                    requestId: req.id,
                    timestamp: new Date().toISOString()
                });
            }
            
            // Créer un nom de fichier sécurisé
            const safeFileName = `engagement-concubinage-${(pdfData.numeroActe || 'sans-numero')
                .toString()
                .toLowerCase()
                .replace(/[^a-z0-9-]/g, '-')}-${Date.now()}.pdf`;
            
            log('PDF généré avec succès', { 
                bufferSize: pdfBuffer.length,
                fileName: safeFileName,
                requestId: req.id,
                engagementId: id,
                generatedAt: new Date().toISOString()
            });
            
            try {
                // Configurer les en-têtes de la réponse
                res.set({
                    'Content-Type': 'application/pdf',
                    'Content-Disposition': `attachment; filename="${safeFileName}"`,
                    'Content-Length': pdfBuffer.length,
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0',
                    'X-Generated-At': new Date().toISOString(),
                    'X-Engagement-ID': id,
                    'X-Request-ID': req.id || 'none',
                    'X-Response-Time': `${Date.now() - startTime}ms`
                });
                
                // Envoyer le PDF
                return res.send(pdfBuffer);
            } catch (sendError) {
                const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                const errorDetails = {
                    errorId,
                    timestamp: new Date().toISOString(),
                    message: sendError.message,
                    name: sendError.name,
                    stack: sendError.stack,
                    engagementId: id,
                    params: req.params,
                    query: req.query,
                    duration: Date.now() - startTime
                };
                
                // Utiliser le logger de la requête s'il existe, sinon utiliser le logger par défaut
                const errorLog = req.log || logger.error;
                errorLog(`[${errorId}] Erreur lors de l'envoi du PDF d'engagement de concubinage`, errorDetails);
                
                // Si la réponse n'a pas encore été envoyée
                if (!res.headersSent) {
                    return res.status(500).json({
                        success: false,
                        message: 'Une erreur est survenue lors de l\'envoi du PDF',
                        errorId,
                        timestamp: errorDetails.timestamp
                    });
                }
                
                // Si la réponse a déjà été envoyée, on ne peut plus rien faire
                console.error('Erreur après envoi de la réponse:', errorDetails);
            }
        } catch (error) {
            const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const errorDetails = {
                errorId,
                timestamp: new Date().toISOString(),
                message: error.message,
                name: error.name,
                stack: error.stack,
                engagementId: id,
                params: req.params,
                query: req.query,
                duration: Date.now() - startTime
            };
            
            // Utiliser le logger de la requête s'il existe, sinon utiliser le logger par défaut
            const errorLog = req.log || logger.error;
            errorLog(`[${errorId}] Erreur lors de la génération du PDF d'engagement de concubinage`, errorDetails);
            
            // Si la réponse n'a pas encore été envoyée
            if (!res.headersSent) {
                return res.status(500).json({
                    success: false,
                    message: 'Une erreur est survenue lors de la génération du PDF',
                    errorId,
                    timestamp: errorDetails.timestamp,
                    requestId: req.id
                });
            }
            
            // Si la réponse a déjà été envoyée, on ne peut plus rien faire
            console.error('Erreur après envoi de la réponse:', errorDetails);
        }
    } catch (error) {
        // Gestion des erreurs globales de la fonction
        const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const errorDetails = {
            errorId,
            timestamp: new Date().toISOString(),
            message: error.message,
            name: error.name,
            stack: error.stack,
            engagementId: id,
            requestId: req.id,
            duration: Date.now() - startTime
        };

        logger.error(`[${errorId}] Erreur inattendue dans generateEngagementPdf`, errorDetails);

        if (!res.headersSent) {
            return res.status(500).json({
                success: false,
                message: 'Une erreur inattendue est survenue',
                errorId,
                timestamp: errorDetails.timestamp,
                requestId: req.id
            });
        }
    }
};
