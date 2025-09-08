const { connectDB } = require('../config/db');
const Naissance = require('../models/Naissance');
const User = require('../models/User');
const mongoose = require('mongoose');

async function createTestNaissance() {
  try {
    // Connect to the database
    await connectDB();
    
    // Create a test user first with required fields
    const testUser = new User({
      name: 'Test User',
      email: 'test@example.com',
      password: 'test123',
      role: 'admin', // Using 'admin' as a valid role
      phone: '1234567890',
      address: '123 Test St',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    // Save the test user
    const savedUser = await testUser.save();
    console.log('Test user created with ID:', savedUser._id);
    
    // Create a test birth record with all required fields
    const testNaissance = new Naissance({
      numeroActe: 'TEST-2023-001',
      dateEtablissement: new Date(),
      mairie: 'Mairie de Test',
      
      // Enfant fields (flattened)
      nomEnfant: 'Doe',
      prenomsEnfant: 'John',
      dateNaissance: new Date('2023-01-15'),
      heureNaissance: '08:30',
      lieuNaissance: 'N\'Djamena',
      sexe: 'M',
      
      // Père fields
      nomPere: 'Doe',
      prenomsPere: 'John Senior',
      dateNaissancePere: new Date('1980-05-20'),
      lieuNaissancePere: 'N\'Djamena',
      professionPere: 'Ingénieur',
      
      // Mère fields
      nomMere: 'Doe',
      prenomsMere: 'Jane',
      dateNaissanceMere: new Date('1985-08-15'),
      lieuNaissanceMere: 'Moundou',
      professionMere: 'Enseignante',
      
      // Déclarant fields
      nomDeclarant: 'Doe',
      prenomsDeclarant: 'John Senior',
      lienDeclarant: 'Père',
      adresseDeclarant: '123 Rue de Test, N\'Djamena',
      
      // Required system fields
      createdBy: savedUser._id,
      officierEtatCivil: savedUser._id,
      
      // Optional fields
      observations: 'Acte de naissance de test',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Save the test record
    const savedNaissance = await testNaissance.save();
    console.log('Test birth record created successfully:');
    console.log(savedNaissance);
    
    process.exit(0);
  } catch (error) {
    console.error('Error creating test birth record:', error);
    process.exit(1);
  }
}

createTestNaissance();
