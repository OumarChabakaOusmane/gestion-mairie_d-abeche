const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');

// Protection contre les attaques courantes
exports.securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: [
        "'self'",
        "http://localhost:3000",
        "https://api.example.com",
        "wss://your-socket-server.com",
        "https://cdn.jsdelivr.net",
        "https://cdnjs.cloudflare.com",
        "https://cdn.socket.io",
        "https://code.jquery.com",
        "https://unpkg.com"
      ],
      scriptSrc: [
        "'self'", 
        "'unsafe-inline'",
        "'unsafe-eval'",
        "'unsafe-hashes'",
        "https://cdn.jsdelivr.net",
        "https://cdnjs.cloudflare.com",
        "https://cdn.socket.io",
        "https://code.jquery.com",
        "https://unpkg.com"
      ],
      scriptSrcAttr: [
        "'self'",
        "'unsafe-inline'"
      ],
      styleSrc: [
        "'self'", 
        "'unsafe-inline'",
        "https://cdn.jsdelivr.net",
        "https://cdnjs.cloudflare.com"
      ],
      imgSrc: [
        "'self'", 
        "data:",
        "https://cdn.jsdelivr.net",
        "https://cdnjs.cloudflare.com"
      ],
      fontSrc: [
        "'self'",
        "https://cdn.jsdelivr.net",
        "https://cdnjs.cloudflare.com",
        "data:"
      ]
    }
  },
  hsts: true,
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
