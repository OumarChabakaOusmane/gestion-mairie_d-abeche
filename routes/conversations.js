const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const { authenticate: authMiddleware } = require('../middleware/auth');

const validateObjectId = (param) => (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params[param])) {
    return res.status(400).json({
      success: false,
      error: `ID ${param} invalide`,
      received: req.params[param]
    });
  }
  next();
};

// Créer une conversation
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { participants } = req.body;
    const currentUser = req.user._id;

    // Validation
    if (!Array.isArray(participants)) {
      return res.status(400).json({
        success: false,
        error: "Format des participants invalide"
      });
    }

    const allParticipants = [...new Set([...participants, currentUser])];
    const invalidIds = allParticipants.filter(id => !mongoose.Types.ObjectId.isValid(id));

    if (invalidIds.length > 0) {
      return res.status(400).json({
        success: false,
        error: "IDs invalides détectés",
        invalidIds
      });
    }

    // Vérifier l'existence
    const existingConv = await Conversation.findOne({
      participants: { $all: allParticipants, $size: allParticipants.length }
    });

    if (existingConv) {
      return res.json({
        success: true,
        data: existingConv,
        isExisting: true
      });
    }

    // Création
    const newConversation = await Conversation.create({ participants: allParticipants });

    res.status(201).json({
      success: true,
      data: newConversation
    });
  } catch (err) {
    console.error('[CONVERSATION] Erreur:', err);
    res.status(500).json({
      success: false,
      error: "Erreur serveur"
    });
  }
});

// Récupérer les conversations de l'utilisateur connecté
router.get('/user/:userId', 
  authMiddleware,
  validateObjectId('userId'),
  async (req, res) => {
    try {
      const conversations = await Conversation.find({
        participants: req.params.userId
      })
      .populate('participants', 'username avatar')
      .populate('lastMessage')
      .sort({ updatedAt: -1 });

      res.json({
        success: true,
        data: conversations
      });
    } catch (err) {
      console.error('[CONVERSATION] Erreur:', err);
      res.status(500).json({
        success: false,
        error: "Erreur serveur"
      });
    }
  }
);

// Récupérer toutes les conversations de l'utilisateur connecté (endpoint principal)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const currentUser = req.user._id;
    
    const conversations = await Conversation.find({
      participants: currentUser
    })
    .populate('participants', 'name email')
    .populate({
      path: 'lastMessage',
      select: 'content createdAt sender'
    })
    .sort({ updatedAt: -1 });

    // Ajouter des informations supplémentaires
    const conversationsWithDetails = conversations.map(conv => {
      const otherParticipant = conv.participants.find(p => p._id.toString() !== currentUser.toString());
      const lastMessage = conv.lastMessage;
      
      return {
        ...conv.toObject(),
        otherParticipant,
        lastMessage,
        unreadCount: 0 // À implémenter plus tard
      };
    });

    res.json({
      success: true,
      data: conversationsWithDetails
    });
  } catch (err) {
    console.error('[CONVERSATION] Erreur:', err);
    res.status(500).json({
      success: false,
      error: "Erreur serveur"
    });
  }
});

module.exports = router;