const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
require('dotenv').config();

async function createAdminUser() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    // Vérifier si un admin existe déjà
    const existingAdmin = await User.findOne({ email: 'admin@mairie-tchad.td' });
    
    if (existingAdmin) {
      console.log('✅ Un compte admin existe déjà avec cet email');
      console.log(`Email: ${existingAdmin.email}`);
      console.log('Si vous avez oublié le mot de passe, réinitialisez-le');
      process.exit(0);
    }

    // Créer un nouvel utilisateur admin
    const adminUser = new User({
      name: 'Administrateur',
      email: 'admin@mairie-tchad.td',
      password: await bcrypt.hash('admin123', 10),
      role: 'admin',
      isEmailConfirmed: true
    });
    
    await adminUser.save();
    
    console.log('✅ Compte administrateur créé avec succès !');
    console.log('Email: admin@mairie-tchad.td');
    console.log('Mot de passe: admin123');
    console.log('\n⚠️ IMPORTANT: Changez ce mot de passe après votre première connexion !');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur lors de la création du compte admin:', error.message);
    process.exit(1);
  }
}

createAdminUser();
