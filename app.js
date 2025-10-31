require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const { connectDB } = require('./config/db');
const { validateEnv } = require('./config/validateEnv');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { securityHeaders, apiLimiter, authLimiter, sanitizeLogs, validateInputs } = require('./middleware/security');
const disableSourceMaps = require('./middleware/disableSourceMaps');
const logger = require('./config/logger');
const morgan = require('morgan');
const helmet = require('helmet');
const crypto = require('crypto');
const csrf = require('csurf');
const jwt = require('jsonwebtoken');
const User = require('./models/User');

// Valider les variables d'environnement au démarrage
validateEnv();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: function(origin, callback) {
      // Autoriser les requêtes sans origine (comme les applications mobiles ou Postman)
      if (!origin) return callback(null, true);
      
      const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [];
      if (allowedOrigins.includes(origin) || origin.includes('localhost') || origin.includes('127.0.0.1')) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
  }
});

// Configuration CSRF
const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 3600 // 1 heure
  }
});

// Middleware pour ajouter le token CSRF aux réponses
app.use((req, res, next) => {
  res.locals.csrfToken = req.csrfToken ? req.csrfToken() : '';
  next();
});

const PORT = process.env.PORT || 3000;
const APP_VERSION = process.env.APP_VERSION || '1.0.0';

// Création du dossier de logs s'il n'existe pas
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

// Middlewares
// Faire confiance au proxy pour récupérer les IPs réelles (X-Forwarded-For)
app.set('trust proxy', 1);

app.use(cors({
  origin: function(origin, callback) {
    // Autoriser toutes les origines en développement
    if (!origin || process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    // En production, vérifier l'origine
    const allowedOrigins = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : [];
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
  exposedHeaders: ['X-Request-Id'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));
app.use(cookieParser());
// Middleware pour gérer les données JSON et URL encodées
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression HTTP pour réduire la taille des réponses
app.use(compression());

// Configuration du moteur de vue EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware pour les fichiers statiques
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1y',
  etag: true,
  lastModified: true
}));

// Middleware pour ajouter le token CSRF aux réponses
app.use((req, res, next) => {
  // Générer un token CSRF s'il n'existe pas
  if (!req.cookies._csrf) {
    const csrfToken = crypto.randomBytes(16).toString('hex');
    res.cookie('_csrf', csrfToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
    res.locals.csrfToken = csrfToken;
  } else {
    res.locals.csrfToken = req.cookies._csrf;
  }
  next();
});

// Middleware de sécurité et de journalisation
app.use(securityHeaders);
app.use(disableSourceMaps);
app.use(sanitizeLogs);

// Ajout d'un identifiant de requête pour la corrélation des logs
morgan.token('id', (req) => req.id);
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
});

// Logger HTTP avec identifiant de requête
app.use(morgan(':id :remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"', { stream: logger.stream }));

// Helmet déjà appliqué via securityHeaders (éviter les redondances)

// Servir les fichiers statiques
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// Connexion MongoDB centralisée
connectDB();

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


const mariageRoutes = require('./routes/mariages');
console.log('7. Route mariages chargée');

const dashboardRoutes = require('./routes/dashboard');
console.log('8. Route dashboard chargée');

const calendrierRoutes = require('./routes/calendrier');
console.log('9. Route calendrier chargée');

// Chargement de la route des conversations (déclaration sans montage immédiat)
let conversationRoutes = null;
// Routes additionnelles
const naissancesRoutes = require('./routes/naissances');
const messagerieRoutes = require('./routes/messagerie');
const rapportsRoutes = require('./routes/rapports');
const settingsRoutes = require('./routes/settings');
try {
  console.log('Tentative de chargement de la route des conversations...');
  conversationRoutes = require('./routes/conversations');
  console.log('9. Route conversations chargée avec succès!');
} catch (error) {
  console.error('ERREUR lors du chargement de la route des conversations:', error);
  process.exit(1);
}

// Chargement des routes de test (optionnel, non bloquant)
const testRoutes = express.Router();
try {
  const simpleTestRoutes = require('./routes/simple-test');
  testRoutes.use('/simple', simpleTestRoutes);
} catch (e) {
  console.warn('Route de test simple introuvable, ignorée');
}

try {
  const pdfTestRoutes = require('./routes/pdf-test');
  testRoutes.use('/pdf', pdfTestRoutes);
} catch (e) {
  console.warn('Route de test pdf introuvable, ignorée');
}

try {
  const testPdfRoute = require('./routes/test-pdf-route');
  testRoutes.use('/test-pdf', testPdfRoute);

// Les routes d'authentification sont déjà importées plus haut
} catch (e) {
  console.warn('Route test-pdf-route introuvable, ignorée');
}

