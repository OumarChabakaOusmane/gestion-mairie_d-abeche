const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { emailService, emailTemplates } = require('../services/emailService');

exports.register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

        let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({
        success: false,
        message: 'Un utilisateur avec cet email existe déjà'
      });
    }

        user = new User({
      name,
      email,
      password,
      role: role || 'agent' // Par défaut, le rôle est 'agent'
    });

        const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    await user.save();

        try {
      const welcomeEmail = emailTemplates.welcome(user);
      await emailService.sendEmail({
        to: user.email,
        subject: welcomeEmail.subject,
        text: welcomeEmail.text,
        html: welcomeEmail.html
      });
    } catch (emailError) {
      console.error('Erreur lors de l\'envoi de l\'email de bienvenue:', emailError);
      // Ne pas échouer la requête si l'email échoue
    }

    // Créer et renvoyer le token JWT
    const payload = {
      user: {
        id: user.id,
        role: user.role
      }
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
      (err, token) => {
        if (err) throw err;
        res.status(201).json({
          success: true,
          token,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            settings: user.settings
          }
        });
      }
    );
  } catch (err) {
    console.error('Erreur lors de l\'inscription:', err);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'inscription',
      error: err.message
    });
  }
};

// Connexion d'un utilisateur
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Vérifier si l'utilisateur existe
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Identifiants invalides'
      });
    }

    // Vérifier le mot de passe
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Identifiants invalides'
      });
    }

    // Créer et renvoyer le token JWT
    const payload = {
      user: {
        id: user.id,
        role: user.role
      }
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
      (err, token) => {
        if (err) throw err;
        res.json({
          success: true,
          token,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            settings: user.settings
          }
        });
      }
    );
  } catch (err) {
    console.error('Erreur lors de la connexion:', err);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la connexion',
      error: err.message
    });
  }
};

// Récupérer l'utilisateur actuel
exports.getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json({
      success: true,
      data: user
    });
  } catch (err) {
    console.error('Erreur lors de la récupération de l\'utilisateur:', err);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: err.message
    });
  }
};
