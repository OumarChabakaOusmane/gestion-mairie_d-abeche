const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { logger } = require('../config/logger');

// Dossier de sortie pour les PDF générés
const OUTPUT_DIR = path.join(__dirname, '../public/pdfs');

// Créer le dossier de sortie s'il n'existe pas
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Génère l'en-tête du document avec le drapeau du Tchad
 * @param {PDFDocument} doc - L'instance PDFKit
 */
function generateHeader(doc) {
  // Drapeau du Tchad (bandes verticales)
  const flagX = 50;
  const flagY = 50;
  const flagWidth = 90;
  const stripeWidth = flagWidth / 3;
  
  // Fond blanc avec contour
  doc
    .rect(flagX, flagY, flagWidth, 60)
    .fillAndStroke('white', 'black');
  
  // Bandes du drapeau
  doc
    .fillColor('#002689') // Bleu
    .rect(flagX, flagY, stripeWidth, 60)
    .fill()
    .fillColor('#FFD100') // Jaune
    .rect(flagX + stripeWidth, flagY, stripeWidth, 60)
    .fill()
    .fillColor('#CE1126') // Rouge
    .rect(flagX + (stripeWidth * 2), flagY, stripeWidth, 60)
    .fill();
  
  // Titre du document
  doc
    .fillColor('black')
    .font('Helvetica-Bold')
    .fontSize(16)
    .text('RÉPUBLIQUE DU TCHAD', 200, 60, { align: 'center' })
    .fontSize(12)
    .text('Unité - Travail - Progrès', 200, 80, { align: 'center' })
    .moveDown(2);
}

/**
 * Génère un PDF pour un acte de naissance
 * @param {Object} data - Les données de l'acte de naissance
 * @returns {Promise<Buffer>} - Le buffer du PDF généré
 */
