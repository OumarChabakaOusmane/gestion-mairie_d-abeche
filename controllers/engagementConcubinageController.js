const EngagementConcubinage = require('../models/EngagementConcubinage');
const { generatePdf } = require('../services/pdfService');
const logger = require('../config/logger');
const mongoose = require('mongoose');

/**
 * Créer un nouvel engagement de concubinage
 */
/**
 * Crée un nouvel engagement de concubinage
 * @route POST /api/engagements
 * @access Privé
 * @param {Object} req - La requête HTTP
 * @param {Object} res - La réponse HTTP
 * @returns {Promise<void>}
 */
exports.createEngagement = async (req, res) => {
  try {
    const engagementData = req.body;
    
    // Vérifier si un engagement similaire existe déjà
    const existingEngagement = await EngagementConcubinage.findOne({
      'concubin1.numeroPieceIdentite': engagementData.concubin1.numeroPieceIdentite,
      'concubin2.numeroPieceIdentite': engagementData.concubin2.numeroPieceIdentite,
      statut: 'actif'
    });

    if (existingEngagement) {
      return res.status(400).json({
        success: false,
        message: 'Un engagement de concubinage actif existe déjà entre ces deux personnes'
      });
    }

    const engagement = new EngagementConcubinage({
      ...engagementData,
      createdBy: req.user.id
    });
    
    await engagement.save();
    
    logger.info('Engagement de concubinage créé avec succès', { 
      engagementId: engagement._id, 
      userId: req.user.id 
    });
    
    res.status(201).json({
      success: true,
      message: 'Engagement de concubinage créé avec succès',
      data: engagement
    });
  } catch (error) {
    logger.error('Erreur lors de la création de l\'engagement de concubinage', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id
    });
    
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de l\'engagement de concubinage',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur serveur'
    });
  }
};

/**
 * Récupère un engagement de concubinage par son ID
 * @route GET /api/engagements/:id
 * @access Privé
 * @param {Object} req - La requête HTTP
 * @param {string} req.params.id - L'ID de l'engagement
 * @param {Object} res - La réponse HTTP
 * @returns {Promise<void>}
 */
exports.getEngagementById = async (req, res) => {
  const { id } = req.params;
  
  try {
    const engagement = await EngagementConcubinage.findById(id)
      .populate('createdBy', 'nom prenom')
      .populate('updatedBy', 'nom prenom')
      .populate('mairie', 'nom ville')
      .lean()
      .maxTimeMS(10000); // 10 secondes timeout
      
    if (!engagement) {
      logger.warn('Engagement de concubinage non trouvé', { engagementId: id });
      return res.status(404).json({
        success: false,
        message: 'Engagement de concubinage non trouvé',
        requestId: req.id
      });
    }
    
    logger.info('Engagement de concubinage récupéré avec succès', {
      engagementId: id,
      requestId: req.id
    });
    
    res.json({
      success: true,
      data: engagement
    });
  } catch (error) {
    logger.error('Erreur lors de la récupération de l\'engagement de concubinage', {
      error: error.message,
      stack: error.stack,
      engagementId: id,
      userId: req.user?.id,
      requestId: req.id
    });
    
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de l\'engagement de concubinage',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur serveur',
      requestId: req.id
    });
  }
};

/**
 * Met à jour un engagement de concubinage existant
 * @route PUT /api/engagements/:id
 * @access Privé
 * @param {Object} req - La requête HTTP
 * @param {string} req.params.id - L'ID de l'engagement à mettre à jour
 * @param {Object} req.body - Les données de mise à jour
 * @param {Object} res - La réponse HTTP
 * @returns {Promise<void>}
 */
exports.updateEngagement = async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  
  try {
    // Ne pas permettre de modifier le statut directement via cette route
    if (updates.statut || updates.dateFin || updates.motifFin) {
      delete updates.statut;
    }
    
    const engagement = await EngagementConcubinage.findByIdAndUpdate(
      id,
      { 
        ...updates, 
        updatedBy: req.user.id,
        updatedAt: new Date()
      },
      { 
        new: true, 
        runValidators: true,
        context: 'query'
      }
    )
    .populate('createdBy', 'nom prenom')
    .populate('updatedBy', 'nom prenom')
    .populate('mairie', 'nom ville');
    
    if (!engagement) {
      logger.warn('Tentative de mise à jour d\'un engagement non trouvé', {
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
    
    logger.info('Engagement de concubinage mis à jour avec succès', {
      engagementId: engagement._id,
      userId: req.user.id,
      requestId: req.id,
      updatedFields: Object.keys(updates)
    });
    
    res.json({
      success: true,
      message: 'Engagement de concubinage mis à jour avec succès',
      data: engagement
    });
  } catch (error) {
    logger.error('Erreur lors de la mise à jour de l\'engagement de concubinage', {
      error: error.message,
      stack: error.stack,
      engagementId: id,
      userId: req.user?.id,
      requestId: req.id
    });
    
    // Gestion des erreurs de validation
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Erreur de validation des données',
        errors: Object.values(error.errors).map(err => ({
          field: err.path,
          message: err.message
        })),
        requestId: req.id
      });
    }
    
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
    
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour de l\'engagement de concubinage',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur serveur',
      requestId: req.id
    });
  }
};

