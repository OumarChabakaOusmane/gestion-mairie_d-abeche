const nodemailer = require('nodemailer');
const emailConfig = require('../config/email');

// Créer un transporteur SMTP réutilisable
const transporter = nodemailer.createTransport(emailConfig.getTransporterConfig());

// Vérifier la configuration du transporteur
transporter.verify((error, success) => {
  if (error) {
    console.error('Erreur de configuration du transporteur email:', error);
  } else {
    console.log('Serveur SMTP prêt à envoyer des emails');
  }
});

// Fonction pour envoyer un email
const sendEmail = async (options) => {
  try {
    if (!emailConfig.isValid()) {
      console.warn('Configuration SMTP non valide. L\'email ne sera pas envoyé.');
      return { success: false, message: 'Configuration SMTP non valide' };
    }

    const info = await transporter.sendMail({
      from: `"Mairie du Tchad" <${emailConfig.from}>`,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
      attachments: options.attachments
    });
    
    console.log('Message envoyé: %s', info.messageId);
    return { 
      success: true, 
      messageId: info.messageId,
      previewUrl: nodemailer.getTestMessageUrl(info)
    };
  } catch (error) {
    console.error('Erreur lors de l\'envoi de l\'email:', error);
    throw new Error(`Échec de l'envoi de l'email: ${error.message}`);
  }
};

