require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const app = express();
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
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/etat_civil_tchad', {
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
app.use('/api/actes', authMiddleware, require('./routes/actes'));
app.use('/api/documents', authMiddleware, require('./routes/documents'));
app.use('/api/users', authMiddleware, require('./routes/users'));
app.use('/api/conversations', authMiddleware, require('./routes/conversations'));
app.use('/api/messagerie', authMiddleware, require('./routes/messagerie'));
app.use('/api/calendrier', authMiddleware, require('./routes/calendrier'));
app.use('/api/rapports', authMiddleware, require('./routes/rapports'));

// Servir les fichiers HTML
app.get('/', (req, res) => res.redirect('/dashboard'));

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

app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
  console.log('Structure chargée:');
  console.log('- Middleware: auth.js');
  console.log('- Models: Acte, Conversation, Document, Message, PendingUser, User');
  console.log('- Routes: actes, auth, calendar, conversations, documents, messagerie, rapports, users');
  console.log('- Views:  pages HTML');
});