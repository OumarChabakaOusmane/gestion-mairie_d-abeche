const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const { authenticate: auth } = require('../middleware/auth');
const naissanceController = require('../controllers/naissanceController');

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

module.exports = router;
