const express = require('express');
const router = express.Router();
const { generateNaissancePdf } = require('../services/pdfService');

// Test route for PDF generation
router.get('/test-pdf', async (req, res) => {
  try {
    // Test data for the birth certificate
    const testData = {
      numeroActe: '2023-001',
      mairie: 'N\'Djamena',
      dateEtablissement: new Date(),
      nomEnfant: 'Doe',
      prenomsEnfant: 'John',
      dateNaissance: new Date('2023-01-15'),
      heureNaissance: '08:30',
      lieuNaissance: 'N\'Djamena',
      sexe: 'M',
      nomPere: 'Doe',
      prenomsPere: 'John Senior',
      dateNaissancePere: new Date('1980-05-20'),
      lieuNaissancePere: 'Moundou',
      professionPere: 'Ingénieur',
      nomMere: 'Doe',
      prenomsMere: 'Jane',
      dateNaissanceMere: new Date('1985-07-15'),
      lieuNaissanceMere: 'Sarh',
      professionMere: 'Médecin',
      nomDeclarant: 'Smith',
      prenomsDeclarant: 'Alice',
      lienDeclarant: 'Tante',
      adresseDeclarant: '123 Rue de la Paix, N\'Djamena',
      observations: 'Aucune observation particulière.'
    };

    console.log('Generating PDF...');
    const pdfBuffer = await generateNaissancePdf(testData);
    
    // Set the appropriate headers for PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename=test-naissance.pdf');
    
    // Send the PDF buffer as the response
    res.send(pdfBuffer);
    
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la génération du PDF',
      error: error.message 
    });
  }
});

module.exports = router;
