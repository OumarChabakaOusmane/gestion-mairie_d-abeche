const mongoose = require('mongoose');

const ConversationSchema = new mongoose.Schema({
  participants: {
    type: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      validate: {
        validator: v => mongoose.Types.ObjectId.isValid(v),
        message: props => `${props.value} n'est pas un ID valide`
      }
    }],
    required: true,
    validate: {
      validator: v => v.length >= 2,
      message: 'Une conversation nécessite au moins 2 participants'
    }
  },
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  unreadCount: {
    type: Map,
    of: Number,
    default: {}
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index pour optimisation des requêtes
ConversationSchema.index({ participants: 1 });
ConversationSchema.index({ updatedAt: -1 });

// Middleware pour mettre à jour lastMessage
ConversationSchema.post('save', async function(doc) {
  if (!doc.lastMessage) {
    const lastMsg = await mongoose.model('Message').findOne(
      { conversation: doc._id },
      {},
      { sort: { createdAt: -1 } }
    );
    if (lastMsg) {
      doc.lastMessage = lastMsg._id;
      await doc.save();
    }
  }
});

module.exports = mongoose.model('Conversation', ConversationSchema);