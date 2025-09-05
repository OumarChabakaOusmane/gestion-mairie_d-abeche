const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    validate: [
      {
        validator: function(participants) {
          return participants.length >= 2 && new Set(participants).size === participants.length;
        },
        message: 'Une conversation doit avoir au moins 2 participants uniques'
      }
    ]
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

// Empêche les doublons de conversations entre les mêmes participants
conversationSchema.index({ participants: 1 }, { 
  unique: true,
  partialFilterExpression: { isGroup: false }
});

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