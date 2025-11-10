const fs = require('fs').promises;
const path = require('path');

const folders = [
  'uploads/documents',
  'uploads/avatars',
  'public/pdfs',
  'backups'
];

async function createFolders() {
  try {
    for (const folder of folders) {
      const fullPath = path.join(__dirname, '..', folder);
      try {
        await fs.mkdir(fullPath, { recursive: true });
        console.log(`Dossier créé: ${fullPath}`);
      } catch (err) {
        if (err.code !== 'EEXIST') {
          console.error(`Erreur lors de la création du dossier ${folder}:`, err);
        } else {
          console.log(`Le dossier existe déjà: ${fullPath}`);
        }
      }
    }
    console.log('Tous les dossiers nécessaires sont prêts.');
  } catch (error) {
    console.error('Erreur lors de la création des dossiers:', error);
    process.exit(1);
  }
}

createFolders();
