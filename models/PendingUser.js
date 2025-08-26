const mongoose = require('mongoose');

const pendingUserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    default: 'agent'
  },
  otp: {
    type: String,
    required: true
  },
  otpExpires: {
    type: Date,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 3600 // Document expire après 1 heure
  }
});

module.exports = mongoose.model('PendingUser', pendingUserSchema);
