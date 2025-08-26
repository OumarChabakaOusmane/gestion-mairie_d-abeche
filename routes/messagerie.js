const express = require('express');
const router = express.Router();
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');

// Créer une nouvelle conversation
router.post('/', async (req, res) => {
  try {
    const { recipient, subject, content } = req.body;
    const sender = req.user._id; // L'utilisateur connecté
    
    // Vérifier si une conversation existe déjà
    let conversation = await Conversation.findOne({
      participants: { $all: [sender, recipient] }
    });
    
    // Si non, en créer une nouvelle
    if (!conversation) {
      conversation = new Conversation({
        participants: [sender, recipient],
        subject
      });
      await conversation.save();
    }
    
    // Créer le message
    const message = new Message({
      conversation: conversation._id,
      sender,
      content
    });
    await message.save();
    
    // Mettre à jour la conversation avec le dernier message
    conversation.lastMessage = message._id;
    conversation.updatedAt = new Date();
    await conversation.save();
    
    res.json({
      success: true,
      message: 'Message envoyé avec succès',
      data: conversation
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

// Lister les conversations de l'utilisateur
router.get('/', async (req, res) => {
  try {
    const userId = req.user._id;
    
    const conversations = await Conversation.find({
      participants: userId
    })
    .populate('participants', 'name')
    .populate('lastMessage')
    .sort({ updatedAt: -1 });
    
    res.json({
      success: true,
      data: conversations
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// Obtenir une conversation spécifique
router.get('/:id', async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id)
      .populate('participants', 'name');
    
    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation non trouvée'
      });
    }
    
    // Vérifier que l'utilisateur fait partie de la conversation
    if (!conversation.participants.some(p => p._id.equals(req.user._id))) {
      return res.status(403).json({
        success: false,
        error: 'Accès non autorisé'
      });
    }
    
    res.json({
      success: true,
      data: conversation
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// Supprimer une conversation
router.delete('/:id', async (req, res) => {
  try {
    const conversation = await Conversation.findByIdAndDelete(req.params.id);
    
    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation non trouvée'
      });
    }
    
    // Supprimer tous les messages associés
    await Message.deleteMany({ conversation: conversation._id });
    
    res.json({
      success: true,
      message: 'Conversation supprimée avec succès'
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// Lister les messages d'une conversation
router.get('/:id/messages', async (req, res) => {
  try {
    const messages = await Message.find({ conversation: req.params.id })
      .populate('sender', 'name')
      .sort({ createdAt: 1 });
    
    res.json({
      success: true,
      data: messages
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// Envoyer un message dans une conversation
router.post('/:id/messages', async (req, res) => {
  try {
    const { content } = req.body;
    
    const message = new Message({
      conversation: req.params.id,
      sender: req.user._id,
      content
    });
    await message.save();
    
    // Mettre à jour la conversation avec le dernier message
    await Conversation.findByIdAndUpdate(req.params.id, {
      lastMessage: message._id,
      updatedAt: new Date()
    });
    
    res.json({
      success: true,
      message: 'Message envoyé avec succès',
      data: message
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

module.exports = router;