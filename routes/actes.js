const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const Acte = require('../models/Acte');
const { check, validationResult } = require('express-validator');
const { generatePdf, PdfGenerationError } = require('../services/pdfService');
const PDFDocument = require('pdfkit');
const { authenticate } = require('../middleware/auth');
const decesController = require('../controllers/decesController');
const logger = require('../config/logger');
const naissanceController = require('../controllers/naissanceController');
const mariageController = require('../controllers/mariageController');

// Validation des actes
const validateActe = (type, details) => {
  const errors = [];
  const requiredFields = {
    naissance: ['nom', 'prenom', 'sexe', 'dateNaissance', 'lieuNaissance', 'pere', 'mere'],
    mariage: ['conjoint1', 'conjointe2', 'dateMariage', 'lieuMariage'],
    deces: ['nom', 'prenom', 'dateDeces', 'lieuDeces']
  };

  if (!requiredFields[type]) {
    throw new Error('Type d\'acte non valide');
  }

  requiredFields[type].forEach(field => {
    if (!details[field]) {
      errors.push(`Le champ ${field} est obligatoire`);
    }
  });

  if (errors.length > 0) {
    throw new Error(errors.join(', '));
  }
};

// Middleware de validation
const validateActeInput = [
  check('type').isIn(['naissance', 'mariage', 'deces']),
  check('details').isObject(),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        errors: errors.array() 
      });
    }
    next();
  }
];

