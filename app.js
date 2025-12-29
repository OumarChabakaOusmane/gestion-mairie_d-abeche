require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const { connectDB } = require('./config/db');
const { validateEnv } = require('./config/validateEnv');
const Conversation = require('./models/Conversation');
const Message = require('./models/Message');
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

// Configuration CORS pour l'application Express
app.use(cors({
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
}));

// Création du serveur HTTP
const server = createServer(app);

// Configuration CORS pour Socket.IO
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

// Configuration du moteur de vue HTML
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');
app.set('views', path.join(__dirname, 'views'));

// Middleware pour les fichiers statiques
app.use(express.static(path.join(__dirname, 'public')));
app.use('/css', express.static(path.join(__dirname, 'public/css')));
app.use('/js', express.static(path.join(__dirname, 'public/js')));
app.use('/images', express.static(path.join(__dirname, 'public/images')));
app.use('/fonts', express.static(path.join(__dirname, 'public/fonts')));

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
// console.log('=== DÉBUT DU CHARGEMENT DES ROUTES ===');
const authRoutes = require('./routes/auth');
console.log('1. Route auth chargée');

const userRoutes = require('./routes/users');
console.log('2. Route users chargée');

const acteRoutes = require('./routes/actes');
console.log('3. Route actes chargée');

const documentRoutes = require('./routes/documents');
console.log('4. Route documents chargée');



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
const demandeActeRoutes = require('./routes/demandeActeRoutes');
const apiActesRoutes = require('./routes/api/actes');
// Route conversations désactivée - on utilise maintenant messagerieRoutes
// try {
//   console.log('Tentative de chargement de la route des conversations...');
//   conversationRoutes = require('./routes/conversations');
//   console.log('9. Route conversations chargée avec succès!');
// } catch (error) {
//   console.error('ERREUR lors du chargement de la route des conversations:', error);
//   process.exit(1);
// }
conversationRoutes = null; // Désactivé - on utilise messagerieRoutes

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


console.log('=== CONFIGURATION DES ROUTES API ===');

// Routes d'authentification
app.use('/api/auth', authLimiter, authRoutes);
console.log('Route /api/auth configurée');

// Routes utilisateurs
app.use('/api/users', userRoutes);
console.log('Route /api/users configurée');

// Routes pour les demandes d'actes (nouvelle API)
app.use('/api/demandes-actes', apiActesRoutes);
console.log('Route /api/demandes-actes configurée');

// Anciennes routes d'actes (à supprimer progressivement)
app.use('/api/actes', acteRoutes);
console.log('Route /api/actes configurée (ancienne version)');

// Routes pour les documents
app.use('/api/documents', documentRoutes);
console.log('Route /api/documents configurée');

// Routes pour les mariages
app.use('/api/mariages', mariageRoutes);
console.log('Route /api/mariages configurée');

// Routes pour le tableau de bord
app.use('/api/dashboard', dashboardRoutes);
console.log('Route /api/dashboard configurée');

// Route des naissances gérée plus haut dans le fichier


// Configuration de la route des conversations (montage unique)
// NOTE: Cette route est maintenant gérée par messagerieRoutes ci-dessous
// Si conversationRoutes existe et est différent, il faudra le gérer séparément
// console.log('Configuration de la route /api/conversations...');
// app.use('/api/conversations', conversationRoutes);
// console.log('Route /api/conversations configurée avec succès!');

app.use('/api/calendrier', calendrierRoutes);
console.log('Route /api/calendrier configurée');

// Routes additionnelles
app.use('/api/naissances', naissancesRoutes);
console.log('Route /api/naissances configurée');

// Routes pour les demandes d'actes en ligne
app.use('/api/demandes-actes', authMiddleware, demandeActeRoutes);
console.log('Route /api/demandes-actes configurée');

// Ces routeurs utilisent req.user -> protéger avec authMiddleware
// Middleware pour passer io aux routes de messagerie
app.use('/api/messagerie', authMiddleware, (req, res, next) => {
  req.io = io;
  next();
}, messagerieRoutes);
console.log('Route /api/messagerie configurée');

