const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Importer le modèle User
const User = require('../models/User');

async function createAdmin() {
  try {
    // Connexion à la base de données
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connecté à la base de données');

    // Vérifier si l'administrateur existe déjà
    const adminExists = await User.findOne({ email: 'admin@example.com' });
    if (adminExists) {
      console.log('Un administrateur avec cet email existe déjà');
      process.exit(0);
    }

    // Créer un nouvel administrateur
    const admin = new User({
      name: 'Administrateur',
      email: 'admin@example.com',
      password: 'admin123', // Le mot de passe sera hashé par le pre-save
      role: 'admin',
      isEmailConfirmed: true
    });

    // Sauvegarder l'administrateur
    await admin.save();
    console.log('Administrateur créé avec succès');
    console.log('Email: admin@example.com');
    console.log('Mot de passe: admin123');
    
    process.exit(0);
  } catch (error) {
    console.error('Erreur lors de la création de l\'administrateur:', error);
    process.exit(1);
  }
}

createAdmin();
