const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');

// Obtenir les informations de l'utilisateur connecté
router.get('/me', async (req, res) => {
  try {
    const user = await User.findById(req.user._id, { password: 0 });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Utilisateur non trouvé'
      });
    }
    
    res.json({
      success: true,
      data: user
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// Mettre à jour le profil de l'utilisateur connecté
router.put('/me', async (req, res) => {
  try {
    const { name, email } = req.body;
    
    // Vérifier si l'email existe déjà pour un autre utilisateur
    const existingUser = await User.findOne({ email, _id: { $ne: req.user._id } });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'Cet email est déjà utilisé'
      });
    }
    
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name, email },
      { new: true, select: '-password' }
    );
    
    res.json({
      success: true,
      message: 'Profil mis à jour avec succès',
      data: user
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

// Changer le mot de passe de l'utilisateur connecté
router.put('/me/password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    // Récupérer l'utilisateur avec le mot de passe
    const user = await User.findById(req.user._id).select('+password');
    
    // Vérifier le mot de passe actuel
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        error: 'Mot de passe actuel incorrect'
      });
    }
    
    // Hasher le nouveau mot de passe
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    
    res.json({
      success: true,
      message: 'Mot de passe changé avec succès'
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

// Mettre à jour les paramètres de l'utilisateur connecté
router.put('/me/settings', async (req, res) => {
  try {
    const { settings } = req.body;
    
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: { settings } },
      { new: true, select: '-password' }
    );
    
    res.json({
      success: true,
      message: 'Paramètres mis à jour avec succès',
      data: user.settings
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

module.exports = router;