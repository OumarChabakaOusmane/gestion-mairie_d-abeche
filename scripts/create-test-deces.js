const mongoose = require('mongoose');
require('dotenv').config();
const Acte = require('../models/Acte');

async function createTestDeces() {
  try {
    // Connexion à la base de données
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/wenaklabs', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connecté à la base de données');

    // Création d'un acte de décès de test
    const testDeces = {
      type: 'deces',
      details: {
        nomDefunt: 'DUPONT',
        prenomsDefunt: 'Jean Michel',
        dateNaissanceDefunt: '1980-05-15T00:00:00.000Z',
        lieuNaissanceDefunt: 'N\'Djamena, Tchad',
        professionDefunt: 'Enseignant',
        domicileDefunt: 'Quartier Moursal, N\'Djamena',
        dateDeces: '2023-10-15T00:00:00.000Z',
        heureDeces: '14:30',
        lieuDeces: 'Hôpital Général de Référence Nationale, N\'Djamena',
        causeDeces: 'Maladie',
        
        // Informations du déclarant
        nomDeclarant: 'DUPONT',
        prenomsDeclarant: 'Marie Claire',
        dateNaissanceDeclarant: '1985-07-22T00:00:00.000Z',
        lieuNaissanceDeclarant: 'Moundou, Tchad',
        professionDeclarant: 'Infirmière',
        domicileDeclarant: 'Quartier Moursal, N\'Djamena',
        lienDeclarant: 'Épouse',
      },
      mairie: 'N\'Djamena 1er Arrondissement',
      dateEnregistrement: new Date(),
      createdBy: new mongoose.Types.ObjectId(), // ID factice pour le test
    };

    // Enregistrement de l'acte de décès
    const acte = new Acte(testDeces);
    await acte.save();

    console.log('Acte de décès de test créé avec succès:');
    console.log(acte);

    // Génération de l'URL pour télécharger le PDF
    console.log(`\nPour télécharger le PDF, accédez à :`);
    console.log(`http://localhost:${process.env.PORT || 3000}/api/actes/deces/${acte._id}/pdf`);

  } catch (error) {
    console.error('Erreur lors de la création de l\'acte de décès de test:', error);
  } finally {
    // Fermeture de la connexion
    await mongoose.disconnect();
    process.exit(0);
  }
}

createTestDeces();
