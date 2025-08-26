const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  role: {
    type: String,
    enum: ['agent', 'admin'],
    default: 'agent'
  },
  password: {
    type: String,
    required: true,
    select: false
  },
  isEmailConfirmed: {
    type: Boolean,
    default: false
  },
  emailConfirmationToken: {
    type: String,
    select: false
  },
  emailConfirmationExpires: {
    type: Date,
    select: false
  },
  passwordResetToken: {
    type: String,
    select: false
  },
  passwordResetExpires: {
    type: Date,
    select: false
  },
  lastLogin: {
    type: Date
  },
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  settings: {
    emailNotifications: { type: Boolean, default: true },
    appNotifications: { type: Boolean, default: true },
    theme: { type: String, enum: ['light', 'dark', 'system'], default: 'light' }
  }
});

// Hasher le mot de passe avant de sauvegarder
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Méthode pour vérifier le mot de passe
UserSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Générer un token JWT
UserSchema.methods.generateAuthToken = function() {
  return jwt.sign(
    { 
      id: this._id, 
      email: this.email, 
      role: this.role 
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// Générer un token de confirmation d'email
UserSchema.methods.generateEmailConfirmationToken = function() {
  const token = crypto.randomBytes(32).toString('hex');
  this.emailConfirmationToken = crypto.createHash('sha256').update(token).digest('hex');
  this.emailConfirmationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 heures
  return token;
};

// Générer un token de réinitialisation de mot de passe
UserSchema.methods.generatePasswordResetToken = function() {
  const token = crypto.randomBytes(32).toString('hex');
  this.passwordResetToken = crypto.createHash('sha256').update(token).digest('hex');
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  return token;
};

// Confirmer l'email
UserSchema.methods.confirmEmail = function(token) {
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
  
  if (this.emailConfirmationToken === hashedToken && this.emailConfirmationExpires > Date.now()) {
    this.isEmailConfirmed = true;
    this.emailConfirmationToken = undefined;
    this.emailConfirmationExpires = undefined;
    return true;
  }
  return false;
};

// Vérifier si le compte est verrouillé
UserSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Incrémenter les tentatives de connexion
UserSchema.methods.incLoginAttempts = function() {
  // Si nous avons une date de verrouillage précédente et qu'elle est expirée, redémarrer à 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  
  // Si nous atteignons le maximum de tentatives et qu'il n'y a pas de verrouillage, verrouiller le compte
  if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 }; // 2 heures
  }
  
  return this.updateOne(updates);
};

// Réinitialiser les tentatives de connexion
UserSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 }
  });
};

// Méthode statique pour trouver un utilisateur par token de réinitialisation
UserSchema.statics.findByPasswordResetToken = function(token) {
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
  
  return this.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() }
  });
};

module.exports = mongoose.model('User', UserSchema);