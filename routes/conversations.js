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

// Récupérer les conversations
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

module.exports = router;