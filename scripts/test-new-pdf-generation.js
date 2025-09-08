const { generateNaissancePdf } = require('../services/pdfServiceNew');
const fs = require('fs');
const path = require('path');

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

// Function to test PDF generation
async function testPdfGeneration() {
  try {
    console.log('Generating PDF with the new implementation...');
    const pdfBuffer = await generateNaissancePdf(testData);
    
    // Ensure the output directory exists
    const outputDir = path.join(__dirname, '../public/pdfs');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Save the PDF to a file
    const outputPath = path.join(outputDir, 'test-naissance-new.pdf');
    fs.writeFileSync(outputPath, pdfBuffer);
    
    console.log(`PDF generated successfully at: ${outputPath}`);
    console.log('You can open the PDF file to verify the output.');
  } catch (error) {
    console.error('Error generating PDF:', error);
  }
}

// Run the test
testPdfGeneration();
