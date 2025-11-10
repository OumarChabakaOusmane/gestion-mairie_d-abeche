const Document = require('../models/Document');
const fs = require('fs').promises;
const path = require('path');

// Créer un nouveau document
exports.uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Aucun fichier téléchargé'
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
    console.error('Erreur lors du téléchargement du document:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors du téléchargement du document'
    });
  }
};

// Récupérer tous les documents
exports.getAllDocuments = async (req, res) => {
  try {
    const documents = await Document.find().sort('-uploadDate');
    res.json({
      success: true,
      count: documents.length,
      data: documents
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des documents:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des documents'
    });
  }
};

// Télécharger un document
exports.downloadDocument = async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);
    
    if (!document) {
      return res.status(404).json({
        success: false,
        error: 'Document non trouvé'
      });
    }

    const filePath = path.join(__dirname, '..', document.path);
    
    // Vérifier si le fichier existe
    try {
      await fs.access(filePath);
    } catch (err) {
      return res.status(404).json({
        success: false,
        error: 'Fichier introuvable sur le serveur'
      });
    }

    // En-têtes pour forcer le téléchargement avec encodage UTF-8
    const encodedFilename = encodeURIComponent(document.originalName);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${document.originalName}"; filename*=UTF-8''${encodedFilename}`);
    
    // Envoyer le fichier
    res.sendFile(filePath);
  } catch (error) {
    console.error('Erreur lors du téléchargement du document:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors du téléchargement du document'
    });
  }
};

// Supprimer un document
exports.deleteDocument = async (req, res) => {
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
      await fs.unlink(path.join(__dirname, '..', document.path));
    } catch (err) {
      console.error('Erreur lors de la suppression du fichier:', err);
    }

    // Supprimer l'entrée en base de données
    await document.remove();
    
    res.json({
      success: true,
      data: {}
    });
  } catch (error) {
    console.error('Erreur lors de la suppression du document:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la suppression du document'
    });
  }
};
