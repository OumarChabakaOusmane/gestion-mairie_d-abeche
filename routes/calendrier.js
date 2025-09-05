// routes/calendrier.js
const express = require('express');
const router = express.Router();
const logger = require('../config/logger');

// Route de test minimale
router.get('/', async (req, res, next) => {  
  try {
    logger.info('Test de la route /api/calendrier');
    
    // Réponse de test simple
    res.json({
      success: true,
      data: [
        {
          id: 'test-1',
          title: 'Test Événement',
          start: new Date().toISOString(),
          color: '#3498db',
          extendedProps: {
            type: 'test',
            numeroActe: 'TEST-001',
            details: { test: true }
          }
        }
      ]
    });
    
  } catch (error) {
    logger.error('Erreur dans la route de test:', {
      message: error.message,
      stack: error.stack
    });
    
    // Utilisation de next pour passer à la gestion d'erreur
    next(error);
  }
});

module.exports = router;