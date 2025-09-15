const multer = require('multer');
const path = require('path');
const fs = require('fs');
const logger = require('../config/logger');

// Configuration du stockage des fichiers
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../public/uploads/avatars');
    
    // Créer le dossier s'il n'existe pas
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Générer un nom de fichier unique avec l'ID de l'utilisateur et un timestamp
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `avatar-${req.user.id}-${uniqueSuffix}${ext}`);
  }
});

// Filtrage des types de fichiers
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['.jpg', '.jpeg', '.png', '.gif'];
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedTypes.includes(ext)) {
    cb(null, true);
  } else {
    const error = new Error('Type de fichier non autorisé. Seuls les fichiers JPG, JPEG, PNG et GIF sont acceptés.');
    error.status = 400;
    cb(error, false);
  }
};

// Configuration de l'upload
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 Mo max
    files: 1
  },
  fileFilter: fileFilter
});

// Middleware pour gérer les erreurs de multer
const handleUploadErrors = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    // Une erreur Multer s'est produite lors du téléchargement
    logger.error('Erreur Multer lors du téléchargement du fichier', {
      error: err.message,
      code: err.code,
      field: err.field,
      userId: req.user?.id,
      requestId: req.id
    });
    
    let message = 'Erreur lors du téléchargement du fichier';
    
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = 'Le fichier est trop volumineux. La taille maximale autorisée est de 5 Mo.';
    } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      message = 'Trop de fichiers téléchargés. Un seul fichier est autorisé.';
    }
    
    return res.status(400).json({
      success: false,
      message: message
    });
  } else if (err) {
    // Une erreur inattendue s'est produite
    logger.error('Erreur inattendue lors du téléchargement du fichier', {
      error: err.message,
      stack: err.stack,
      userId: req.user?.id,
      requestId: req.id
    });
    
    return res.status(500).json({
      success: false,
      message: 'Une erreur est survenue lors du téléchargement du fichier',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
  
  // Si aucune erreur, passer au middleware suivant
  next();
};

module.exports = {
  upload,
  handleUploadErrors
};
