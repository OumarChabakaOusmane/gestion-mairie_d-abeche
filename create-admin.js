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
    await User.deleteOne({ email: 'admin@test.com' });
    console.log('Ancien administrateur supprimé (si existant)');

    // Créer le hash du mot de passe
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash('password123', saltRounds);

    // Créer l'utilisateur administrateur
    const admin = new User({
      name: 'Administrateur Test',
      email: 'admin@test.com',
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
    console.log('📧 Email: admin@test.com');
    console.log('🔑 Mot de passe: password123');
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
