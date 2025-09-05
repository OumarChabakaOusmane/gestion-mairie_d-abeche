const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../config/logger');

// Middleware d'authentification de base
const authenticate = async (req, res, next) => {
  try {
    // Vérifier le header d'autorisation
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn('Tentative d\'accès non autorisé - Token manquant');
      return res.status(401).json({
        success: false,
        error: 'Token d\'authentification requis'
      });
    }

    // Extraire et vérifier le token
    const token = authHeader.split(' ')[1];
    let decoded;
    
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      logger.warn('Token JWT invalide', { error: jwtError.message });
      return res.status(401).json({
        success: false,
        error: 'Token invalide ou expiré'
      });
    }

    // Récupérer l'utilisateur
    const user = await User.findById(decoded.id);
    if (!user) {
      logger.warn(`Utilisateur non trouvé - ID: ${decoded.id}`);
      return res.status(401).json({
        success: false,
        error: 'Utilisateur non trouvé'
      });
    }

    // Vérifier si l'email est confirmé
    if (!user.isEmailConfirmed) {
      logger.warn(`Tentative de connexion avec email non confirmé - ID: ${user._id}`);
      return res.status(401).json({
        success: false,
        error: 'Veuillez confirmer votre adresse email avant de continuer'
      });
    }

    // Vérifier si le compte est verrouillé
    if (user.isLocked) {
      logger.warn(`Tentative de connexion à un compte verrouillé - ID: ${user._id}`);
      return res.status(423).json({
        success: false,
        error: 'Compte temporairement verrouillé. Veuillez réessayer plus tard.'
      });
    }

    // Ajouter l'utilisateur et le token à la requête
    req.user = { id: user._id.toString(), role: user.role, email: user.email };
    req.token = token;
    
    // Journaliser l'accès réussi
    logger.info(`Accès autorisé - ID: ${user._id}, Email: ${user.email}`);
    
    next();
  } catch (error) {
    logger.error('Erreur d\'authentification', { 
      error: error.message,
      stack: error.stack,
      url: req.originalUrl,
      method: req.method
    });
    
    res.status(500).json({
      success: false,
      error: 'Erreur d\'authentification',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Middleware pour vérifier les rôles
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      logger.warn('Tentative d\'accès non autorisé - Utilisateur non authentifié');
      return res.status(401).json({
        success: false,
        error: 'Non autorisé - Veuillez vous connecter'
      });
    }

    if (!roles.includes(req.user.role)) {
      logger.warn(`Tentative d\'accès non autorisé - Rôle insuffisant - ID: ${req.user.id}, Rôle: ${req.user.role}`);
      return res.status(403).json({
        success: false,
        error: 'Accès refusé - Droits insuffisants'
      });
    }

    next();
  };
};

// Middleware optionnel (pour les routes qui peuvent fonctionner avec ou sans authentification)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);
      
      if (user && user.isEmailConfirmed && !user.isLocked) {
        req.user = { id: user._id.toString(), role: user.role, email: user.email };
        req.token = token;
      }
    }
    
    next();
  } catch (error) {
    // En cas d'erreur, on continue sans authentification
    next();
  }
};

module.exports = {
  authenticate,
  authorize,
  optionalAuth
};