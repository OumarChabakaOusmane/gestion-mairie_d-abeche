const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const User = require('../models/User');
const PendingUser = require('../models/PendingUser');
const emailConfig = require('../config/email');

// Configuration du transporteur email
let transporter = null;

// Initialiser le transporteur email seulement si la configuration est valide
if (emailConfig.isValid()) {
  try {
    transporter = nodemailer.createTransport(emailConfig.getTransporterConfig());
    console.log('Transporteur email configuré avec succès');
  } catch (error) {
    console.error('Erreur lors de la configuration du transporteur email:', error);
  }
} else {
  console.warn('Configuration email non valide. Les fonctionnalités d\'email seront désactivées.');
}

router.get('/current', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Token manquant ou format invalide');
    }
    const token = authHeader.split(' ')[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id)
      .select('-password');

    if (!user) throw new Error('Utilisateur non trouvé');

    res.json({
      success: true,
      data: user
    });
  } catch (err) {
    console.error('[AUTH] Erreur:', err);
    res.status(401).json({
      success: false,
      error: err.message
    });
  }
});

// Enregistrer un utilisateur avec OTP
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'Un utilisateur avec cet email existe déjà'
      });
    }

    // Générer un code OTP à 6 chiffres
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Supprimer toute inscription en cours pour cet email
    await PendingUser.deleteOne({ email });

    // Créer l'entrée temporaire dans la base de données
    const pendingUser = new PendingUser({
      name,
      email,
      password, // Le mot de passe sera hashé lors de la création finale
      role: role || 'agent',
      otp,
      otpExpires
    });

    await pendingUser.save();

    // Envoyer l'email avec le code OTP
    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || 'noreply@example.com',
        to: email,
        subject: 'Code de vérification - État Civil Tchad',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #667eea;">Code de vérification</h2>
            <p>Bonjour <strong>${name}</strong>,</p>
            <p>Votre code de vérification pour créer votre compte État Civil Tchad est :</p>
            <div style="background: #f8f9fa; padding: 20px; text-align: center; margin: 20px 0; border-radius: 10px;">
              <h1 style="color: #667eea; font-size: 2.5em; margin: 0; letter-spacing: 5px;">${otp}</h1>
            </div>
            <p><strong>Ce code expire dans 10 minutes.</strong></p>
            <p>Si vous n'avez pas demandé ce code, ignorez cet email.</p>
            <hr style="margin: 30px 0;">
            <p style="color: #6c757d; font-size: 0.9em;">État Civil Tchad - Système de gestion des actes civils</p>
          </div>
        `
      });

      res.status(200).json({
        success: true,
        message: 'Code OTP envoyé à votre email. Vérifiez votre boîte de réception.',
        data: {
          email: email,
          expiresIn: '10 minutes'
        }
      });

    } catch (emailError) {
      console.error('[REGISTER] Erreur envoi email:', emailError);
      
      res.status(500).json({
        success: false,
        error: 'Erreur lors de l\'envoi du code de vérification'
      });
    }

  } catch (error) {
    console.error('[REGISTER] Erreur:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la création du compte'
    });
  }
});

// Vérifier le code OTP et créer le compte
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;

    // Récupérer les données temporaires depuis MongoDB
    const pendingUser = await PendingUser.findOne({ email });

    if (!pendingUser) {
      return res.status(400).json({
        success: false,
        error: 'Session expirée. Veuillez recommencer l\'inscription.'
      });
    }

    // Vérifier l'expiration
    if (new Date() > pendingUser.otpExpires) {
      await PendingUser.deleteOne({ email });
      return res.status(400).json({
        success: false,
        error: 'Code OTP expiré. Veuillez recommencer l\'inscription.'
      });
    }

    // Vérifier le code OTP
    if (pendingUser.otp !== otp) {
      return res.status(400).json({
        success: false,
        error: 'Code OTP invalide.'
      });
    }

    // Créer l'utilisateur définitivement
    const user = new User({
      name: pendingUser.name,
      email: pendingUser.email,
      password: pendingUser.password, // Le password sera hashé par le middleware pre-save
      role: pendingUser.role,
      isEmailConfirmed: true // Email confirmé via OTP
    });

    await user.save();

    // Supprimer les données temporaires
    await PendingUser.deleteOne({ email });

    res.status(201).json({
      success: true,
      message: 'Compte créé avec succès ! Vous pouvez maintenant vous connecter.',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      }
    });

  } catch (error) {
    console.error('[VERIFY_OTP] Erreur:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la vérification du code'
    });
  }
});

// Renvoyer le code OTP
router.post('/resend-otp', async (req, res) => {
  try {
    const { email } = req.body;

    const pendingUser = await PendingUser.findOne({ email });

    if (!pendingUser) {
      return res.status(400).json({
        success: false,
        error: 'Aucune inscription en cours pour cet email.'
      });
    }

    // Générer un nouveau code OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    // Mettre à jour les données temporaires
    pendingUser.otp = otp;
    pendingUser.otpExpires = otpExpires;
    await pendingUser.save();

    // Envoyer le nouveau code
    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'noreply@example.com',
      to: email,
      subject: 'Nouveau code de vérification - État Civil Tchad',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #667eea;">Nouveau code de vérification</h2>
          <p>Bonjour <strong>${pendingUser.name}</strong>,</p>
          <p>Voici votre nouveau code de vérification :</p>
          <div style="background: #f8f9fa; padding: 20px; text-align: center; margin: 20px 0; border-radius: 10px;">
            <h1 style="color: #667eea; font-size: 2.5em; margin: 0; letter-spacing: 5px;">${otp}</h1>
          </div>
          <p><strong>Ce code expire dans 10 minutes.</strong></p>
        </div>
      `
    });

    res.json({
      success: true,
      message: 'Nouveau code OTP envoyé.'
    });

  } catch (error) {
    console.error('[RESEND_OTP] Erreur:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors du renvoi du code'
    });
  }
});

