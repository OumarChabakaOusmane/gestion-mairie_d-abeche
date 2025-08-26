const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Acte = require('../models/Acte');
const { check, validationResult } = require('express-validator');

// Validation des actes
const validateActe = (type, details) => {
  const errors = [];
  const requiredFields = {
    naissance: ['nom', 'prenom', 'sexe', 'dateNaissance', 'lieuNaissance', 'pere', 'mere'],
    mariage: ['conjoint1', 'conjoint2', 'dateMariage', 'lieuMariage'],
    deces: ['nom', 'prenom', 'dateDeces', 'lieuDeces']
  };

  if (!requiredFields[type]) {
    throw new Error('Type d\'acte non valide');
  }

  requiredFields[type].forEach(field => {
    if (!details[field]) {
      errors.push(`Le champ ${field} est obligatoire`);
    }
  });

  if (errors.length > 0) {
    throw new Error(errors.join(', '));
  }
};

// Middleware de validation
const validateActeInput = [
  check('type').isIn(['naissance', 'mariage', 'deces']),
  check('details').isObject(),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        errors: errors.array() 
      });
    }
    next();
  }
];

// Créer un acte
router.post('/', validateActeInput, async (req, res) => {
  try {
    const { type, details, mairie } = req.body;
    validateActe(type, details);
    
    const acte = new Acte({ 
      type, 
      details,
      mairie,
      createdBy: req.user._id,
      lastModifiedBy: req.user._id
    });
    
    await acte.save();
    
    res.status(201).json({ 
      success: true,
      message: 'Acte enregistré avec succès',
      data: acte
    });
  } catch (err) {
    res.status(400).json({ 
      success: false,
      error: err.message 
    });
  }
});

// Lister les actes avec pagination
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [actes, total] = await Promise.all([
      Acte.find()
        .sort({ dateEnregistrement: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Acte.countDocuments()
    ]);

    res.json({
      success: true,
      data: actes,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      error: 'Erreur serveur' 
    });
  }
});

// Obtenir un acte spécifique
router.get('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        error: 'ID invalide'
      });
    }

    const acte = await Acte.findById(req.params.id);
    if (!acte) {
      return res.status(404).json({
        success: false,
        error: 'Acte non trouvé'
      });
    }

    res.json({
      success: true,
      data: acte
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
});

// Mettre à jour un acte
router.put('/:id', validateActeInput, async (req, res) => {
  try {
    const { type, details, mairie } = req.body;
    validateActe(type, details);

    const acte = await Acte.findByIdAndUpdate(
      req.params.id,
      { 
        type, 
        details, 
        mairie,
        lastModifiedBy: req.user._id,
        lastModifiedAt: new Date()
      },
      { new: true, runValidators: true }
    );

    if (!acte) {
      return res.status(404).json({
        success: false,
        error: 'Acte non trouvé'
      });
    }

    res.json({
      success: true,
      message: 'Acte mis à jour',
      data: acte
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

// Supprimer un acte
router.delete('/:id', async (req, res) => {
  try {
    const acte = await Acte.findByIdAndDelete(req.params.id);
    
    if (!acte) {
      return res.status(404).json({
        success: false,
        error: 'Acte non trouvé'
      });
    }
    
    res.json({
      success: true,
      message: 'Acte supprimé'
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
});

module.exports = router;