// Monter seulement si au moins une sous-route a été ajoutée
if (testRoutes.stack && testRoutes.stack.length > 0) {
  app.use('/api/test', testRoutes);
  console.log('10. Routes de test chargées avec succès!');
} else {
  console.log('10. Aucune route de test chargée (ignorées).');
}

console.log('=== FIN DU CHARGEMENT DES ROUTES ===\n');

// Endpoints de santé
app.get('/healthz', async (req, res) => {
  const dbState = mongoose.connection.readyState; // 0=disconnected,1=connected,2=connecting,3=disconnecting
  const healthy = dbState === 1;
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    uptime: process.uptime(),
    version: APP_VERSION,
    db: dbState
  });
});

app.get('/readyz', async (req, res) => {
  const dbState = mongoose.connection.readyState;
  const ready = dbState === 1;
  res.status(ready ? 200 : 503).json({
    status: ready ? 'ready' : 'not-ready',
    version: APP_VERSION,
    db: dbState
  });
});

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

// Journalisation HTTP gérée par morgan + logger.stream

// Limitation du taux de requêtes pour l'API (avant le montage des routes)
app.use('/api', apiLimiter);

// Configuration des routes API
console.log('=== CONFIGURATION DES ROUTES API ===');

// Les routes sont déjà importées plus haut dans le fichier

// Monter les routes avec leurs préfixes
app.use('/api/auth', authLimiter, authRoutes);
console.log('Route /api/auth configurée');

app.use('/api/users', userRoutes);
console.log('Route /api/users configurée');

app.use('/api/actes', acteRoutes);
console.log('Route /api/actes configurée');

app.use('/api/documents', documentRoutes);
console.log('Route /api/documents configurée');

app.use('/api/divorces', divorceRoutes);
console.log('Route /api/divorces configurée');

app.use('/api/mariages', mariageRoutes);
console.log('Route /api/mariages configurée');

app.use('/api/dashboard', dashboardRoutes);
console.log('Route /api/dashboard configurée');

// Route des naissances gérée plus haut dans le fichier


// Configuration de la route des conversations (montage unique)
console.log('Configuration de la route /api/conversations...');
app.use('/api/conversations', conversationRoutes);
console.log('Route /api/conversations configurée avec succès!');

app.use('/api/calendrier', calendrierRoutes);
console.log('Route /api/calendrier configurée');

// Routes additionnelles
app.use('/api/naissances', naissancesRoutes);
console.log('Route /api/naissances configurée');

// Ces routeurs utilisent req.user -> protéger avec authMiddleware
app.use('/api/messagerie', authMiddleware, messagerieRoutes);
console.log('Route /api/messagerie configurée');

app.use('/api/rapports', authMiddleware, rapportsRoutes);
console.log('Route /api/rapports configurée');

app.use('/api/settings', authMiddleware, settingsRoutes);
console.log('Route /api/settings configurée');

console.log('=== FIN DE LA CONFIGURATION DES ROUTES ===\n');

// Rate limiter déjà appliqué avant

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
  'dashboard', 'naissance', 'mariage', 'deces', 'divorces',
  'calendrier', 'documents', 'rapports', 'messagerie', 'utilisateurs', 'parametres',
  'login', 'register', 'forgot-password', 'verify-otp', 'email-confirmed'
];

// Route pour le formulaire de divorce avec authentification et CSRF
app.get('/divorce', csrfProtection, (req, res) => {
  // Vérifier si l'utilisateur est authentifié
  const token = req.cookies.token || req.headers['authorization']?.split(' ')[1];
  
  if (!token) {
    return res.redirect('/login?redirect=/divorce');
  }
  
  // Vérifier la validité du token
  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
    if (err) {
      // Si le token est invalide, rediriger vers la page de connexion
      return res.redirect('/login?redirect=/divorce');
    }
    
    try {
      // Vérifier si l'utilisateur existe
      const user = await User.findById(decoded.id);
      if (!user) {
        return res.redirect('/login?redirect=/divorce');
      }
      
      // Rendre la page avec le token CSRF
      res.render('divorce', { 
        title: 'Nouvel acte de divorce',
        csrfToken: req.csrfToken()
      });
    } catch (error) {
      console.error('Erreur lors de la vérification de l\'utilisateur:', error);
      res.status(500).send('Erreur interne du serveur');
    }
  });
});

// Alias pratique: /divorce/:id -> redirige vers le formulaire en mode édition
app.get('/divorce/:id', (req, res) => {
  const { id } = req.params;
  if (!id) {
    return res.redirect('/divorce');
  }
  // Conserve la query string existante en ajoutant edit
  const qs = new URLSearchParams({ ...req.query, edit: id }).toString();
  res.redirect(`/divorce?${qs}`);
});

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
  console.log('- Routes: auth, users, actes, documents, divorces, mariages, dashboard, calendrier, conversations, naissances, messagerie, rapports, settings');
  console.log('- Views:  pages HTML');
});