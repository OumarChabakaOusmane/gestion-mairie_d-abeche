const User = require('../models/User');
const path = require('path');
const fs = require('fs');
const logger = require('../config/logger');

// Dossier de stockage des avatars
const UPLOAD_DIR = path.join(__dirname, '../public/uploads/avatars');

// Créer le dossier s'il n'existe pas
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

/**
 * Met à jour l'avatar de l'utilisateur
 * @param {Object} req - La requête HTTP
 * @param {Object} res - La réponse HTTP
 * @returns {Promise<void>}
 */
exports.uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Aucun fichier téléchargé'
      });
    }

    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    // Supprimer l'ancien avatar s'il existe
    if (user.avatar) {
      const oldAvatarPath = path.join(UPLOAD_DIR, path.basename(user.avatar));
      if (fs.existsSync(oldAvatarPath)) {
        fs.unlinkSync(oldAvatarPath);
      }
    }

    // Mettre à jour le chemin de l'avatar dans la base de données
    const avatarPath = `/uploads/avatars/${req.file.filename}`;
    user.avatar = avatarPath;
    await user.save();

    logger.info(`Avatar mis à jour pour l'utilisateur ${userId}`, {
      userId,
      avatarPath,
      requestId: req.id
    });

    res.json({
      success: true,
      message: 'Avatar mis à jour avec succès',
      data: {
        avatar: avatarPath
      }
    });

  } catch (error) {
    logger.error('Erreur lors de la mise à jour de l\'avatar', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id,
      requestId: req.id
    });

    res.status(500).json({
      success: false,
      message: 'Une erreur est survenue lors de la mise à jour de l\'avatar',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Supprime l'avatar de l'utilisateur
 * @param {Object} req - La requête HTTP
 * @param {Object} res - La réponse HTTP
 * @returns {Promise<void>}
 */
exports.deleteAvatar = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    // Vérifier si l'utilisateur a un avatar
    if (!user.avatar) {
      return res.status(400).json({
        success: false,
        message: 'Aucun avatar à supprimer'
      });
    }

    // Supprimer le fichier d'avatar
    const avatarPath = path.join(__dirname, '../public', user.avatar);
    if (fs.existsSync(avatarPath)) {
      fs.unlinkSync(avatarPath);
    }

    // Mettre à jour l'utilisateur
    user.avatar = '';
    await user.save();

    logger.info(`Avatar supprimé pour l'utilisateur ${userId}`, {
      userId,
      requestId: req.id
    });

    res.json({
      success: true,
      message: 'Avatar supprimé avec succès'
    });

  } catch (error) {
    logger.error('Erreur lors de la suppression de l\'avatar', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id,
      requestId: req.id
    });

    res.status(500).json({
      success: false,
      message: 'Une erreur est survenue lors de la suppression de l\'avatar',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
