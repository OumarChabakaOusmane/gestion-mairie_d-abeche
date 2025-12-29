const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  // Pour les conversations de groupe
  isGroup: {
    type: Boolean,
    default: false
  },
  groupName: {
    type: String,
    trim: true
  },
  groupAdmin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // Pour les conversations archivées
  archivedBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    archivedAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Validation au niveau du schéma pour s'assurer qu'il y a au moins 2 participants uniques
conversationSchema.pre('save', function(next) {
  // Vérifier que les participants existent et sont valides
  if (!this.participants || !Array.isArray(this.participants)) {
    return next(new Error('Les participants doivent être un tableau'));
  }
  
  if (this.participants.length < 2) {
    return next(new Error('Une conversation doit avoir au moins 2 participants'));
  }
  
  // Filtrer les participants null/undefined
  const validParticipants = this.participants.filter(p => p != null);
  if (validParticipants.length < 2) {
    return next(new Error('Une conversation doit avoir au moins 2 participants valides'));
  }
  
  // Vérifier que tous les participants sont uniques
  const participantStrings = validParticipants.map(p => {
    if (p instanceof mongoose.Types.ObjectId) {
      return p.toString();
    }
    if (typeof p === 'string' && mongoose.Types.ObjectId.isValid(p)) {
      return p;
    }
    return String(p);
  });
  
  const uniqueParticipants = new Set(participantStrings);
  if (uniqueParticipants.size !== validParticipants.length) {
    return next(new Error('Une conversation doit avoir des participants uniques'));
  }
  
  next();
});

// Empêche les doublons de conversations entre les mêmes participants
// Utiliser un index composé pour éviter les problèmes avec les transactions
// Note: L'index unique sur un tableau peut être problématique, donc on gère l'unicité dans le code
conversationSchema.index({ participants: 1, isGroup: 1 });

// Méthode pour ajouter un message à la conversation
conversationSchema.methods.addMessage = async function(messageId) {
  this.lastMessage = messageId;
  this.updatedAt = new Date();
  return this.save();
};

// Méthode pour ajouter un participant
conversationSchema.methods.addParticipant = async function(userId) {
  if (!this.participants.includes(userId)) {
    this.participants.push(userId);
    return this.save();
  }
  return this;
};

// Méthode pour archiver une conversation
conversationSchema.methods.toggleArchive = async function(userId, archive = true) {
  const archiveIndex = this.archivedBy.findIndex(a => a.user.toString() === userId.toString());
  
  if (archive && archiveIndex === -1) {
    this.archivedBy.push({ user: userId });
  } else if (!archive && archiveIndex !== -1) {
    this.archivedBy.splice(archiveIndex, 1);
  }
  
  return this.save();
};

const Conversation = mongoose.model('Conversation', conversationSchema);

module.exports = Conversation;