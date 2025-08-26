const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware d'authentification de base
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Token d\'authentification requis'
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Utilisateur non trouvé'
      });
    }

    // Vérifier si l'email est confirmé
    if (!user.isEmailConfirmed) {
      return res.status(401).json({
        success: false,
        error: 'Email non confirmé'
      });
    }

    // Vérifier si le compte est verrouillé
    if (user.isLocked) {
      return res.status(423).json({
        success: false,
        error: 'Compte temporairement verrouillé'
      });
    }

    req.user = user;
    req.token = token;
    next();
  } catch (err) {
    console.error('[AUTH] Erreur:', err);
    res.status(401).json({
      success: false,
      error: 'Token invalide'
    });
  }
};

// Middleware pour vérifier les rôles
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentification requise'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Accès non autorisé pour ce rôle'
      });
    }

    next();
  };
};

// Middleware optionnel (pour les routes qui peuvent fonctionner avec ou sans authentification)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (user && user.isEmailConfirmed && !user.isLocked) {
      req.user = user;
      req.token = token;
    }

    next();
  } catch (err) {
    // En cas d'erreur, on continue sans utilisateur
    next();
  }
};

module.exports = {
  authenticate,
  authorize,
  optionalAuth
};