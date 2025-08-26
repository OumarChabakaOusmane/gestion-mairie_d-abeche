// Configuration email pour l'application
const emailConfig = {
  // Configuration SMTP
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER || 'default@example.com',
      pass: process.env.SMTP_PASS || 'default_password'
    }
  },
  
  // Configuration des emails
  from: process.env.SMTP_FROM || 'noreply@etatcivil-tchad.com',
  
  // Vérifier si la configuration email est valide
  isValid: function() {
    return this.smtp.auth.user !== 'default@example.com' && 
           this.smtp.auth.pass !== 'default_password';
  },
  
  // Obtenir la configuration pour nodemailer
  getTransporterConfig: function() {
    return {
      host: this.smtp.host,
      port: this.smtp.port,
      secure: this.smtp.secure,
      auth: this.smtp.auth
    };
  }
};

module.exports = emailConfig;
