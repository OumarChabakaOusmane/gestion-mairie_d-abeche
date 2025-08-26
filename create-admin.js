require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

async function createAdmin() {
  try {
    // Connexion à MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connecté à MongoDB');

    // Supprimer l'admin existant s'il y en a un
    await User.deleteOne({ email: 'admin@tchad.gov.td' });
    console.log('Ancien administrateur supprimé (si existant)');

    // Créer le hash du mot de passe (mot de passe simple à retenir)
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash('123456', saltRounds);

    // Créer l'utilisateur administrateur
    const admin = new User({
      name: 'Administrateur Principal',
      email: 'admin@tchad.gov.td',
      password: hashedPassword,
      role: 'admin',
      isEmailConfirmed: true, // Confirmer l'email directement
      createdAt: new Date(),
      lastLogin: null,
      loginAttempts: 0,
      isLocked: false
    });

    await admin.save();
    
    console.log('✅ Administrateur créé avec succès !');
    console.log('📧 Email: admin@tchad.gov.td');
    console.log('🔑 Mot de passe: 123456');
    console.log('👤 Rôle: Administrateur');
    console.log('\nVous pouvez maintenant vous connecter avec ces identifiants.');

  } catch (error) {
    console.error('❌ Erreur lors de la création de l\'administrateur:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Déconnecté de MongoDB');
    process.exit(0);
  }
}

createAdmin();
