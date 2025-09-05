const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');

// Protection contre les attaques courantes
exports.securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'", 
        "'unsafe-inline'",
        "'unsafe-eval'",
        "'unsafe-hashes'"
      ],
      scriptSrcAttr: [
        "'self'",
        "'unsafe-inline'"
      ],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
    },
  },
  hsts: true,
  frameguard: { action: 'deny' },
  noSniff: true,
  xssFilter: true,
});

// Limitation du taux de requêtes
exports.apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limite chaque IP à 100 requêtes par fenêtre
  message: 'Trop de requêtes depuis cette adresse IP, veuillez réessayer après 15 minutes'
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
