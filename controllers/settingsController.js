const User = require('../models/User');
const bcrypt = require('bcryptjs');

// Obtenir les paramètres de l'utilisateur
exports.getUserSettings = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Utilisateur non trouvé'
      });
    }
    
    res.json({
      success: true,
      data: user.settings || {}
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des paramètres:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des paramètres'
    });
  }
};

// Mettre à jour les paramètres de l'utilisateur
exports.updateUserSettings = async (req, res) => {
  try {
    const { theme, notifications, language } = req.body;
    
    const updates = {};
    if (theme) updates['settings.theme'] = theme;
    if (notifications) updates['settings.notifications'] = notifications;
    if (language) updates['settings.language'] = language;
    
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Utilisateur non trouvé'
      });
    }
    
    res.json({
      success: true,
      data: user.settings || {}
    });
  } catch (error) {
    console.error('Erreur lors de la mise à jour des paramètres:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la mise à jour des paramètres'
    });
  }
};

// Changer le mot de passe
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Veuillez fournir l\'ancien et le nouveau mot de passe'
      });
    }
    
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Utilisateur non trouvé'
      });
    }
    
    // Vérifier l'ancien mot de passe
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        error: 'Mot de passe actuel incorrect'
      });
    }
    
    // Mettre à jour le mot de passe
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();
    
    res.json({
      success: true,
      message: 'Mot de passe mis à jour avec succès'
    });
  } catch (error) {
    console.error('Erreur lors du changement de mot de passe:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors du changement de mot de passe'
    });
  }
};

// Gestion des sauvegardes
exports.backupData = async (req, res) => {
  try {
    // Ici, vous pourriez ajouter la logique pour sauvegarder les données
    // Par exemple, exporter la base de données ou les fichiers importants
    
    res.json({
      success: true,
      message: 'Sauvegarde effectuée avec succès',
      // Ajoutez ici les détails de la sauvegarde
      data: {
        timestamp: new Date(),
        type: 'full',
        size: '0 MB' // À remplacer par la taille réelle
      }
    });
  } catch (error) {
    console.error('Erreur lors de la sauvegarde des données:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la sauvegarde des données'
    });
  }
};
