require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const { connectDB } = require('./config/db');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { securityHeaders, apiLimiter, sanitizeLogs, validateInputs } = require('./middleware/security');
const disableSourceMaps = require('./middleware/disableSourceMaps');
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
  allowedHeaders: ['Content-Type', 'Authorization'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));
app.use(cookieParser());
// Middleware pour gérer les données JSON et URL encodées
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Middleware pour les fichiers statiques
app.use(express.static(path.join(__dirname, 'public')));

// Middleware de sécurité et de journalisation
app.use(securityHeaders);
app.use(disableSourceMaps);
app.use(sanitizeLogs);
app.use(morgan('combined', { stream: logger.stream }));

// Configuration de sécurité avec Helmet (la CSP est gérée par le middleware securityHeaders)
app.use(helmet({
  contentSecurityPolicy: false
}));

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

const engagementRoutes = require('./routes/engagements');
console.log('6. Route engagements chargée');

const mariageRoutes = require('./routes/mariages');
console.log('7. Route mariages chargée');

const dashboardRoutes = require('./routes/dashboard');
console.log('8. Route dashboard chargée');

const calendrierRoutes = require('./routes/calendrier');
console.log('9. Route calendrier chargée');

// Chargement de la route des conversations (déclaration sans montage immédiat)
let conversationRoutes = null;
try {
  console.log('Tentative de chargement de la route des conversations...');
  conversationRoutes = require('./routes/conversations');
  console.log('9. Route conversations chargée avec succès!');
} catch (error) {
  console.error('ERREUR lors du chargement de la route des conversations:', error);
  process.exit(1);
}

// Chargement des routes de test
const testRoutes = express.Router();

// Simple test route
const simpleTestRoutes = require('./routes/simple-test');
const pdfTestRoutes = require('./routes/pdf-test');
const testPdfRoute = require('./routes/test-pdf-route');

testRoutes.use('/simple', simpleTestRoutes);
testRoutes.use('/pdf', pdfTestRoutes);
testRoutes.use('/test-pdf', testPdfRoute);

// Mount all test routes under /api/test
app.use('/api/test', testRoutes);

console.log('10. Routes de test chargées avec succès!');

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

// Journalisation HTTP gérée par morgan + logger.stream

// Limitation du taux de requêtes pour l'API (avant le montage des routes)
app.use('/api', apiLimiter);

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
app.use('/api/mariages', mariageRoutes);
app.use('/api/dashboard', dashboardRoutes);
console.log('Route /api/engagements configurée');

// Route des naissances gérée plus haut dans le fichier


// Configuration de la route des conversations (montage unique)
console.log('Configuration de la route /api/conversations...');
app.use('/api/conversations', conversationRoutes);
console.log('Route /api/conversations configurée avec succès!');

app.use('/api/calendrier', calendrierRoutes);
console.log('Route /api/calendrier configurée');

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