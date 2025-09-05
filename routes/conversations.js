const express = require('express');
const router = express.Router();

console.log('Chargement du routeur des conversations...');

// Route de test simple
router.get('/', (req, res) => {
  console.log('Requête reçue sur /api/conversations');
  res.json({
    success: true,
    message: 'API des conversations fonctionnelle',
    data: []
  });
});

console.log('Route /api/conversations configurée avec succès');

module.exports = router;