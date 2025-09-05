require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { securityHeaders, apiLimiter, sanitizeLogs, validateInputs } = require('./middleware/security');
const logger = require('./config/logger');
const morgan = require('morgan');
const helmet = require('helmet');

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});
const PORT = process.env.PORT || 3000;

// Création du dossier de logs s'il n'existe pas
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

// Middlewares
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(securityHeaders);
app.use(sanitizeLogs);
app.use(morgan('combined', { stream: logger.stream }));

// Configuration de la sécurité avec Helmet
const cspConfig = {
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: [
      "'self'",
      "'unsafe-inline'",
      "'unsafe-eval'",
      "'unsafe-hashes'",
      'https://cdn.jsdelivr.net',
      'https://cdnjs.cloudflare.com',
      'https://cdn.socket.io',
      'https://code.jquery.com',
      'https://unpkg.com'
    ],
    scriptSrcAttr: [
      "'self'",
      "'unsafe-inline'"
    ],
    styleSrc: [
      "'self'",
      "'unsafe-inline'",
      'https://cdn.jsdelivr.net',
      'https://cdnjs.cloudflare.com',
      'https://fonts.googleapis.com'
    ],
    imgSrc: [
      "'self'",
      'data:',
      'https:',
      'http:'
    ],
    fontSrc: [
      "'self'",
      'https://cdn.jsdelivr.net',
      'https://cdnjs.cloudflare.com',
      'https://fonts.gstatic.com',
      'data:'
    ],
    connectSrc: [
      "'self'",
      `http://localhost:${process.env.PORT || 3000}`,
      'https://api.example.com',
      'wss://your-socket-server.com'
    ],
    frameSrc: ["'self'"],
    objectSrc: ["'none'"],
    mediaSrc: ["'self'"],
    frameAncestors: ["'self'"],
    formAction: ["'self'"],
    baseUri: ["'self'"],
    workerSrc: ["'self'"],
    manifestSrc: ["'self'"]
  },
  reportOnly: process.env.NODE_ENV === 'development'
};

app.use(helmet());
app.use(helmet.contentSecurityPolicy(cspConfig));

// Servir les fichiers statiques
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// Connexion MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/mairie', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log(' Connecté à MongoDB'))
.catch(err => {
  console.error('Erreur MongoDB:', err);
  process.exit(1);
});

// Middleware d'authentification
const { authenticate: authMiddleware } = require('./middleware/auth');

// Import des routes
console.log('=== DÉBUT DU CHARGEMENT DES ROUTES ===');
const authRoutes = require('./routes/auth');
console.log('1. Route auth chargée');

const userRoutes = require('./routes/users');
console.log('2. Route users chargée');

const acteRoutes = require('./routes/actes');
console.log('3. Route actes chargée');

const documentRoutes = require('./routes/documents');
console.log('4. Route documents chargée');

const divorceRoutes = require('./routes/divorces');
console.log('5. Route divorces chargée');

const engagementRoutes = require('./routes/engagements');
console.log('6. Route engagements chargée');

const dashboardRoutes = require('./routes/dashboard');
console.log('7. Route dashboard chargée');

const calendrierRoutes = require('./routes/calendrier');
console.log('8. Route calendrier chargée');

// Chargement de la route des conversations
try {
  console.log('Tentative de chargement de la route des conversations...');
  const conversationRoutes = require('./routes/conversations');
  console.log('9. Route conversations chargée avec succès!');
} catch (error) {
  console.error('ERREUR lors du chargement de la route des conversations:', error);
  process.exit(1);
}

console.log('=== FIN DU CHARGEMENT DES ROUTES ===\n');

// Middleware de débogage pour les erreurs non gérées
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  logger.error('Unhandled Rejection:', { reason, stack: reason?.stack });
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  logger.error('Uncaught Exception:', { 
    message: error.message, 
    stack: error.stack,
    name: error.name 
  });
  // Ne pas arrêter le processus en développement pour faciliter le débogage
  if (process.env.NODE_ENV === 'production') process.exit(1);
});

// Middleware pour logger les requêtes entrantes
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`, {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      user: req.user ? req.user.id : 'non authentifié',
      ip: req.ip,
      'user-agent': req.get('user-agent')
    });
  });
  
  next();
});

// Middleware de journalisation des requêtes
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`, {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      user: req.user ? req.user.id : 'non authentifié',
      ip: req.ip
    });
  });
  
  next();
});

// Configuration des routes API
console.log('=== CONFIGURATION DES ROUTES API ===');
app.use('/api/auth', authRoutes);
console.log('Route /api/auth configurée');

app.use('/api/users', userRoutes);
console.log('Route /api/users configurée');

app.use('/api/actes', acteRoutes);
console.log('Route /api/actes configurée');

app.use('/api/documents', documentRoutes);
console.log('Route /api/documents configurée');

app.use('/api/divorces', divorceRoutes);
console.log('Route /api/divorces configurée');

app.use('/api/engagements', engagementRoutes);
console.log('Route /api/engagements configurée');

app.use('/api/dashboard', dashboardRoutes);
console.log('Route /api/dashboard configurée');

// Configuration de la route des conversations
try {
  console.log('Configuration de la route /api/conversations...');
  const conversationRoutes = require('./routes/conversations');
  app.use('/api/conversations', conversationRoutes);
  console.log('Route /api/conversations configurée avec succès!');
} catch (error) {
  console.error('ERREUR lors de la configuration de la route des conversations:', error);
  process.exit(1);
}

app.use('/api/calendrier', calendrierRoutes);
console.log('Route /api/calendrier configurée');

console.log('=== FIN DE LA CONFIGURATION DES ROUTES ===\n');

