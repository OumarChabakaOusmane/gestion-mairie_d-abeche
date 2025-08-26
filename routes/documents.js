const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises; // Utilisation de l'API promise pour éviter les callbacks
const Document = require('../models/Document');

// Configuration de Multer pour le stockage des fichiers
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    try {
      await fs.mkdir(uploadDir, { recursive: true }); // Crée le dossier de manière asynchrone
      cb(null, uploadDir);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const safeFilename = uniqueSuffix + ext; // Nom de fichier unique avec extension
    cb(null, safeFilename);
  }
});

// Filtrage des types de fichiers autorisés
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'text/plain'
  ];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Type de fichier non autorisé. Seuls PDF, JPEG, PNG et TXT sont acceptés.'), false);
  }
};

// Configuration de Multer avec limites et filtres
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10 Mo max
  }
});

// Middleware pour gérer les erreurs Multer
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      success: false,
      error: err.message
    });
  } else if (err) {
    return res.status(400).json({
      success: false,
      error: err.message
    });
  }
  next();
};

// Upload d'un document
router.post('/', upload.single('document'), handleMulterError, async (req, res) => {
  try {
    const { title, type } = req.body;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Aucun fichier uploadé ou type non autorisé'
      });
    }

    const document = new Document({
      title,
      type,
      filename: req.file.filename,
      originalName: req.file.originalname,
      path: req.file.path,
      size: req.file.size,
      mimeType: req.file.mimetype
    });

    await document.save();

    res.status(201).json({
      success: true,
      message: 'Document uploadé avec succès',
      data: document
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: 'Erreur serveur lors de l\'upload du document'
    });
  }
});

// Lister tous les documents
router.get('/', async (req, res) => {
  try {
    const documents = await Document.find().sort({ uploadDate: -1 });
    res.json({
      success: true,
      data: documents
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: 'Erreur serveur lors de la récupération des documents'
    });
  }
});

// Télécharger un document
router.get('/:id/download', async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);
    
    if (!document) {
      return res.status(404).json({
        success: false,
        error: 'Document non trouvé'
      });
    }

    // Vérifie que le fichier existe avant de le télécharger
    try {
      await fs.access(document.path);
      res.download(document.path, document.originalName);
    } catch (err) {
      res.status(404).json({
        success: false,
        error: 'Fichier physique non trouvé'
      });
    }
  } catch (err) {
    res.status(500).json({
      success: false,
      error: 'Erreur serveur lors du téléchargement'
    });
  }
});

// Supprimer un document
router.delete('/:id', async (req, res) => {
  try {
    const document = await Document.findByIdAndDelete(req.params.id);
    
    if (!document) {
      return res.status(404).json({
        success: false,
        error: 'Document non trouvé'
      });
    }

    // Suppression asynchrone du fichier physique
    try {
      await fs.unlink(document.path);
      res.json({
        success: true,
        message: 'Document supprimé avec succès'
      });
    } catch (err) {
      console.error('Erreur lors de la suppression du fichier physique:', err);
      res.status(500).json({
        success: false,
        error: 'Erreur lors de la suppression du fichier physique'
      });
    }
  } catch (err) {
    res.status(500).json({
      success: false,
      error: 'Erreur serveur lors de la suppression'
    });
  }
});

module.exports = router;