// Créer un acte
router.post('/', authenticate, validateActeInput, async (req, res) => {
  try {
    console.log('Requête reçue pour créer un acte:', JSON.stringify(req.body, null, 2));
    
    const { type, details, mairie } = req.body;
    
    try {
      validateActe(type, details);
    } catch (validationError) {
      console.error('Erreur de validation:', validationError.message);
      return res.status(400).json({
        success: false,
        error: `Erreur de validation: ${validationError.message}`,
        validationError: validationError.message,
        receivedData: { type, details, mairie }
      });
    }
    
    try {
      const acte = new Acte({ 
        type, 
        details,
        mairie,
        // enregistrer uniquement si présent pour éviter les erreurs de cast
        ...(req.user?._id && { createdBy: req.user._id, lastModifiedBy: req.user._id })
      });
      
      await acte.save();
      
      console.log('Acte enregistré avec succès:', acte._id);
      
      res.status(201).json({ 
        success: true,
        message: 'Acte enregistré avec succès',
        data: acte
      });
    } catch (dbError) {
      console.error('Erreur lors de l\'enregistrement en base de données:', dbError);
      return res.status(400).json({
        success: false,
        error: `Erreur lors de l'enregistrement: ${dbError.message}`,
        dbError: dbError.message,
        receivedData: { type, details, mairie }
      });
    }
  } catch (err) {
    console.error('Erreur inattendue:', err);
    res.status(500).json({ 
      success: false,
      error: `Erreur serveur: ${err.message}`,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// Lister les actes avec pagination
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10)); // Max 100 items
    const skip = (page - 1) * limit;

    // Éviter les requêtes trop coûteuses
    if (skip > 10000) {
      return res.status(400).json({
        success: false,
        error: 'Pagination trop élevée. Utilisez des filtres pour affiner votre recherche.'
      });
    }

    const [actes, total] = await Promise.all([
      Acte.find()
        .sort({ dateEnregistrement: -1 })
        .skip(skip)
        .limit(limit)
        .lean(), // Optimisation mémoire
      Acte.countDocuments()
    ]);

    res.json({
      success: true,
      data: actes,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('Erreur liste actes:', err);
    res.status(500).json({ 
      success: false,
      error: 'Erreur serveur' 
    });
  }
});

// ====================================
// ROUTE DE RECHERCHE - DOIT ÊTRE AVANT LA ROUTE /:id
// ====================================
router.get('/search', authenticate, async (req, res) => {
  // Début du suivi des performances
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substr(2, 9);
  
  console.log(`[${new Date().toISOString()}] [${requestId}] Requête de recherche reçue`, {
    query: req.query,
    user: req.user ? req.user._id : 'non authentifié',
    ip: req.ip
  });
  
  try {
    // Vérifier le terme de recherche
    let searchTerm = req.query.q;
    
    if (!searchTerm || searchTerm.trim() === '') {
      console.log(`[${requestId}] Erreur: Terme de recherche manquant`);
      return res.status(400).json({ 
        success: false, 
        error: 'Le terme de recherche est requis' 
      });
    }

    // Nettoyer le terme de recherche (retirer les préfixes de champ comme 'MAHAMAT:1')
    searchTerm = searchTerm.split(':')[0].trim();
    
    if (searchTerm.length < 2) {
      console.log(`[${requestId}] Erreur: Terme de recherche trop court: "${searchTerm}"`);
      return res.status(400).json({
        success: false,
        error: 'Le terme de recherche doit contenir au moins 2 caractères'
      });
    }
    
    console.log(`[${requestId}] Recherche du terme: "${searchTerm}"`);
    
    // Créer une expression régulière insensible à la casse avec échappement des caractères spéciaux
    const escapedTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedTerm, 'i');

    // Construire la requête de recherche
    const query = {
      $or: [
        { 'details.nom': { $regex: regex } },
        { 'details.prenom': { $regex: regex } },
        { 'details.lieuNaissance': { $regex: regex } },
        { 'details.lieuDeces': { $regex: regex } },
        { 'details.lieuMariage': { $regex: regex } },
        { 'details.numeroActe': { $regex: regex } },
        { 'details.pere': { $regex: regex } },
        { 'details.mere': { $regex: regex } },
        { 'details.conjoint1': { $regex: regex } },
        { 'details.conjointe2': { $regex: regex } }
      ]
    };

    console.log(`[${requestId}] Exécution de la requête:`, JSON.stringify(query));
    
    // Exécuter la requête avec un timeout
    const results = await Promise.race([
      Acte.find(query)
        .sort({ dateEnregistrement: -1 })
        .limit(50)
        .lean()
        .exec(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('La requête a pris trop de temps')), 15000)
      )
    ]);

    const duration = Date.now() - startTime;
    console.log(`[${requestId}] Recherche terminée en ${duration}ms - ${results.length} résultats`);

    // Envoyer la réponse
    return res.status(200).json({
      success: true,
      data: results,
      meta: {
        count: results.length,
        searchTerm: searchTerm,
        duration: duration
      }
    });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[${requestId}] Erreur après ${duration}ms:`, error);
    
    // Gérer les erreurs spécifiques
    let statusCode = 500;
    let errorMessage = 'Erreur lors de la recherche des actes';
    
    if (error.message.includes('trop de temps')) {
      statusCode = 504; // Gateway Timeout
      errorMessage = 'La recherche a pris trop de temps. Veuillez essayer avec un terme plus spécifique.';
    } else if (error.name === 'MongoError') {
      errorMessage = 'Erreur de base de données. Veuillez réessayer plus tard.';
    }
    
    return res.status(statusCode).json({ 
      success: false, 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      requestId: requestId
    });
  }
});

// Obtenir un acte spécifique
router.get('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        error: 'ID invalide'
      });
    }

    const acte = await Acte.findById(req.params.id);
    if (!acte) {
      return res.status(404).json({
        success: false,
        error: 'Acte non trouvé'
      });
    }

    res.json({
      success: true,
      data: acte
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
});

// Générer et télécharger un PDF d'acte
router.get('/:id/pdf', authenticate, async (req, res) => {
  const startTime = Date.now();
  const requestId = `pdf-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  
  const log = (message, data = {}) => {
    console.log(`[${requestId}] ${message}`, JSON.stringify({
      ...data,
      timestamp: new Date().toISOString(),
      duration: `${Date.now() - startTime}ms`
    }, null, 2));
  };
  
  try {
    if (logger && typeof logger.info === 'function') {
      logger.info('PDF route hit in routes/actes.js', { path: req.originalUrl });
    }
    log(`Début de génération du PDF pour l'acte`, { 
      acteId: req.params.id,
      user: req.user ? req.user._id : 'non authentifié'
    });
    
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      const error = new Error('ID d\'acte invalide');
      log('Erreur de validation', { 
        error: error.message,
        acteId: req.params.id
      });
      return res.status(400).json({ 
        success: false,
        error: error.message,
        requestId
      });
    }

    log('Recherche de l\'acte dans la base de données...');
    const acte = await Acte.findById(req.params.id)
      .populate('createdBy', 'nom prenom')
      .lean()
      .catch(error => {
        log('Erreur lors de la recherche de l\'acte', { error: error.message });
        throw error;
      });
    
    if (!acte) {
      const error = new Error('Acte non trouvé');
      log(error.message, { acteId: req.params.id });
      return res.status(404).json({ 
        success: false,
        error: error.message,
        requestId
      });
    }

    log('Acte trouvé', { 
      acteId: acte._id,
      type: acte.type,
      mairie: acte.mairie,
      createdAt: acte.createdAt
    });

    // Utiliser le service PDF unifié pour tous les types d'actes
    log('Génération PDF via service unifié', { type: acte.type });
    
    try {
      let pdfBuffer;
      let fileName;
      
      switch (acte.type) {
        case 'naissance':
          log('Génération PDF de naissance...');
          pdfBuffer = await generatePdf('naissance', acte);
          fileName = `acte-naissance-${(acte.numeroActe || 'sans-numero')}.pdf`;
          break;
          
        case 'mariage':
          log('Génération PDF de mariage...');
          pdfBuffer = await generatePdf('mariage', acte);
          fileName = `acte-mariage-${(acte.numeroActe || 'sans-numero')}.pdf`;
          break;
          
        case 'deces':
          log('Génération PDF de décès...');
          pdfBuffer = await generatePdf('deces', acte);
          fileName = `acte-deces-${(acte.numeroActe || 'sans-numero')}.pdf`;
          break;
          
          
        default:
          const error = new Error(`Type d'acte '${acte.type}' non pris en charge`);
          log(error.message, { type: acte.type });
          return res.status(400).json({
            success: false,
            error: error.message,
            requestId,
            supportedTypes: ['naissance', 'mariage', 'deces']
          });
      }
      
      // Vérifier que le buffer n'est pas vide
      if (!pdfBuffer || !(pdfBuffer instanceof Buffer) || pdfBuffer.length === 0) {
        const errorMsg = 'Le contenu du PDF est vide ou invalide';
        log(errorMsg, { 
          bufferType: typeof pdfBuffer,
          isBuffer: Buffer.isBuffer(pdfBuffer),
          bufferLength: pdfBuffer?.length
        });
        return res.status(500).json({
          success: false,
          error: errorMsg,
          requestId
        });
      }

      // Configurer les en-têtes de réponse
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.setHeader('X-PDF-Generator', 'pdfService');
      
      log('Envoi du PDF généré', { 
        fileName,
        size: pdfBuffer.length,
        type: acte.type
      });
      
      // Envoyer les données binaires directement
      res.write(pdfBuffer, 'binary');
      res.end(null, 'binary');
      
    } catch (controllerError) {
      log('Erreur dans la génération PDF', { 
        error: controllerError.message,
        stack: controllerError.stack,
        type: acte.type
      });
      throw controllerError;
    }

  } catch (err) {
    const errorDetails = {
      message: err.message,
      stack: err.stack,
      params: req.params,
      user: req.user ? { _id: req.user._id, role: req.user.role } : 'non authentifié',
      timestamp: new Date().toISOString(),
      requestId
    };
    
    // Journalisation détaillée de l'erreur
    console.error(`[${requestId}] ERREUR CRITIQUE lors de la génération du PDF:`, 
      JSON.stringify(errorDetails, null, 2));
    
    // Envoyer une réponse d'erreur plus détaillée en mode développement
    const errorResponse = {
      success: false,
      error: 'Erreur lors de la génération du PDF',
      timestamp: errorDetails.timestamp,
      requestId,
      ...(process.env.NODE_ENV === 'development' && {
        details: err.message,
        stack: err.stack,
        errorType: err.name,
        errorCode: err.code || 'UNKNOWN_ERROR'
      })
    };
    
    // Journalisation des erreurs de validation
    if (err.name === 'ValidationError') {
      errorResponse.error = 'Erreur de validation des données';
      if (err.errors) {
        errorResponse.validationErrors = Object.keys(err.errors).map(key => ({
          field: key,
          message: err.errors[key].message,
          value: err.errors[key].value
        }));
      }
    }
    
    // Journalisation des erreurs de base de données
    if (err.name === 'MongoError' || err.name === 'MongoServerError') {
      errorResponse.error = 'Erreur de base de données';
      errorResponse.errorCode = err.code || 'DATABASE_ERROR';
      
      // Masquer les détails sensibles en production
      if (process.env.NODE_ENV !== 'development') {
        delete errorResponse.details;
        delete errorResponse.stack;
      }
    }
    
    // Journalisation des erreurs de système de fichiers
    if (err.code && err.code.startsWith('ENOENT')) {
      errorResponse.error = 'Erreur d\'accès au système de fichiers';
      errorResponse.errorCode = 'FILE_SYSTEM_ERROR';
    }
    
    return res.status(500).json(errorResponse);
  }
});