// Modèles d'emails prédéfinis
const emailTemplates = {
  // Email de confirmation de demande d'acte
  confirmationDemandeActe: (data) => ({
    subject: `Confirmation de votre demande d'acte #${data.numeroDossier}`,
    text: `Bonjour ${data.nom},
    
Votre demande d'acte a bien été enregistrée sous le numéro ${data.numeroDossier}.

Détails de la demande :
- Type d'acte : ${data.typeActe}
- Type de document : ${data.typeDocument}
- Date de la demande : ${data.dateDemande}

Vous recevrez une notification par email dès que votre demande sera traitée.

Cordialement,
La Mairie du Tchad`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #2c3e50; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0;">
          <h1>Confirmation de votre demande d'acte</h1>
        </div>
        
        <div style="padding: 20px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 5px 5px;">
          <p>Bonjour ${data.nom},</p>
          
          <p>Votre demande d'acte a bien été enregistrée sous le numéro <strong>${data.numeroDossier}</strong>.</p>
          
          <div style="background-color: #f8f9fa; border-left: 4px solid #3498db; padding: 10px 15px; margin: 15px 0;">
            <p><strong>Type d'acte :</strong> ${data.typeActe}</p>
            <p><strong>Type de document :</strong> ${data.typeDocument}</p>
            <p><strong>Date de la demande :</strong> ${data.dateDemande}</p>
          </div>
          
          <p>Vous recevrez une notification par email dès que votre demande sera traitée.</p>
          
          <p>Cordialement,<br>L'équipe de la Mairie du Tchad</p>
        </div>
      </div>
    `
  }),
  
  // Email de notification de statut mis à jour
  miseAJourStatutDemande: (data) => ({
    subject: `Mise à jour de votre demande #${data.numeroDossier}`,
    text: `Bonjour ${data.nom},
    
Le statut de votre demande #${data.numeroDossier} a été mis à jour.

Nouveau statut : ${data.nouveauStatut}
${data.motifRejet ? `\nMotif : ${data.motifRejet}` : ''}

Vous pouvez suivre l'avancement de votre demande en vous connectant à votre espace personnel.

Cordialement,
La Mairie du Tchad`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #2c3e50; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0;">
          <h1>Mise à jour de votre demande #${data.numeroDossier}</h1>
        </div>
        
        <div style="padding: 20px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 5px 5px;">
          <p>Bonjour ${data.nom},</p>
          
          <p>Le statut de votre demande <strong>#${data.numeroDossier}</strong> a été mis à jour.</p>
          
          <div style="background-color: #f8f9fa; border-left: 4px solid #3498db; padding: 10px 15px; margin: 15px 0;">
            <p><strong>Nouveau statut :</strong> <span style="color: #e67e22; font-weight: bold;">${data.nouveauStatut}</span></p>
            ${data.motifRejet ? `<p><strong>Motif :</strong> ${data.motifRejet}</p>` : ''}
          </div>
          
          <p>Vous pouvez suivre l'avancement de votre demande en vous connectant à votre espace personnel.</p>
          
          <div style="text-align: center; margin: 25px 0;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/mes-demandes/${data.numeroDossier}" style="display: inline-block; padding: 10px 20px; background-color: #3498db; color: white; text-decoration: none; border-radius: 4px; margin: 15px 0;">Voir ma demande</a>
          </div>
          
          <p>Cordialement,<br>L'équipe de la Mairie du Tchad</p>
        </div>
      </div>
    `
  }),
  
  // Email de notification de document disponible
  documentDisponible: (data) => ({
    subject: `Document disponible pour votre demande #${data.numeroDossier}`,
    text: `Bonjour ${data.nom},
    
Un nouveau document est disponible pour votre demande #${data.numeroDossier}.

Type de document : ${data.typeDocument}
Date d'ajout : ${data.dateAjout}

Vous pouvez le télécharger en vous connectant à votre espace personnel.

Cordialement,
La Mairie du Tchad`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #27ae60; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0;">
          <h1>Document disponible</h1>
        </div>
        
        <div style="padding: 20px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 5px 5px;">
          <p>Bonjour ${data.nom},</p>
          
          <p>Un nouveau document est disponible pour votre demande <strong>#${data.numeroDossier}</strong>.</p>
          
          <div style="background-color: #e8f8f0; border-left: 4px solid #2ecc71; padding: 15px; margin: 15px 0; border-radius: 4px;">
            <p><strong>Type de document :</strong> ${data.typeDocument}</p>
            <p><strong>Date d'ajout :</strong> ${data.dateAjout}</p>
          </div>
          
          <p>Vous pouvez le télécharger en cliquant sur le bouton ci-dessous :</p>
          
          <div style="text-align: center; margin: 25px 0;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/mes-demandes/${data.numeroDossier}" style="display: inline-block; padding: 10px 20px; background-color: #2ecc71; color: white; text-decoration: none; border-radius: 4px; margin: 15px 0;">Télécharger le document</a>
          </div>
          
          <p>Si le bouton ne fonctionne pas, copiez et collez le lien suivant dans votre navigateur :</p>
          <p style="word-break: break-all; font-size: 12px; color: #666;">${process.env.FRONTEND_URL || 'http://localhost:3000'}/mes-demandes/${data.numeroDossier}</p>
          
          <p>Cordialement,<br>L'équipe de la Mairie du Tchad</p>
        </div>
      </div>
    `
  }),
  
  welcome: (user) => ({
    subject: 'Bienvenue sur la plateforme de la Mairie du Tchad',
    text: `Bonjour ${user.name},\n\nBienvenue sur notre plateforme. Votre compte a été créé avec succès.\n\nCordialement,\nL'équipe de la Mairie du Tchad`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Bienvenue sur la plateforme de la Mairie du Tchad</h2>
        <p>Bonjour <strong>${user.name}</strong>,</p>
        <p>Votre compte a été créé avec succès sur notre plateforme.</p>
        <p>Vous pouvez maintenant vous connecter en utilisant vos identifiants.</p>
        <p>Cordialement,<br>L'équipe de la Mairie du Tchad</p>
      </div>
    `
  }),
  
  resetPassword: (user, resetUrl) => ({
    subject: 'Réinitialisation de votre mot de passe',
    text: `Bonjour ${user.name},\n\nVous avez demandé à réinitialiser votre mot de passe. Cliquez sur le lien ci-dessous pour procéder :\n\n${resetUrl}\n\nCe lien expirera dans 1 heure.\n\nSi vous n'avez pas demandé cette réinitialisation, veuillez ignorer cet email.\n\nCordialement,\nL'équipe de la Mairie du Tchad`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Réinitialisation de votre mot de passe</h2>
        <p>Bonjour <strong>${user.name}</strong>,</p>
        <p>Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le bouton ci-dessous pour procéder :</p>
        <p style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            Réinitialiser mon mot de passe
          </a>
        </p>
        <p>Ou copiez ce lien dans votre navigateur :<br>${resetUrl}</p>
        <p><em>Ce lien expirera dans 1 heure.</em></p>
        <p>Si vous n'avez pas demandé cette réinitialisation, veuillez ignorer cet email.</p>
        <p>Cordialement,<br>L'équipe de la Mairie du Tchad</p>
      </div>
    `
  })
};

module.exports = {
  sendEmail,
  emailTemplates,
  transporter
};