// Routes de conversations (utilisées par le frontend)
app.use('/api/conversations', authMiddleware, (req, res, next) => {
  req.io = io;
  next();
}, messagerieRoutes);
console.log('Route /api/conversations configurée (alias de /api/messagerie)');

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
  'dashboard', 'naissance', 'mariage', 'deces', 'edit-acte',
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
  console.log('=== NOUVELLE CONNEXION SOCKET.IO ===');
  console.log('ID de la socket:', socket.id);
  console.log('Adresse IP du client:', socket.handshake.address);
  console.log('En-têtes de la requête:', socket.handshake.headers);
  
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
  console.log(`Connexion acceptée pour ${socket.id} (${userConnections.length} connexions pour cette IP)`);
  
  // Timeout de connexion inactive (30 minutes)
  const inactivityTimeout = setTimeout(() => {
    console.log(`Déconnexion pour inactivité: ${socket.id}`);
    socket.disconnect(true);
  }, 30 * 60 * 1000);
  
  const resetTimeout = () => {
    clearTimeout(inactivityTimeout);
  };
  
  // Gestion des événements de connexion utilisateur
  socket.on('join', (userId) => {
    console.log(`=== UTILISATEUR REJOINT ===`);
    console.log(`Socket ID: ${socket.id}`);
    console.log(`User ID: ${userId}`);
    
    // Stocker l'ID utilisateur avec la socket
    socket.userId = userId;
    
    // Informer les autres utilisateurs que cet utilisateur est en ligne
    socket.broadcast.emit('userOnline', userId);
    
    console.log(`L'utilisateur ${userId} est maintenant connecté (${socket.id})`);
  });

  // Rejoindre une conversation
  socket.on('joinConversation', async (conversationId) => {
    if (!conversationId) {
      console.error('Aucun ID de conversation fourni');
      return;
    }
    
    try {
      // Vérifier que l'utilisateur a accès à cette conversation
      const conversation = await Conversation.findOne({
        _id: conversationId,
        participants: { $in: [socket.userId] }
      });
      
      if (!conversation) {
        console.error(`L'utilisateur ${socket.userId} n'a pas accès à la conversation ${conversationId}`);
        return socket.emit('error', { message: 'Accès non autorisé à cette conversation' });
      }
      
      const roomName = `conversation_${conversationId}`;
      
      // Rejoindre la salle de conversation
      await socket.join(roomName);
      console.log(`Socket ${socket.id} a rejoint la conversation ${conversationId} (salle: ${roomName})`);
      
      // Marquer les messages comme lus
      if (socket.userId) {
        const result = await Message.updateMany(
          { 
            conversation: conversationId,
            sender: { $ne: socket.userId },
            readBy: { $ne: socket.userId }
          },
          { $addToSet: { readBy: socket.userId } }
        );
        
        console.log(`Marquage des messages comme lus pour l'utilisateur ${socket.userId}:`, result);
        
        // Informer les autres participants que les messages ont été lus
        conversation.participants.forEach(participantId => {
          if (participantId.toString() !== socket.userId) {
            io.to(`user_${participantId}`).emit('messagesRead', {
              conversationId: conversationId,
              readerId: socket.userId
            });
          }
        });
      }
      
      resetTimeout();
    } catch (error) {
      console.error('Erreur lors de la jointure de la conversation:', error);
      socket.emit('error', { message: 'Erreur lors de la jointure de la conversation' });
    }
  });

  // Gestion des messages
  socket.on('sendMessage', async (data) => {
    try {
      resetTimeout();
      
      const { conversationId, content, senderId, recipientId } = data;
      
      console.log('=== NOUVEAU MESSAGE ===');
      console.log('Conversation ID:', conversationId);
      console.log('Expéditeur:', senderId);
      console.log('Destinataire:', recipientId);
      console.log('Contenu:', content);
      
      // Vérifier que l'expéditeur est bien celui qui est connecté
      if (senderId !== socket.userId) {
        console.error('Tentative d\'envoi de message avec un ID expéditeur incorrect');
        return socket.emit('error', { message: 'Non autorisé' });
      }
      
      // Vérifier que l'utilisateur a le droit d'envoyer un message dans cette conversation
      const conversation = await Conversation.findOne({
        _id: conversationId,
        participants: { $in: [senderId] }
      }).populate('participants', 'name email');
      
      if (!conversation) {
        console.error('Conversation non trouvée ou accès non autorisé');
        return socket.emit('error', { message: 'Conversation non trouvée ou accès non autorisé' });
      }
      
      // Créer un nouveau message
      const message = new Message({
        conversation: conversationId,
        sender: senderId,
        content: content,
        readBy: [senderId]
      });
      
      // Sauvegarder le message
      await message.save();
      
      // Mettre à jour la conversation
      conversation.lastMessage = message._id;
      conversation.updatedAt = new Date();
      await conversation.save();
      
      // Récupérer le message avec les données de l'expéditeur
      const populatedMessage = await Message.findById(message._id)
        .populate('sender', 'name email');
      
      console.log('Message sauvegardé avec succès:', populatedMessage);
      
      // Diffuser le message aux participants de la conversation
      const roomName = `conversation_${conversationId}`;
      console.log(`Envoi du message à la salle: ${roomName}`);
      
      io.to(roomName).emit('newMessage', {
        ...populatedMessage.toObject(),
        conversation: conversation
      });
      
      // Informer les participants qu'ils ont un nouveau message
      for (const participant of conversation.participants) {
        const participantId = participant._id.toString();
        if (participantId !== senderId) {
          const userRoom = `user_${participantId}`;
          console.log(`Envoi de la notification à l'utilisateur: ${participantId} (salle: ${userRoom})`);
          
          // Compter les messages non lus
          const unreadCount = await Message.countDocuments({
            conversation: conversationId,
            sender: { $ne: participantId },
            readBy: { $ne: participantId }
          });
          
          io.to(userRoom).emit('newMessageNotification', {
            conversationId: conversationId,
            message: populatedMessage,
            unreadCount: unreadCount,
            conversation: conversation
          });
        }
      }
    } catch (error) {
      console.error('Erreur lors de l\'envoi du message:', error);
      socket.emit('error', { 
        message: 'Erreur lors de l\'envoi du message',
        error: error.message 
      });
    }
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
  
  // Gestion des erreurs
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
  console.log('- Routes: auth, users, actes, documents, mariages, dashboard, calendrier, conversations, naissances, messagerie, rapports, settings');
  console.log('- Views:  pages HTML');
});