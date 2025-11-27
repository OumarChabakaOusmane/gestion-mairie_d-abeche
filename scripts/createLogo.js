const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');

// Créer le dossier s'il n'existe pas
const dir = path.join(__dirname, '../public/images');
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

// Créer un canvas
const width = 200;
const height = 100;
const canvas = createCanvas(width, height);
const ctx = canvas.getContext('2d');

// Fond blanc
ctx.fillStyle = 'white';
ctx.fillRect(0, 0, width, height);

// Texte
ctx.font = 'bold 20px Arial';
ctx.fillStyle = 'blue';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillText("Mairie du Tchad", width / 2, height / 2);

// Enregistrer le logo
const out = fs.createWriteStream(path.join(dir, 'logo.png'));
const stream = canvas.createPNGStream();
stream.pipe(out);
out.on('finish', () => console.log('Logo créé avec succès !'));
