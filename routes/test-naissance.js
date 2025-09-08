const express = require('express');
const router = express.Router();
const naissanceController = require('../controllers/naissanceController');

// Test route to verify the controller is working
router.get('/test', (req, res) => {
  console.log('Test route hit');
  if (typeof naissanceController.generateNaissancePdf === 'function') {
    res.json({ status: 'success', message: 'Controller function exists' });
  } else {
    res.status(500).json({ status: 'error', message: 'Controller function not found' });
  }
});

module.exports = router;
