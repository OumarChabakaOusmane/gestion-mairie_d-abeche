const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  sender: { type: String, required: true },
  recipient: { type: String, required: true },
  subject: { type: String, required: true },
  body: { type: String, required: true },
  read: { type: Boolean, default: false },
  sentAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Message', MessageSchema);