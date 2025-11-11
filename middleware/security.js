const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');

// Protection contre les attaques courantes
exports.securityHeaders = helmet({
  contentSecurityPolicy: false, // Désactiver temporairement CSP pour le débogage
  hsts: false, // Désactiver HSTS temporairement
  frameguard: { action: 'deny' },
  noSniff: true,
  // xssFilter a été retiré de helmet v4+; ne pas l'utiliser
});

// Limitation du taux de requêtes
exports.apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limite chaque IP à 100 requêtes par fenêtre
  message: 'Trop de requêtes depuis cette adresse IP, veuillez réessayer après 15 minutes'
});

// Limitation plus stricte pour les endpoints d'authentification
exports.authLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // max 20 requêtes d'authentification par IP
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Trop de tentatives. Réessayez dans quelques minutes.'
});

// Validation des entrées
exports.validateInputs = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Protection CSRF
exports.csrfProtection = (req, res, next) => {
  res.locals.csrfToken = req.csrfToken();
  next();
};

// Filtrage des données sensibles dans les logs
exports.sanitizeLogs = (req, res, next) => {
  const originalSend = res.send;
  res.send = function (data) {
    // Supprimer les données sensibles avant de logger
    if (req.body && req.body.password) {
      req.body.password = '[REDACTED]';
    }
    if (req.body && req.body.token) {
      req.body.token = '[REDACTED]';
    }
    originalSend.apply(res, arguments);
  };
  next();
};
