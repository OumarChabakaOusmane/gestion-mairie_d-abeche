require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { createServer } = require('http');
const { Server } = require('socket.io');

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

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
app.use('/api/auth', require('./routes/auth'));
app.use('/api/dashboard', authMiddleware, require('./routes/dashboard'));
app.use('/api/actes', authMiddleware, require('./routes/actes'));
app.use('/api/documents', authMiddleware, require('./routes/documents'));
app.use('/api/users', authMiddleware, require('./routes/users'));
app.use('/api/conversations', authMiddleware, require('./routes/conversations'));
app.use('/api/messagerie', authMiddleware, require('./routes/messagerie'));
app.use('/api/calendrier', authMiddleware, require('./routes/calendrier'));
app.use('/api/rapports', authMiddleware, require('./routes/rapports'));

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
  'dashboard', 'naissance', 'mariage', 'deces', 'calendrier',
  'documents', 'rapports', 'messagerie', 'utilisateurs', 'parametres',
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

// Gestion des erreurs 404 pour les API
app.use('/api', (req, res) => {
  res.status(404).json({ 
    success: false, 
    error: 'Endpoint API non trouvé' 
  });
});

// Gestion des erreurs 404 pour les pages
app.use((req, res) => {
  res.status(404).send('Page non trouvée');
});

// Gestion des erreurs serveur
app.use((err, req, res, next) => {
  console.error('Erreur serveur:', err);
  
  if (req.path.startsWith('/api/')) {
    res.status(500).json({ 
      success: false, 
      error: 'Erreur serveur interne' 
    });
  } else {
    res.status(500).send('Erreur serveur');
  }
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

server.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
  console.log('Socket.IO configuré et prêt');
  console.log('Structure chargée:');
  console.log('- Middleware: auth.js');
  console.log('- Models: Acte, Conversation, Document, Message, PendingUser, User');
  console.log('- Routes: actes, auth, calendar, conversations, documents, messagerie, rapports, users');
  console.log('- Views:  pages HTML');
});