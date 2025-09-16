const fs = require('fs');
const path = require('path');

// Créer un logger de secours pour les tests
const logger = {
  info: (message, meta) => console.log(`[INFO] ${message}`, JSON.stringify(meta)),
  error: (message, meta) => console.error(`[ERROR] ${message}`, JSON.stringify(meta)),
  warn: (message, meta) => console.warn(`[WARN] ${message}`, JSON.stringify(meta))
};

// Mock du logger dans le module
jest.mock('../config/logger', () => ({
  logger: {
    info: (message, meta) => console.log(`[MOCK INFO] ${message}`, JSON.stringify(meta)),
    error: (message, meta) => console.error(`[MOCK ERROR] ${message}`, JSON.stringify(meta)),
    warn: (message, meta) => console.warn(`[MOCK WARN] ${message}`, JSON.stringify(meta))
  }
}));

const { generateNaissancePdf } = require('../services/pdfServiceNew');

// Données de test pour la génération du PDF
const testData = {
  numeroActe: '2023-001',
  dateEtablissement: '2023-01-15',
  mairie: 'N\'Djamena',
  
  // Informations de l'enfant
  nomEnfant: 'Doe',
  prenomsEnfant: 'John',
  dateNaissance: '2023-01-01',
  heureNaissance: '08:30',
  lieuNaissance: 'Hôpital Général de Référence Nationale',
  sexe: 'M',
  
  // Informations du père
  nomPere: 'Doe',
  prenomsPere: 'Robert',
  dateNaissancePere: '1980-05-15',
  lieuNaissancePere: 'N\'Djamena',
  professionPere: 'Ingénieur',
  
  // Informations de la mère
  nomMere: 'Smith',
  prenomsMere: 'Marie',
  dateNaissanceMere: '1985-07-20',
  lieuNaissanceMere: 'Moundou',
  professionMere: 'Enseignante',
  
  // Informations du déclarant
  nomDeclarant: 'Dupont',
  prenomsDeclarant: 'Jean',
  lienDeclarant: 'Oncle',
  adresseDeclarant: 'Quartier Farcha, N\'Djamena',
  
  // Observations
  observations: 'Acte établi en présence des deux parents et du déclarant.'
};

// Fonction utilitaire pour sauvegarder le PDF généré
const savePdfForInspection = async (pdfBuffer, filename) => {
  const outputDir = path.join(__dirname, '../test-output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const filePath = path.join(outputDir, filename);
  fs.writeFileSync(filePath, pdfBuffer);
  console.log(`PDF sauvegardé pour inspection : ${filePath}`);
  return filePath;
};

// Test de génération de PDF
describe('Service de génération de PDF', () => {
  it('devrait générer un PDF valide', async () => {
    try {
      console.log('Début du test de génération de PDF...');
      
      // 1. Générer le PDF
      console.log('Génération du PDF...');
      const pdfBuffer = await generateNaissancePdf(testData);
      
      // 2. Vérifier que le buffer n'est pas vide
      expect(pdfBuffer).toBeDefined();
      expect(pdfBuffer.length).toBeGreaterThan(0);
      
      // 3. Sauvegarder le PDF pour inspection
      const savedFilePath = await savePdfForInspection(pdfBuffer, 'acte-naissance-test.pdf');
      console.log(`Test réussi ! PDF généré et sauvegardé : ${savedFilePath}`);
      
      // 4. Vérifier que le fichier a été créé
      expect(fs.existsSync(savedFilePath)).toBe(true);
      
      // 5. Vérifier la taille du fichier (doit être supérieure à 1 Ko)
      const stats = fs.statSync(savedFilePath);
      expect(stats.size).toBeGreaterThan(1024);
      
    } catch (error) {
      console.error('Erreur lors du test de génération de PDF:', error);
      throw error;
    }
  });

  it('devrait échouer avec des données manquantes', async () => {
    const invalidData = { ...testData, nomEnfant: undefined };
    
    await expect(generateNaissancePdf(invalidData))
      .rejects
      .toThrow('Données d\'entrée invalides');
  });
});