// Connecter un utilisateur
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Trouver l'utilisateur avec le mot de passe
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Email ou mot de passe incorrect'
      });
    }

    // Vérifier si le compte est verrouillé
    if (user.isLocked) {
      return res.status(423).json({
        success: false,
        error: 'Compte temporairement verrouillé en raison de trop nombreuses tentatives de connexion'
      });
    }

    // Vérifier le mot de passe
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      await user.incLoginAttempts();
      return res.status(401).json({
        success: false,
        error: 'Email ou mot de passe incorrect'
      });
    }

    // Supprimer la vérification d'email confirmé pour simplifier la connexion
    // Les comptes créés via OTP sont automatiquement confirmés

    // Réinitialiser les tentatives de connexion et mettre à jour la dernière connexion
    await user.resetLoginAttempts();
    user.lastLogin = new Date();
    await user.save();

    // Générer le token JWT
    const token = user.generateAuthToken();

    res.json({
      success: true,
      message: 'Connexion réussie',
      token,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          lastLogin: user.lastLogin
        }
      }
    });

  } catch (error) {
    console.error('[LOGIN] Erreur:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la connexion'
    });
  }
});

// Confirmer l'email
router.get('/confirm-email/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      emailConfirmationToken: hashedToken,
      emailConfirmationExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'Token de confirmation invalide ou expiré'
      });
    }

    user.isEmailConfirmed = true;
    user.emailConfirmationToken = undefined;
    user.emailConfirmationExpires = undefined;
    await user.save();

    // Rediriger vers la page de confirmation
    res.redirect('/email-confirmed');

  } catch (error) {
    console.error('[CONFIRM_EMAIL] Erreur:', error);
    res.redirect('/login?error=confirmation_failed');
  }
});

