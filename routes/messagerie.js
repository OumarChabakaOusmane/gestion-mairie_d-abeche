const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');

// Créer une nouvelle conversation (avec pièces jointes optionnelles)
router.post('/', async (req, res) => {
  try {
    console.log('Nouvelle requête de conversation reçue:', req.body);
    console.log('req.user:', req.user);
    console.log('req.user type:', typeof req.user);
    
    // Vérifier que req.user existe
    if (!req.user) {
      console.error('req.user est undefined - le middleware d\'authentification n\'a pas été appliqué');
      return res.status(401).json({
        success: false,
        error: 'Authentification requise'
      });
    }
    
    const { recipient, participantId, subject, content, initialMessage, attachments } = req.body;
    
    // Convertir l'ID de l'expéditeur en ObjectId
    // Le middleware d'authentification utilise req.user.id (string)
    const senderId = req.user.id || req.user._id;
    console.log('senderId extrait:', senderId, 'Type:', typeof senderId);
    
    if (!senderId) {
      console.error('senderId est undefined. req.user:', JSON.stringify(req.user, null, 2));
      return res.status(400).json({
        success: false,
        error: 'ID de l\'expéditeur manquant'
      });
    }
    
    let sender;
    if (senderId instanceof mongoose.Types.ObjectId) {
      sender = senderId;
    } else if (mongoose.Types.ObjectId.isValid(senderId)) {
      sender = new mongoose.Types.ObjectId(senderId);
    } else {
      console.error('ID de l\'expéditeur invalide:', senderId, 'Type:', typeof senderId);
      return res.status(400).json({
        success: false,
        error: 'ID de l\'expéditeur invalide'
      });
    }
    
    console.log('Expéditeur ID:', sender.toString());
    
    // Accepter soit 'recipient' soit 'participantId'
    const recipientIdRaw = recipient || participantId;
    const messageContent = content || initialMessage;
    
    if (!recipientIdRaw) {
      return res.status(400).json({
        success: false,
        error: 'Destinataire manquant'
      });
    }
    
    // Convertir l'ID du destinataire en ObjectId
    if (!mongoose.Types.ObjectId.isValid(recipientIdRaw)) {
      console.error('ID du destinataire invalide:', recipientIdRaw);
      return res.status(400).json({
        success: false,
        error: 'ID du destinataire invalide'
      });
    }
    const recipientId = new mongoose.Types.ObjectId(recipientIdRaw);
    console.log('Destinataire ID:', recipientId.toString());
    
    // Vérifier que l'expéditeur et le destinataire sont différents
    if (sender.toString() === recipientId.toString()) {
      return res.status(400).json({
        success: false,
        error: 'Vous ne pouvez pas créer une conversation avec vous-même'
      });
    }
    
    if (!messageContent || !messageContent.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Le contenu du message est requis'
      });
    }
    
    // Vérifier si une conversation existe déjà
    // Rechercher une conversation avec exactement ces deux participants (non-groupe)
    let conversation = await Conversation.findOne({
      participants: { $all: [sender, recipientId] },
      isGroup: false
    });
    
    // Vérifier que la conversation a exactement 2 participants
    if (conversation && conversation.participants.length !== 2) {
      conversation = null;
    }
    
    console.log('Conversation existante trouvée:', conversation ? 'Oui' : 'Non');
    
    // Si non, en créer une nouvelle
    if (!conversation) {
      console.log('Création d\'une nouvelle conversation');
      try {
        // S'assurer que les participants sont des ObjectId valides
        const participantsArray = [sender, recipientId];
        console.log('Création de conversation avec participants:', participantsArray.map(p => p.toString()));
        
        conversation = new Conversation({
          participants: participantsArray,
          subject: subject || 'Nouvelle conversation',
          isGroup: false
        });
        
        // Valider avant de sauvegarder
        const validationError = conversation.validateSync();
        if (validationError) {
          console.error('Erreur de validation:', validationError);
          throw validationError;
        }
        
        await conversation.save();
        console.log('Nouvelle conversation créée:', conversation._id);
      } catch (saveError) {
        // Si erreur de duplication (index unique), récupérer la conversation existante
        if (saveError.code === 11000 || saveError.message.includes('duplicate key')) {
          console.log('Conversation déjà existante (erreur de duplication), récupération...');
          conversation = await Conversation.findOne({
            participants: { $all: [sender, recipientId] },
            isGroup: false
          });
          // Vérifier que la conversation a exactement 2 participants
          if (conversation && conversation.participants.length !== 2) {
            conversation = null;
          }
          if (!conversation) {
            throw new Error('Impossible de créer ou récupérer la conversation');
          }
        } else {
          throw saveError;
        }
      }
    }
    
    // Créer le message
    console.log('Création du message pour la conversation:', conversation._id);
    const message = new Message({
      conversation: conversation._id,
      sender,
      content: messageContent.trim(),
      attachments: Array.isArray(attachments) ? attachments : []
    });
    
    console.log('Sauvegarde du message...');
    await message.save();
    console.log('Message sauvegardé avec succès:', message._id);
    
    // Mettre à jour la conversation avec le dernier message
    console.log('Mise à jour de la conversation avec le dernier message...');
    conversation.lastMessage = message._id;
    conversation.updatedAt = new Date();
    await conversation.save();
    
    // Peupler les données pour la réponse
    const populatedConversation = await Conversation
      .findById(conversation._id)
      .populate('participants', 'name email')
      .populate('lastMessage');
    
    // Peupler le message avec les données de l'expéditeur
    await message.populate('sender', 'name email');
    
    console.log('Opération terminée avec succès');
    
    // Émettre un événement en temps réel
    if (req.io) {
      const roomName = `conversation_${conversation._id}`;
      req.io.to(roomName).emit('newMessage', {
        ...message.toObject(),
        conversationId: conversation._id,
        conversation: populatedConversation
      });
      
      // Notifier les autres participants
      for (const participant of populatedConversation.participants) {
        const participantId = participant._id.toString();
        if (participantId !== sender.toString()) {
          const userRoom = `user_${participantId}`;
          req.io.to(userRoom).emit('newMessageNotification', {
            conversationId: conversation._id,
            message: message,
            conversation: populatedConversation
          });
        }
      }
    }
    
    res.json({
      success: true,
      message: 'Conversation créée et message envoyé avec succès',
      data: {
        _id: populatedConversation._id,
        conversation: populatedConversation,
        message: message
      }
    });
  } catch (err) {
    console.error('Erreur lors de la création de la conversation:', err);
    
    res.status(400).json({
      success: false,
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// Lister les conversations de l'utilisateur
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    
    const conversations = await Conversation.find({
      participants: userId
    })
    .populate('participants', 'name')
    .populate({ path: 'lastMessage', populate: { path: 'attachments', select: 'title type originalName' } })
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
    const currentUserId = req.user.id || req.user._id;
    if (!conversation.participants.some(p => p._id && p._id.toString() === currentUserId.toString())) {
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
      .populate('attachments', 'title type originalName')
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
    const { content, attachments } = req.body;
    
    if (!content || !content.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Le contenu du message est requis'
      });
    }
    
    // Vérifier que la conversation existe et que l'utilisateur y participe
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation non trouvée'
      });
    }
    
    const currentUserId = req.user.id || req.user._id;
    if (!conversation.participants.some(p => p.toString() === currentUserId.toString())) {
      return res.status(403).json({
        success: false,
        error: 'Accès non autorisé à cette conversation'
      });
    }
    
    const message = new Message({
      conversation: req.params.id,
      sender: req.user.id || req.user._id,
      content: content.trim(),
      attachments: Array.isArray(attachments) ? attachments : []
    });
    
    await message.save();
    
    // Peupler le message avec les données de l'expéditeur
    await message.populate('sender', 'name email');
    
    // Mettre à jour la conversation avec le dernier message
    conversation.lastMessage = message._id;
    conversation.updatedAt = new Date();
    await conversation.save();
    
    // Émettre un événement Socket.IO si disponible
    if (req.io) {
      const roomName = `conversation_${req.params.id}`;
      req.io.to(roomName).emit('newMessage', {
        ...message.toObject(),
        conversationId: req.params.id,
        conversation: conversation
      });
      
      // Notifier les autres participants
      for (const participant of conversation.participants) {
        const participantId = participant.toString();
        const currentUserId = req.user.id || req.user._id;
        if (participantId !== currentUserId.toString()) {
          const userRoom = `user_${participantId}`;
          req.io.to(userRoom).emit('newMessageNotification', {
            conversationId: req.params.id,
            message: message,
            conversation: conversation
          });
        }
      }
    }
    
    res.json({
      success: true,
      message: 'Message envoyé avec succès',
      data: message
    });
  } catch (err) {
    console.error('Erreur lors de l\'envoi du message:', err);
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

// Marquer un message comme lu
router.post('/messages/:messageId/read', async (req, res) => {
  try {
    const message = await Message.findById(req.params.messageId);
    if (!message) {
      return res.status(404).json({ success: false, error: 'Message non trouvé' });
    }
    // Vérifier que l'utilisateur appartient à la conversation
    const conversation = await Conversation.findById(message.conversation);
    const currentUserId = req.user.id || req.user._id;
    if (!conversation || !conversation.participants.some(p => p.toString() === currentUserId.toString())) {
      return res.status(403).json({ success: false, error: 'Accès non autorisé' });
    }
    await message.markAsRead();
    res.json({ success: true, data: { id: message._id, read: message.read, readAt: message.readAt } });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Marquer tous les messages d'une conversation comme lus
router.post('/:id/read-all', async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation non trouvée' });
    }
    const currentUserId = req.user.id || req.user._id;
    if (!conversation.participants.some(p => p.toString() === currentUserId.toString())) {
      return res.status(403).json({ success: false, error: 'Accès non autorisé' });
    }
    await Message.updateMany({ conversation: conversation._id, read: false }, { $set: { read: true, readAt: new Date() } });
    res.json({ success: true, message: 'Messages marqués comme lus' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Modifier un message
router.put('/messages/:messageId', async (req, res) => {
  try {
    const { content } = req.body;
    const currentUserId = req.user.id || req.user._id;
    
    if (!content || !content.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Le contenu du message est requis'
      });
    }
    
    const message = await Message.findById(req.params.messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        error: 'Message non trouvé'
      });
    }
    
    // Vérifier que l'utilisateur est l'expéditeur du message
    if (message.sender.toString() !== currentUserId.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Vous ne pouvez modifier que vos propres messages'
      });
    }
    
    // Vérifier que l'utilisateur appartient à la conversation
    const conversation = await Conversation.findById(message.conversation);
    if (!conversation || !conversation.participants.some(p => p.toString() === currentUserId.toString())) {
      return res.status(403).json({
        success: false,
        error: 'Accès non autorisé'
      });
    }
    
    // Mettre à jour le message
    message.content = content.trim();
    message.updatedAt = new Date();
    await message.save();
    
    // Peupler le message avec les données de l'expéditeur
    await message.populate('sender', 'name email');
    
    // Émettre un événement Socket.IO si disponible
    if (req.io) {
      const roomName = `conversation_${message.conversation}`;
      req.io.to(roomName).emit('messageUpdated', {
        ...message.toObject(),
        conversationId: message.conversation
      });
    }
    
    res.json({
      success: true,
      message: 'Message modifié avec succès',
      data: message
    });
  } catch (err) {
    console.error('Erreur lors de la modification du message:', err);
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

// Supprimer un message
router.delete('/messages/:messageId', async (req, res) => {
  try {
    const currentUserId = req.user.id || req.user._id;
    
    const message = await Message.findById(req.params.messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        error: 'Message non trouvé'
      });
    }
    
    // Vérifier que l'utilisateur est l'expéditeur du message
    if (message.sender.toString() !== currentUserId.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Vous ne pouvez supprimer que vos propres messages'
      });
    }
    
    // Vérifier que l'utilisateur appartient à la conversation
    const conversation = await Conversation.findById(message.conversation);
    if (!conversation || !conversation.participants.some(p => p.toString() === currentUserId.toString())) {
      return res.status(403).json({
        success: false,
        error: 'Accès non autorisé'
      });
    }
    
    const conversationId = message.conversation;
    const messageId = message._id;
    
    // Supprimer le message
    await Message.findByIdAndDelete(req.params.messageId);
    
    // Si c'était le dernier message, mettre à jour la conversation
    if (conversation.lastMessage && conversation.lastMessage.toString() === messageId.toString()) {
      const lastMessage = await Message.findOne({ conversation: conversationId })
        .sort({ createdAt: -1 });
      conversation.lastMessage = lastMessage ? lastMessage._id : null;
      conversation.updatedAt = new Date();
      await conversation.save();
    }
    
    // Émettre un événement Socket.IO si disponible
    if (req.io) {
      const roomName = `conversation_${conversationId}`;
      req.io.to(roomName).emit('messageDeleted', {
        messageId: messageId,
        conversationId: conversationId
      });
    }
    
    res.json({
      success: true,
      message: 'Message supprimé avec succès'
    });
  } catch (err) {
    console.error('Erreur lors de la suppression du message:', err);
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

module.exports = router;