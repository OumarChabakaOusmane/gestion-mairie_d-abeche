const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const { authenticate } = require('../middleware/auth');
const userController = require('../controllers/userController');
const { upload, handleUploadErrors } = require('../middleware/upload');

// Appliquer le middleware d'authentification à toutes les routes
router.use(authenticate);

// Importer le service des utilisateurs connectés
const connectedUsers = require('../services/connectedUsers');

// Route pour obtenir la liste des utilisateurs connectés
router.get('/connected', async (req, res) => {
  try {
    // Vérifier si l'utilisateur est admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Accès non autorisé. Seul un administrateur peut accéder à cette ressource.'
      });
    }

    // Nettoyer les utilisateurs inactifs avant de renvoyer la liste
    connectedUsers.cleanupInactiveUsers(30); // 30 minutes d'inactivité
    
    // Récupérer la liste des utilisateurs connectés
    const connectedUsersList = connectedUsers.getAllConnectedUsers();
    
    res.json({
      success: true,
      data: connectedUsersList
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des utilisateurs connectés:', error);
    res.status(500).json({
      success: false,
      error: 'Une erreur est survenue lors de la récupération des utilisateurs connectés.'
    });
  }
});

// Route pour obtenir tous les utilisateurs (admin seulement)
router.get('/', authenticate, async (req, res) => {
  try {
    console.log('=== DÉBUT ROUTE /api/users ===');
    console.log('Utilisateur:', {
      id: req.user._id,
      email: req.user.email,
      role: req.user.role
    });

    // Vérifier si l'utilisateur est admin
    if (req.user.role !== 'admin') {
      console.log('Accès refusé: utilisateur non admin');
      return res.status(403).json({
        success: false,
        error: 'Accès non autorisé. Seul un administrateur peut accéder à cette ressource.'
      });
    }

    // Récupérer les paramètres de pagination et de filtrage
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100; // Augmenté à 100 pour le débogage
    const skip = (page - 1) * limit;
    
    // Construire la requête de filtrage
    const filter = {};
    if (req.query.role) {
      filter.role = req.query.role;
    }
    if (req.query.search) {
      filter.$or = [
        { name: { $regex: req.query.search, $options: 'i' } },
        { email: { $regex: req.query.search, $options: 'i' } }
      ];
    }
    
    console.log('Filtres de recherche:', filter);

    // Récupérer les utilisateurs avec pagination
    console.log('Récupération des utilisateurs...');
    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean() // Convertir en objet JavaScript simple
        .exec(),
      User.countDocuments(filter).exec()
    ]);
    
    console.log(`Nombre d'utilisateurs trouvés: ${users.length}`);
    
    if (users.length > 0) {
      console.log('Premier utilisateur trouvé:', {
        _id: users[0]._id,
        name: users[0].name,
        email: users[0].email,
        role: users[0].role
      });
    } else {
      console.log('Aucun utilisateur trouvé dans la base de données');
    }
    
    // Formater les données de date pour l'affichage
    const usersWithFormattedDates = users.map(user => {
      const formattedUser = {
        ...user,
        createdAt: user.createdAt ? user.createdAt.toISOString() : null,
        updatedAt: user.updatedAt ? user.updatedAt.toISOString() : null
      };
      return formattedUser;
    });
    
    console.log('Utilisateurs formatés:', usersWithFormattedDates.length);

    const response = {
      success: true,
      data: usersWithFormattedDates,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit
      }
    };
    
    console.log('Réponse envoyée avec succès');
    console.log('=== FIN ROUTE /api/users ===');
    res.json(response);
  } catch (err) {
    console.error('Erreur lors de la récupération des utilisateurs:', err);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur lors de la récupération des utilisateurs',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Route pour obtenir les informations de l'utilisateur connecté
router.get('/me', async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        error: 'Non authentifié'
      });
    }
    
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
    console.error('Erreur dans /me:', err);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
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
    console.error('Erreur dans /me:', err);
    res.status(400).json({
      success: false,
      error: 'Erreur serveur',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
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
    console.error('Erreur dans /me/password:', err);
    res.status(400).json({
      success: false,
      error: 'Erreur serveur',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Route pour obtenir les paramètres utilisateur
router.get('/me/settings', async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('settings');
    
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
  } catch (err) {
    console.error('Erreur dans GET /me/settings:', err);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
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
      data: user.settings
    });
  } catch (err) {
    console.error('Erreur dans PUT /me/settings:', err);
    res.status(400).json({
      success: false,
      error: 'Erreur serveur',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Créer un nouvel utilisateur (admin seulement)
router.post('/', async (req, res) => {
  try {
    // Vérifier si l'utilisateur est admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Accès non autorisé. Seul un administrateur peut créer un utilisateur.'
      });
    }
    
    const { name, email, role, password } = req.body;
    
    // Validation des champs requis
    if (!name || !email || !role || !password) {
      return res.status(400).json({
        success: false,
        error: 'Tous les champs sont requis'
      });
    }
    
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
    console.error('Erreur dans POST /:', err);
    res.status(400).json({
      success: false,
      error: 'Erreur serveur',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Cette route est un doublon - la route GET '/' est déjà définie plus haut (ligne 48)
// Supprimée pour éviter les conflits

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
    console.error('Erreur dans /:id:', err);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Mettre à jour un utilisateur (admin seulement)
router.put('/:id', async (req, res) => {
  try {
    // Vérifier si l'utilisateur est admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Accès non autorisé. Seul un administrateur peut modifier un utilisateur.'
      });
    }
    
    const { name, email, role, password } = req.body;
    
    const updateData = { name, email, role };
    
    // Si un nouveau mot de passe est fourni
    if (password && password.trim()) {
      updateData.password = await bcrypt.hash(password, 10);
    }
    
    // Vérifier si l'email est déjà utilisé par un autre utilisateur
    if (email) {
      const existingUser = await User.findOne({ email, _id: { $ne: req.params.id } });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          error: 'Cet email est déjà utilisé par un autre utilisateur'
        });
      }
    }
    
    const user = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true, select: '-password' }
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
    console.error('Erreur dans PUT /:id:', err);
    res.status(400).json({
      success: false,
      error: 'Erreur serveur',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Supprimer un utilisateur (admin seulement)
router.delete('/:id', async (req, res) => {
  try {
    console.log(`Tentative de suppression de l'utilisateur avec l'ID: ${req.params.id}`);
    
    // Vérifier si l'utilisateur est admin
    if (req.user.role !== 'admin') {
      console.log('Accès refusé: utilisateur non admin');
      return res.status(403).json({
        success: false,
        error: 'Accès non autorisé. Seul un administrateur peut supprimer un utilisateur.'
      });
    }

    // Vérifier que l'ID est valide
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      console.log('ID utilisateur invalide:', req.params.id);
      return res.status(400).json({
        success: false,
        error: 'ID utilisateur invalide'
      });
    }

    // Vérifier que l'utilisateur existe
    const userToDelete = await User.findById(req.params.id);
    if (!userToDelete) {
      console.log('Utilisateur non trouvé avec l\'ID:', req.params.id);
      return res.status(404).json({
        success: false,
        error: 'Utilisateur non trouvé'
      });
    }
    
    // Empêcher un admin de se supprimer lui-même
    const userIdToCompare = req.user._id ? req.user._id.toString() : req.user.id;
    if (req.params.id === req.user.id || req.params.id === userIdToCompare) {
      console.log('Tentative de suppression de son propre compte');
      return res.status(400).json({
        success: false,
        error: 'Vous ne pouvez pas supprimer votre propre compte'
      });
    }

    console.log('Suppression de l\'utilisateur:', {
      id: userToDelete._id,
      email: userToDelete.email,
      role: userToDelete.role
    });

    // Supprimer l'utilisateur
    const result = await User.deleteOne({ _id: req.params.id });

    if (result.deletedCount === 0) {
      console.error('Échec de la suppression: aucun document supprimé');
      return res.status(404).json({
        success: false,
        error: 'Échec de la suppression de l\'utilisateur'
      });
    }
    
    console.log('Utilisateur supprimé avec succès');
    res.json({
      success: true,
      message: 'Utilisateur supprimé avec succès'
    });
  } catch (err) {
    console.error('Erreur lors de la suppression de l\'utilisateur:', {
      error: err,
      message: err.message,
      stack: err.stack,
      params: req.params,
      user: req.user ? { id: req.user.id, role: req.user.role } : 'Non authentifié'
    });
    
    // Gestion spécifique des erreurs de base de données
    if (err.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Format d\'ID invalide',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }

    // Gestion des erreurs de validation
    if (err.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: 'Erreur de validation',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }

    // Erreur serveur générique
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la suppression de l\'utilisateur',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Routes pour la gestion des avatars
/**
 * @swagger
 * /api/users/me/avatar:
 *   post:
 *     summary: Télécharge un nouvel avatar pour l'utilisateur connecté
 *     tags: [Utilisateurs]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               avatar:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Avatar mis à jour avec succès
 *       400:
 *         description: Erreur de validation ou fichier invalide
 *       401:
 *         description: Non authentifié
 *       500:
 *         description: Erreur serveur
 */
router.post('/me/avatar', 
  upload.single('avatar'), 
  handleUploadErrors, 
  userController.uploadAvatar
);

/**
 * @swagger
 * /api/users/me/avatar:
 *   delete:
 *     summary: Supprime l'avatar de l'utilisateur connecté
 *     tags: [Utilisateurs]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Avatar supprimé avec succès
 *       400:
 *         description: Aucun avatar à supprimer
 *       401:
 *         description: Non authentifié
 *       404:
 *         description: Utilisateur non trouvé
 *       500:
 *         description: Erreur serveur
 */
router.delete('/me/avatar', userController.deleteAvatar);

module.exports = router;