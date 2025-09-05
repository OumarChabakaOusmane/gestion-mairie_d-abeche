const { validationResult } = require('express-validator');
const { logger } = require('../config/logger');

/**
 * Middleware de validation des données de requête
 * Utilise express-validator pour valider les données entrantes
 */
const validate = (validations) => {
  return async (req, res, next) => {
    await Promise.all(validations.map(validation => validation.run(req)));

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    // Journalisation des erreurs de validation
    logger.warn('Erreurs de validation', {
      errors: errors.array(),
      url: req.originalUrl,
      method: req.method,
      ip: req.ip
    });

    return res.status(400).json({
      success: false,
      message: 'Erreur de validation des données',
      errors: errors.array()
    });
  };
};

/**
 * Middleware de validation des paramètres d'ID
 */
const validateIdParam = (req, res, next) => {
  const { id } = req.params;
  
  if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
    logger.warn('ID invalide', {
      id,
      url: req.originalUrl,
      method: req.method,
      ip: req.ip
    });
    
    return res.status(400).json({
      success: false,
      message: 'ID invalide',
      error: 'Le format de l\'ID est incorrect'
    });
  }
  
  next();
};

/**
 * Middleware de validation des paramètres de pagination
 */
const validatePagination = (req, res, next) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  
  if (page < 1 || limit < 1 || limit > 100) {
    return res.status(400).json({
      success: false,
      message: 'Paramètres de pagination invalides',
      error: 'La page doit être supérieure à 0 et la limite entre 1 et 100'
    });
  }
  
  req.pagination = { page, limit };
  next();
};

module.exports = {
  validate,
  validateIdParam,
  validatePagination
};