// Limitation du taux de requêtes pour l'API
app.use('/api/', apiLimiter);

// Page d'accueil
app.get('/', (req, res) => {
  const filePath = path.join(__dirname, 'views', 'index.html');
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    // Si pas de page d'accueil, rediriger vers login
    res.redirect('/login');
  }
});

// Routes pour les pages HTML
const htmlPages = [
  'dashboard', 'naissance', 'mariage', 'deces', 'divorce', 'divorces', 'engagement', 'engagements',
  'calendrier', 'documents', 'rapports', 'messagerie', 'utilisateurs', 'parametres',
  'login', 'register', 'forgot-password', 'verify-otp', 'email-confirmed'
];

htmlPages.forEach(page => {
  app.get(`/${page}`, (req, res) => {
    const filePath = path.join(__dirname, 'views', `${page}.html`);
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      res.status(404).send('Page non trouvée');
    }
  });
});

// Route spéciale pour reset-password avec token
app.get('/reset-password/:token', (req, res) => {
  const filePath = path.join(__dirname, 'views', 'reset-password.html');
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).send('Page non trouvée');
  }
});

// Route pour reset-password sans token (redirection vers forgot-password)
app.get('/reset-password', (req, res) => {
  res.redirect('/forgot-password');
});

// Route pour les fichiers uploadés
app.get('/uploads/:filename', (req, res) => {
  const filePath = path.join(__dirname, 'uploads', req.params.filename);
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: 'Fichier non trouvé' });
  }
});

// Gestion des erreurs globales
app.use((err, req, res, next) => {
  // Vérifier si l'en-tête a déjà été envoyé
  if (res.headersSent) {
    return next(err);
  }
  
  // Définir le statut par défaut à 500 (Erreur serveur)
  const statusCode = err.status || 500;
  
  // Journaliser l'erreur
  logger.error('Erreur non gérée:', {
    message: err.message,
    stack: err.stack,
    status: statusCode,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip
  });
  
  // Préparer la réponse d'erreur
  const errorResponse = {
    success: false,
    error: {
      message: statusCode === 500 ? 'Erreur interne du serveur' : err.message,
      status: statusCode,
      // Inclure la pile d'appel en développement uniquement
      ...(process.env.NODE_ENV === 'development' && { 
        stack: err.stack,
        details: err.details 
      })
    }
  };
  
  // Envoyer la réponse d'erreur
  res.status(statusCode).json(errorResponse);
});

// Gestion des routes non trouvées (404)
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    error: {
      message: 'Route non trouvée',
      status: 404,
      path: req.originalUrl
    }
  });
});

// Configuration Socket.IO avec protections
const connectedUsers = new Map(); // Tracker les connexions

io.on('connection', (socket) => {
  console.log('Nouvelle connexion Socket.IO:', socket.id);
  
  // Limiter le nombre de connexions par IP
  const clientIP = socket.handshake.address;
  const userConnections = connectedUsers.get(clientIP) || [];
  
  if (userConnections.length >= 5) { // Max 5 connexions par IP
    console.warn(`Trop de connexions pour IP ${clientIP}`);
    socket.disconnect(true);
    return;
  }
  
  userConnections.push(socket.id);
  connectedUsers.set(clientIP, userConnections);
  
  // Timeout de connexion inactive (30 minutes)
  const inactivityTimeout = setTimeout(() => {
    console.log(`Déconnexion pour inactivité: ${socket.id}`);
    socket.disconnect(true);
  }, 30 * 60 * 1000);
  
  // Nettoyer le timeout sur activité
  const resetTimeout = () => {
    clearTimeout(inactivityTimeout);
  };
  
  // Rejoindre une conversation
  socket.on('join-conversation', (conversationId) => {
    resetTimeout();
    if (typeof conversationId !== 'string' || conversationId.length > 50) {
      socket.emit('error', 'ID de conversation invalide');
      return;
    }
    socket.join(conversationId);
    console.log(`Socket ${socket.id} a rejoint la conversation ${conversationId}`);
  });
  
  // Quitter une conversation
  socket.on('leave-conversation', (conversationId) => {
    resetTimeout();
    socket.leave(conversationId);
    console.log(`Socket ${socket.id} a quitté la conversation ${conversationId}`);
  });
  
  // Nouveau message avec validation
  socket.on('new-message', (data) => {
    resetTimeout();
    
    // Validation des données
    if (!data || !data.conversationId || !data.message) {
      socket.emit('error', 'Données de message invalides');
      return;
    }
    
    // Limiter la taille du message
    if (data.message.length > 1000) {
      socket.emit('error', 'Message trop long');
      return;
    }
    
    socket.to(data.conversationId).emit('message-received', data);
  });
  
  // Déconnexion
  socket.on('disconnect', () => {
    clearTimeout(inactivityTimeout);
    
    // Nettoyer les connexions trackées
    const userConnections = connectedUsers.get(clientIP) || [];
    const updatedConnections = userConnections.filter(id => id !== socket.id);
    
    if (updatedConnections.length === 0) {
      connectedUsers.delete(clientIP);
    } else {
      connectedUsers.set(clientIP, updatedConnections);
    }
    
    console.log('Déconnexion Socket.IO:', socket.id);
  });
  
  // Gérer les erreurs Socket.IO
  socket.on('error', (error) => {
    console.error('Erreur Socket.IO:', error);
  });
});

// Démarrer le serveur
server.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
  console.log('Socket.IO configuré et prêt');
  console.log('Structure chargée:');
  console.log('- Middleware: auth.js');
  console.log('- Models: Acte, Conversation, Document, Message, PendingUser, User');
  console.log('- Routes: actes, auth, calendar, conversations, documents, messagerie, rapports, users');
  console.log('- Views:  pages HTML');
});