// Alias pour compatibilité avec l'ancien frontend
router.get('/naissances/:id/pdf', authenticate, (req, res) => {
  return res.redirect(307, `/api/naissances/${req.params.id}/pdf`);
});

router.get('/mariages/:id/pdf', authenticate, (req, res) => {
  return res.redirect(307, `/api/actes/${req.params.id}/pdf`);
});

// ====================================
// ROUTE POUR UN ACTE SPÉCIFIQUE PAR ID
// ====================================
router.get('/:id', authenticate, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        error: 'ID invalide'
      });
    }
    
    const acte = await Acte.findById(req.params.id).lean();
    
    if (!acte) {
      return res.status(404).json({
        success: false,
        error: 'Acte non trouvé'
      });
    }
    
    res.json({
      success: true,
      data: acte
    });
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'acte:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération de l\'acte',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Récupérer les actes récents
router.get('/recent', authenticate, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    
    // Récupérer les actes récents de tous les types
    const recentActes = await Acte.find()
      .sort({ dateEnregistrement: -1 })
      .limit(limit)
      .select('type numeroActe details dateEnregistrement')
      .lean();

    // Formater la réponse
    const formattedActes = recentActes.map(acte => ({
      id: acte._id,
      type: acte.type,
      numeroActe: acte.numeroActe,
      nom: acte.details?.nom || '',
      prenom: acte.details?.prenom || '',
      details: acte.details,
      date: acte.dateEnregistrement,
      timeAgo: formatTimeAgo(acte.dateEnregistrement)
    }));

    res.json({
      success: true,
      data: formattedActes
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des actes récents:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des actes récents',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Fonction utilitaire pour formater la date
function formatTimeAgo(date) {
  if (!date) return 'Inconnu';
  
  const now = new Date();
  const diffMs = now - new Date(date);
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffMins < 1) return 'À l\'instant';
  if (diffMins < 60) return `Il y a ${diffMins} minute${diffMins > 1 ? 's' : ''}`;
  if (diffHours < 24) return `Il y a ${diffHours} heure${diffHours > 1 ? 's' : ''}`;
  if (diffDays < 30) return `Il y a ${diffDays} jour${diffDays > 1 ? 's' : ''}`;
  
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `Il y a ${diffMonths} mois`;
  
  return `Il y a ${Math.floor(diffMonths / 12)} an${Math.floor(diffMonths / 12) > 1 ? 's' : ''}`;
}

// Mettre à jour un acte
// Récupérer un acte par son ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const acte = await Acte.findById(req.params.id).lean();
    
    if (!acte) {
      return res.status(404).json({
        success: false,
        message: 'Acte non trouvé'
      });
    }

    res.json({
      success: true,
      data: acte
    });
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'acte:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de l\'acte',
      error: error.message
    });
  }
});

