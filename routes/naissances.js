const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const { authenticate: auth } = require('../middleware/auth');
const naissanceController = require('../controllers/naissanceController');
const Acte = require('../models/Acte');

// @route   GET /api/naissances/:id/pdf
// @desc    Générer un PDF pour un acte de naissance
// @access  Privé
router.get('/:id/pdf', [
  auth,
  check('id', 'ID invalide').isMongoId()
], async (req, res, next) => {
  try {
    await naissanceController.generateNaissancePdf(req, res, next);
  } catch (error) {
    console.error('Error in naissance PDF route:', error);
    next(error);
  }
});

// Afficher le formulaire d'édition d'un acte de naissance
router.get('/edit/:id', auth, async (req, res) => {
  try {
    const acte = await Acte.findById(req.params.id).lean();
    
    if (!acte) {
      return res.status(404).send('Acte de naissance non trouvé');
    }

    // Rendre la vue d'édition avec les données de l'acte
    res.render('naissances/edit', { 
      title: 'Modifier un acte de naissance',
      acte: {
        ...acte,
        ...acte.details,
        id: acte._id
      }
    });
  } catch (error) {
    console.error('Erreur lors du chargement du formulaire d\'édition:', error);
    res.status(500).send('Erreur lors du chargement du formulaire d\'édition');
  }
});

module.exports = router;