const generateNaissancePdf = async (data) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ 
        margin: 50,
        bufferPages: true,
        size: 'A4'
      });
      
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('error', (error) => {
        logger.error('Erreur lors de la génération du PDF', { error });
        reject(error);
      });
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      // 1. En-tête avec drapeau
      generateHeader(doc);
      
      // 2. Titre du document
      doc
        .fontSize(18)
        .font('Helvetica-Bold')
        .text('ACTE DE NAISSANCE', { align: 'center' })
        .moveDown(0.5);
        
      // 3. Informations administratives dans un cadre
      const adminInfoY = doc.y;
      doc
        .roundedRect(50, adminInfoY, 500, 60, 5)
        .stroke('#CCCCCC')
        .fill('#F8F9FA');
        
      doc
        .font('Helvetica-Bold')
        .fontSize(12)
        .fillColor('#002689')
        .text('INFORMATIONS ADMINISTRATIVES', 60, adminInfoY + 10)
        .font('Helvetica')
        .fontSize(10)
        .fillColor('#333333')
        .text(`N°: ${data.numeroActe || 'N/A'}`, 60, adminInfoY + 30, { width: 150 })
        .text(`Mairie de: ${data.mairie || 'N/A'}`, 220, adminInfoY + 30, { width: 150 })
        .text(`Date: ${data.dateEtablissement ? new Date(data.dateEtablissement).toLocaleDateString('fr-FR') : 'N/A'}`, 380, adminInfoY + 30, { width: 150 })
        .moveDown(4);

      // 4. Informations de l'enfant
      const enfantInfoY = doc.y;
      doc
        .roundedRect(50, enfantInfoY, 500, 120, 5)
        .stroke('#CCCCCC')
        .fill('#E6F3FF');
        
      doc
        .font('Helvetica-Bold')
        .fontSize(14)
        .fillColor('#002689')
        .text('INFORMATIONS DE L\'ENFANT', 60, enfantInfoY + 10)
        .font('Helvetica')
        .fontSize(11)
        .fillColor('#333333')
        .text(`Nom: ${data.nomEnfant || 'N/A'}`, 60, enfantInfoY + 35)
        .text(`Prénoms: ${data.prenomsEnfant || 'N/A'}`, 60, enfantInfoY + 55)
        .text(`Date de naissance: ${data.dateNaissance ? new Date(data.dateNaissance).toLocaleDateString('fr-FR') : 'N/A'}`, 60, enfantInfoY + 75)
        .text(`Heure de naissance: ${data.heureNaissance || 'N/A'}`, 300, enfantInfoY + 75)
        .text(`Lieu de naissance: ${data.lieuNaissance || 'N/A'}`, 60, enfantInfoY + 95)
        .text(`Sexe: ${data.sexe === 'M' ? 'Masculin' : data.sexe === 'F' ? 'Féminin' : 'N/A'}`, 300, enfantInfoY + 95)
        .moveDown(1);

      // 5. Informations des parents
      const parentsInfoY = doc.y + 20;
      doc
        .roundedRect(50, parentsInfoY, 500, 180, 5)
        .stroke('#CCCCCC')
        .fill('#FFF9E6');
        
      doc
        .font('Helvetica-Bold')
        .fontSize(14)
        .fillColor('#002689')
        .text('FILIATION', 60, parentsInfoY + 10)
        .font('Helvetica-Bold')
        .fontSize(12)
        .fillColor('#333333')
        .text('PÈRE:', 60, parentsInfoY + 40)
        .font('Helvetica')
        .text(`Nom: ${data.nomPere || 'N/A'}`, 90, parentsInfoY + 40)
        .text(`Prénoms: ${data.prenomsPere || 'N/A'}`, 90, parentsInfoY + 60);
        
      if (data.dateNaissancePere) {
        doc.text(`Date de naissance: ${new Date(data.dateNaissancePere).toLocaleDateString('fr-FR')}`, 90, parentsInfoY + 80);
      }
      if (data.lieuNaissancePere) {
        doc.text(`Lieu de naissance: ${data.lieuNaissancePere}`, 90, parentsInfoY + 100);
      }
      if (data.professionPere) {
        doc.text(`Profession: ${data.professionPere}`, 90, parentsInfoY + 120);
      }
      
      // Mère
      doc
        .font('Helvetica-Bold')
        .text('MÈRE:', 300, parentsInfoY + 40)
        .font('Helvetica')
        .text(`Nom: ${data.nomMere || 'N/A'}`, 330, parentsInfoY + 40)
        .text(`Prénoms: ${data.prenomsMere || 'N/A'}`, 330, parentsInfoY + 60);
        
      if (data.dateNaissanceMere) {
        doc.text(`Date de naissance: ${new Date(data.dateNaissanceMere).toLocaleDateString('fr-FR')}`, 330, parentsInfoY + 80);
      }
      if (data.lieuNaissanceMere) {
        doc.text(`Lieu de naissance: ${data.lieuNaissanceMere}`, 330, parentsInfoY + 100);
      }
      if (data.professionMere) {
        doc.text(`Profession: ${data.professionMere}`, 330, parentsInfoY + 120);
      }
      
      // 6. Informations du déclarant (si disponible)
      if (data.nomDeclarant || data.prenomsDeclarant) {
        const declarantY = doc.y + 30;
        doc
          .roundedRect(50, declarantY, 500, 100, 5)
          .stroke('#CCCCCC')
          .fill('#F5F5F5');
          
        doc
          .font('Helvetica-Bold')
          .fontSize(12)
          .fillColor('#002689')
          .text('INFORMATIONS DU DÉCLARANT', 60, declarantY + 10)
          .font('Helvetica')
          .fontSize(11)
          .fillColor('#333333')
          .text(`Nom: ${data.nomDeclarant || 'N/A'}`, 60, declarantY + 35)
          .text(`Prénoms: ${data.prenomsDeclarant || 'N/A'}`, 60, declarantY + 55);
          
        if (data.lienDeclarant) {
          doc.text(`Lien avec l'enfant: ${data.lienDeclarant}`, 60, declarantY + 75);
        }
        if (data.adresseDeclarant) {
          doc.text(`Adresse: ${data.adresseDeclarant}`, 300, declarantY + 75);
        }
        
        doc.moveDown(2);
      }
      
      // 7. Observations (si disponibles)
      if (data.observations) {
        const obsY = doc.y + 20;
        doc
          .roundedRect(50, obsY, 500, 80, 5)
          .stroke('#CCCCCC')
          .fill('#F5F5F5');
          
        doc
          .font('Helvetica-Bold')
          .fontSize(12)
          .fillColor('#002689')
          .text('OBSERVATIONS', 60, obsY + 10)
          .font('Helvetica')
          .fontSize(11)
          .fillColor('#333333')
          .text(data.observations, { 
            x: 60, 
            y: obsY + 35, 
            width: 480,
            align: 'justify'
          });
        
        doc.moveDown(3);
      }
      
      // 8. Signature
      doc
        .moveDown(2)
        .text('Fait à ' + (data.mairie || 'N/A') + ', le ' + (data.dateEtablissement ? new Date(data.dateEtablissement).toLocaleDateString('fr-FR') : ''), { align: 'right' })
        .moveDown(3)
        .text('Le Maire', { align: 'right' })
        .moveDown(2)
        .text('Cachet et signature', { align: 'right', color: '#999' });
      
      // Finaliser le document
      doc.end();
    } catch (error) {
      logger.error('Erreur lors de la génération du PDF de naissance', { error });
      reject(error);
    }
  });
};

// Exporter les fonctions
module.exports = {
  generateNaissancePdf
};