// Mot de passe oublié
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Aucun utilisateur trouvé avec cet email'
      });
    }

    // Générer le token de réinitialisation
    const resetToken = user.generatePasswordResetToken();
    await user.save();

    // Vérifier si le transporteur email est configuré
    if (!transporter) {
      return res.status(503).json({
        success: false,
        error: 'Service email non configuré. Veuillez contacter l\'administrateur.',
        details: 'Pour configurer l\'email, créez un fichier .env avec les variables SMTP_HOST, SMTP_USER, SMTP_PASS, etc.'
      });
    }

    // Envoyer l'email de réinitialisation
    const resetUrl = `${req.protocol}://${req.get('host')}/reset-password/${resetToken}`;

    try {
      await transporter.sendMail({
        from: emailConfig.from,
        to: user.email,
        subject: 'Réinitialisation de votre mot de passe - État Civil Tchad',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #667eea; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
              <h2 style="margin: 0;">Réinitialisation de mot de passe</h2>
            </div>
            <div style="background: #f8f9fa; padding: 20px; border-radius: 0 0 10px 10px;">
              <p>Bonjour <strong>${user.name}</strong>,</p>
              <p>Vous avez demandé la réinitialisation de votre mot de passe pour votre compte État Civil Tchad.</p>
              <p>Cliquez sur le bouton ci-dessous pour réinitialiser votre mot de passe :</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetUrl}" style="background: #dc3545; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Réinitialiser mon mot de passe</a>
              </div>
              <p><strong>⚠️ Important :</strong> Ce lien expirera dans 10 minutes.</p>
              <p>Si vous n'avez pas demandé cette réinitialisation, ignorez cet email et votre mot de passe restera inchangé.</p>
              <hr style="margin: 30px 0; border: none; border-top: 1px solid #dee2e6;">
              <p style="color: #6c757d; font-size: 0.9em; text-align: center;">
                État Civil Tchad - Système de gestion des actes civils<br>
                Cet email a été envoyé automatiquement, merci de ne pas y répondre.
              </p>
            </div>
          </div>
        `
      });

      res.json({
        success: true,
        message: 'Email de réinitialisation envoyé avec succès. Vérifiez votre boîte de réception et vos spams.',
        data: {
          email: user.email,
          expiresIn: '10 minutes'
        }
      });

    } catch (emailError) {
      console.error('Erreur envoi email:', emailError);
      res.status(500).json({
        success: false,
        error: 'Erreur lors de l\'envoi de l\'email de réinitialisation',
        details: 'Vérifiez la configuration SMTP ou contactez l\'administrateur.'
      });
    }

  } catch (error) {
    console.error('[FORGOT_PASSWORD] Erreur:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la demande de réinitialisation'
    });
  }
});

// Vérifier la validité du token de réinitialisation
router.get('/verify-reset-token/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    const user = await User.findByPasswordResetToken(token);
    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'Token de réinitialisation invalide ou expiré'
      });
    }

    res.json({
      success: true,
      message: 'Token valide',
      data: {
        email: user.email,
        expiresIn: '10 minutes'
      }
    });

  } catch (error) {
    console.error('[VERIFY_RESET_TOKEN] Erreur:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la vérification du token'
    });
  }
});

// Réinitialiser le mot de passe
router.post('/reset-password/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Le mot de passe doit contenir au moins 6 caractères'
      });
    }

    const user = await User.findByPasswordResetToken(token);
    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'Token de réinitialisation invalide ou expiré'
      });
    }

    // Réinitialiser le mot de passe
    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.loginAttempts = 0;
    user.lockUntil = undefined;
    await user.save();

    res.json({
      success: true,
      message: 'Mot de passe réinitialisé avec succès'
    });

  } catch (error) {
    console.error('[RESET_PASSWORD] Erreur:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la réinitialisation du mot de passe'
    });
  }
});

// Modifier le mot de passe (utilisateur connecté)
router.post('/change-password', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Token d\'authentification requis'
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const { currentPassword, newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Le nouveau mot de passe doit contenir au moins 6 caractères'
      });
    }

    const user = await User.findById(decoded.id).select('+password');
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Utilisateur non trouvé'
      });
    }

    // Vérifier le mot de passe actuel
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        error: 'Mot de passe actuel incorrect'
      });
    }

    // Mettre à jour le mot de passe
    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Mot de passe modifié avec succès'
    });

  } catch (error) {
    console.error('[CHANGE_PASSWORD] Erreur:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la modification du mot de passe'
    });
  }
});

module.exports = router;