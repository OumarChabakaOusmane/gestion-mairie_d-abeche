const express = require('express');
const router = express.Router();

// Simple test route
router.get('/test', (req, res) => {
  console.log('Test route called');
  res.json({ status: 'success', message: 'Test route is working' });
});

// Test controller function
router.get('/test-controller', (req, res) => {
  try {
    console.log('Attempting to require naissanceController...');
    const controller = require('../controllers/naissanceController');
    console.log('Controller loaded successfully:', Object.keys(controller));
    
    if (typeof controller.generateNaissancePdf === 'function') {
      res.json({ 
        status: 'success', 
        message: 'Controller and function found',
        functions: Object.keys(controller)
      });
    } else {
      res.status(500).json({ 
        status: 'error', 
        message: 'generateNaissancePdf function not found',
        availableFunctions: Object.keys(controller)
      });
    }
  } catch (error) {
    console.error('Error in test route:', error);
    res.status(500).json({ 
      status: 'error', 
      message: 'Failed to load controller',
      error: error.message,
      stack: error.stack
    });
  }
});

module.exports = router;
