const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const Document = require('../models/Document');
const { authenticate, authorize } = require('../middleware/auth');

// Configuration du stockage
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/documents');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (err) {
      console.error('Erreur création dossier:', err);
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'doc-' + uniqueSuffix + ext);
  }
});

// Filtrage des types de fichiers
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Type de fichier non autorisé'), false);
  }
};

// Configuration de Multer
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// Middleware de gestion d'erreurs
const handleMulterError = (err, req, res, next) => {
  if (err) {
    return res.status(400).json({
      success: false,
      error: err.message || 'Erreur lors du téléchargement'
    });
  }
  next();
};

// Upload d'un document
router.post('/', 
  authenticate,
  authorize(['admin', 'agent']),
  upload.single('document'),
  handleMulterError,
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'Aucun fichier reçu'
        });
      }

      const document = new Document({
        title: req.body.title || req.file.originalname,
        type: req.body.type || 'autre',
        filename: req.file.filename,
        originalName: req.file.originalname,
        path: req.file.path,
        size: req.file.size,
        mimeType: req.file.mimetype
      });

      await document.save();
      
      res.status(201).json({
        success: true,
        data: document
      });

    } catch (error) {
      console.error('Erreur upload:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur serveur: ' + error.message
      });
    }
  }
);

// Lister tous les documents
router.get('/', 
  authenticate,
  async (req, res) => {
    try {
      const documents = await Document.find().sort({ uploadDate: -1 });
      res.json({
        success: true,
        data: documents
      });
    } catch (error) {
      console.error('Erreur liste documents:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur lors de la récupération des documents'
      });
    }
  }
);

// Télécharger un document
router.get('/:id/download', 
  authenticate,
  async (req, res) => {
    try {
      const document = await Document.findById(req.params.id);
      
      if (!document) {
        return res.status(404).json({
          success: false,
          error: 'Document non trouvé'
        });
      }

      // Vérifier si le fichier existe
      try {
        await fs.access(document.path);
        res.download(document.path, document.originalName);
      } catch (err) {
        console.error('Fichier non trouvé:', document.path);
        res.status(404).json({
          success: false,
          error: 'Fichier non trouvé sur le serveur'
        });
      }
    } catch (error) {
      console.error('Erreur téléchargement:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur lors du téléchargement du document'
      });
    }
  }
);

// Supprimer un document
router.delete('/:id', 
  authenticate,
  authorize(['admin']),
  async (req, res) => {
    try {
      const document = await Document.findById(req.params.id);
      
      if (!document) {
        return res.status(404).json({
          success: false,
          error: 'Document non trouvé'
        });
      }

      // Supprimer le fichier physique
      try {
        await fs.unlink(document.path);
      } catch (err) {
        console.error('Erreur suppression fichier:', err);
        // On continue quand même
      }

      await document.deleteOne();

      res.json({
        success: true,
        message: 'Document supprimé avec succès'
      });
    } catch (error) {
      console.error('Erreur suppression:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur lors de la suppression du document'
      });
    }
  }
);

module.exports = router;