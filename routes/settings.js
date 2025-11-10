const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { authenticate } = require('../middleware/auth');

// Protection des routes par authentification
router.use(authenticate);

// Obtenir les paramètres de l'utilisateur
router.get('/', settingsController.getUserSettings);

// Mettre à jour les paramètres
router.put('/', settingsController.updateUserSettings);

// Changer le mot de passe
router.post('/change-password', settingsController.changePassword);

// Gestion des sauvegardes
router.post('/backup', settingsController.backupData);

module.exports = router;