// Afficher le formulaire d'édition d'un acte
router.get('/edit/:id', authenticate, async (req, res) => {
  try {
    const acte = await Acte.findById(req.params.id).lean();
    
    if (!acte) {
      return res.status(404).send('Acte non trouvé');
    }

    // Rediriger vers la page d'édition appropriée en fonction du type d'acte
    res.redirect(`/${acte.type}s/edit/${req.params.id}`);
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'acte pour édition:', error);
    res.status(500).send('Erreur lors du chargement du formulaire d\'édition');
  }
});

// Mettre à jour un acte
router.put('/:id', validateActeInput, authenticate, async (req, res) => {
  try {
    let { type, details, mairie } = req.body;
    validateActe(type, details);
    
    // Journalisation des données reçues pour le débogage
    console.log('Données reçues pour la mise à jour:', {
      id: req.params.id,
      type,
      mairie,
      details: {
        ...details,
        // Ne pas logger tout le contenu si c'est trop volumineux
        contenu: details.contenu ? '[contenu présent]' : 'non défini'
      },
      user: req.user ? req.user._id : 'non authentifié'
    });
    
    // S'assurer que la région est cohérente entre mairie et details.region
    if (mairie && (!details.region || details.region === 'LE TCHAD')) {
      details.region = mairie;
      console.log(`Mise à jour de details.region avec la valeur de mairie: ${mairie}`);
    } else if (details.region && (!mairie || mairie === 'LE TCHAD')) {
      mairie = details.region;
      console.log(`Mise à jour de mairie avec la valeur de details.region: ${details.region}`);
    }
    
    // Préparer les données de mise à jour
    const updateData = {
      type,
      details,
      mairie,
      lastModifiedBy: req.user._id,
      lastModifiedAt: new Date()
    };
    
    console.log('Données de mise à jour:', updateData);
    
    const acte = await Acte.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!acte) {
      return res.status(404).json({
        success: false,
        error: 'Acte non trouvé'
      });
    }

    res.json({
      success: true,
      message: 'Acte mis à jour',
      data: acte
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

// Télécharger un PDF d'acte de décès
router.get('/deces/:id/pdf', decesController.generateDecesPdf);

// Middleware d'autorisation
const { authorize } = require('../middleware/auth');

// Supprimer un acte (uniquement pour les administrateurs)
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const acte = await Acte.findByIdAndDelete(req.params.id);
    
    if (!acte) {
      return res.status(404).json({
        success: false,
        error: 'Acte non trouvé'
      });
    }
    
    res.json({
      success: true,
      message: 'Acte supprimé avec succès'
    });
  } catch (err) {
    console.error('Erreur lors de la suppression de l\'acte:', err);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la suppression de l\'acte'
    });
  }
});

module.exports = router;