const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { authenticate, authorize } = require('../middleware/auth');
const demandeActeController = require('../controllers/demandeActeController');

// Configuration de Multer pour le stockage des pièces jointes
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/demandes');
    require('fs').mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Filtre pour les types de fichiers autorisés
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/msword', // .doc
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document' // .docx
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Type de fichier non autorisé. Seuls les fichiers PDF, JPG, PNG et DOC sont acceptés.'), false);
  }
};

// Configuration de Multer avec limites de taille et types de fichiers
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max par fichier
  }
});

// Middleware pour gérer les erreurs de Multer
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      success: false,
      message: `Erreur lors du téléchargement du fichier: ${err.message}`
    });
  } else if (err) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Erreur lors du traitement du fichier'
    });
  }
  next();
};

// Routes pour les citoyens (authentification requise)
router.post('/', 
  authenticate,
  upload.fields([
    { name: 'pieceIdentite', maxCount: 1 },
    { name: 'justificatifDomicile', maxCount: 1 },
    { name: 'documentsComplementaires', maxCount: 5 }
  ]),
  handleMulterError,
  demandeActeController.createDemande
);

router.get('/mes-demandes', 
  authenticate, 
  demandeActeController.getMesDemandes
);

router.get('/:id', 
  authenticate, 
  demandeActeController.getDemande
);

router.put('/:id/annuler', 
  authenticate, 
  demandeActeController.annulerDemande
);

router.get('/:demandeId/documents/:documentId', 
  authenticate, 
  demandeActeController.downloadDocument
);

// Routes pour l'administration (authentification et autorisation requises)
router.get('/admin/demandes', 
  authenticate, 
  authorize(['admin', 'agent']),
  demandeActeController.getAllDemandes
);

router.put('/admin/demandes/:id/statut', 
  authenticate, 
  authorize(['admin', 'agent']),
  demandeActeController.updateStatutDemande
);

router.post('/admin/demandes/:id/documents', 
  authenticate, 
  authorize(['admin', 'agent']),
  upload.single('document'),
  handleMulterError,
  demandeActeController.ajouterDocument
);

module.exports = router;
