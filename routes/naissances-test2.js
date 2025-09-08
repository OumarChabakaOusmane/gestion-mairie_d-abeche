const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const { auth } = require('../middleware/auth');
const naissanceController = require('../controllers/naissanceController2');

// Test route
router.get('/test', naissanceController.testController);

// PDF generation route
router.get(
  '/:id/pdf',
  [
    auth,
    check('id', 'ID invalide').isMongoId()
  ],
  naissanceController.generateNaissancePdf
);

module.exports = router;