/**
 * Rompt un engagement de concubinage existant
 * @route POST /api/engagements/:id/rompre
 * @access Privé (Admin/Officier d'état civil)
 * @param {Object} req - La requête HTTP
 * @param {string} req.params.id - L'ID de l'engagement à rompre
 * @param {Object} req.body - Les données de rupture
 * @param {string} req.body.motif - Le motif de la rupture
 * @param {Object} res - La réponse HTTP
 * @returns {Promise<void>}
 */
exports.rompreEngagement = async (req, res) => {
  const { id } = req.params;
  const { motif } = req.body;
  
  // Vérifier que le motif est fourni
  if (!motif || typeof motif !== 'string' || motif.trim().length === 0) {
    logger.warn('Tentative de rompre un engagement sans motif valide', {
      engagementId: id,
      userId: req.user?.id,
      requestId: req.id
    });
    
    return res.status(400).json({
      success: false,
      message: 'Un motif valide est requis pour rompre un engagement',
      requestId: req.id
    });
  }
  
  try {
    // Vérifier d'abord si l'engagement existe et est actif
    const existingEngagement = await EngagementConcubinage.findOne({
      _id: id,
      statut: 'actif'
    });
    
    if (!existingEngagement) {
      logger.warn('Tentative de rompre un engagement non trouvé ou déjà rompu', {
        engagementId: id,
        userId: req.user?.id,
        requestId: req.id
      });
      
      return res.status(404).json({
        success: false,
        message: 'Engagement de concubinage actif non trouvé',
        requestId: req.id
      });
    }
    
    // Mettre à jour l'engagement avec les informations de rupture
    const engagement = await EngagementConcubinage.findByIdAndUpdate(
      id,
      {
        statut: 'rompu',
        dateFin: new Date(),
        motifFin: motif.trim(),
        updatedBy: req.user.id,
        updatedAt: new Date()
      },
      { 
        new: true, 
        runValidators: true,
        context: 'query'
      }
    )
    .populate('createdBy', 'nom prenom')
    .populate('updatedBy', 'nom prenom')
    .populate('mairie', 'nom ville');
    
    if (!engagement) {
      throw new Error('Échec de la mise à jour de l\'engagement');
    }
    
    logger.info('Engagement de concubinage rompu avec succès', {
      engagementId: engagement._id,
      userId: req.user.id,
      requestId: req.id,
      motif: engagement.motifFin,
      dateFin: engagement.dateFin
    });
    
    res.json({
      success: true,
      message: 'Engagement de concubinage rompu avec succès',
      data: engagement
    });
  } catch (error) {
    logger.error('Erreur lors de la rupture de l\'engagement de concubinage', {
      error: error.message,
      stack: error.stack,
      engagementId: id,
      userId: req.user?.id,
      requestId: req.id
    });
    
    // Gestion des erreurs de validation
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Erreur de validation des données',
        errors: Object.values(error.errors).map(err => ({
          field: err.path,
          message: err.message
        })),
        requestId: req.id
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Une erreur est survenue lors de la rupture de l\'engagement de concubinage',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur serveur',
      requestId: req.id
    });
  }
};

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
 * Obtenir des statistiques sur les engagements de concubinage
 */
exports.getEngagementStats = async (req, res) => {
    try {
        const total = await EngagementConcubinage.countDocuments();
        const byStatus = await EngagementConcubinage.aggregate([
            { $group: { _id: '$statut', count: { $sum: 1 } } }
        ]);
        
        res.json({
            success: true,
            data: { total, byStatus }
        });
    } catch (error) {
        logger.error('Erreur lors de la récupération des statistiques:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des statistiques',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur serveur'
        });
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
