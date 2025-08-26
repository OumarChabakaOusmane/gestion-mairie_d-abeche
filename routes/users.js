const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');

// Route pour obtenir les informations de l'utilisateur connecté
router.get('/me', async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    
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

// Route pour mettre à jour le profil de l'utilisateur connecté
router.put('/me', async (req, res) => {
  try {
    const { name, email } = req.body;
    
    // Vérifier si l'email est déjà utilisé par un autre utilisateur
    if (email !== req.user.email) {
      const existingUser = await User.findOne({ email, _id: { $ne: req.user.id } });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          error: 'Cet email est déjà utilisé'
        });
      }
    }
    
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { name, email },
      { new: true, runValidators: true }
    ).select('-password');
    
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

// Route pour changer le mot de passe
router.put('/me/password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    // Récupérer l'utilisateur avec le mot de passe
    const user = await User.findById(req.user.id).select('+password');
    
    // Vérifier le mot de passe actuel
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        error: 'Mot de passe actuel incorrect'
      });
    }
    
    // Mettre à jour le mot de passe
    user.password = newPassword;
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

// Route pour mettre à jour les paramètres utilisateur
router.put('/me/settings', async (req, res) => {
  try {
    const { settings } = req.body;
    
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { settings } },
      { new: true, runValidators: true }
    ).select('-password');
    
    res.json({
      success: true,
      message: 'Paramètres mis à jour avec succès',
      data: user
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

// Créer un nouvel utilisateur
router.post('/', async (req, res) => {
  try {
    const { name, email, role, password } = req.body;
    
    // Vérifier si l'email existe déjà
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'Cet email est déjà utilisé'
      });
    }
    
    // Hasher le mot de passe
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const user = new User({
      name,
      email,
      role,
      password: hashedPassword
    });
    
    await user.save();
    
    res.status(201).json({
      success: true,
      message: 'Utilisateur créé avec succès',
      data: { _id: user._id, name, email, role }
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

// Lister tous les utilisateurs
router.get('/', async (req, res) => {
  try {
    const users = await User.find({}, { password: 0 }).sort({ createdAt: -1 });
    res.json({
      success: true,
      data: users
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// Obtenir un utilisateur spécifique
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id, { password: 0 });
    
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

// Mettre à jour un utilisateur
router.put('/:id', async (req, res) => {
  try {
    const { name, email, role, password } = req.body;
    
    const updateData = { name, email, role };
    
    // Si un nouveau mot de passe est fourni
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }
    
    const user = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, select: '-password' }
    );
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Utilisateur non trouvé'
      });
    }
    
    res.json({
      success: true,
      message: 'Utilisateur mis à jour avec succès',
      data: user
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

// Supprimer un utilisateur
router.delete('/:id', async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Utilisateur non trouvé'
      });
    }
    
    res.json({
      success: true,
      message: 'Utilisateur supprimé avec succès'
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

module.exports = router;