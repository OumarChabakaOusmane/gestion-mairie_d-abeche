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
 * @param {string} title - Le titre du document (optionnel)
 */
function generateHeader(doc, title = '') {
  // 1. Drapeau du Tchad (bandes verticales)
  const flagX = 50;
  const flagY = 30;
  const flagWidth = 90;
  const flagHeight = 50;
  const stripeWidth = flagWidth / 3;
  
  // Contour du drapeau avec fond blanc
  doc
    .lineWidth(1.5)
    .rect(flagX, flagY, flagWidth, flagHeight)
    .fillAndStroke('white', 'black');
  
  // Bandes du drapeau (bleu, jaune, rouge)
  doc
    .fillColor('#002689') // Bleu
    .rect(flagX, flagY, stripeWidth, flagHeight)
    .fill()
    .fillColor('#FFD100') // Jaune
    .rect(flagX + stripeWidth, flagY, stripeWidth, flagHeight)
    .fill()
    .fillColor('#CE1126') // Rouge
    .rect(flagX + (stripeWidth * 2), flagY, stripeWidth, flagHeight)
    .fill();
  
  // 2. En-tête avec titre et devise
  const headerX = flagX + flagWidth + 20;
  const headerY = flagY + 5;
  
  // Texte de l'en-tête
  doc
    .font('Helvetica-Bold')
    .fontSize(14)
    .fillColor('#000000')
    .text('RÉPUBLIQUE DU TCHAD', headerX, headerY)
    .font('Helvetica')
    .fontSize(10)
    .text('Unité - Travail - Progrès', headerX, headerY + 20);
    
  // Titre du document
  if (title) {
    doc
      .font('Helvetica-Bold')
      .fontSize(16)
      .text(title, headerX, headerY + 40);
  }
  
  return flagY + flagHeight + 20; // Retourne la position Y après l'en-tête
}

/**
 * Génère une section pour une personne (défunt, déclarant, etc.)
 * @param {PDFDocument} doc - L'instance PDFKit
 * @param {Object} data - Les données de la personne
 * @param {number} y - Position Y de départ
 * @param {string} title - Titre de la section
 * @param {number} boxHeight - Hauteur de la boîte
 * @returns {number} - Nouvelle position Y
 */
function generatePersonneSection(doc, data, y, title, boxHeight) {
  // Titre de section avec fond coloré
  doc
    .fillColor('#002689')
    .rect(50, y, 500, 22)
    .fill();
    
  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .fillColor('#FFFFFF')
    .text(title, 60, y + 5, { width: 480 });

  // Cadre pour les informations
  doc
    .roundedRect(50, y + 22, 500, boxHeight, 0)
    .lineWidth(0.5)
    .stroke('#E0E0E0')
    .fill('#F8F9FA');
    
  return y + boxHeight + 15;
}

/**
 * Génère un PDF pour un acte de décès
 * @param {Object} data - Les données de l'acte de décès
 * @returns {Promise<Buffer>} Le buffer du PDF généré
 */
const generateDecesPdf = (data) => {
  return new Promise((resolve, reject) => {
    console.log('Début de la génération du PDF de décès');
    
    try {
      // Créer un nouveau document PDF
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        autoFirstPage: true
      });
      
      // Buffer pour stocker le PDF
      const chunks = [];
      
      // Gestion des événements
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('error', reject);
      doc.on('end', () => {
        console.log('PDF généré avec succès');
        resolve(Buffer.concat(chunks));
      });
      
      // Générer l'en-tête du document
      generateHeader(doc, 'ACTE DE DÉCÈS');
      
      // Position Y initiale après l'en-tête
      let y = 120;
      
      // 1. Informations administratives
      doc
        .font('Helvetica-Bold')
        .fontSize(11)
        .fillColor('#002689')
        .text('INFORMATIONS ADMINISTRATIVES', 50, y, { width: 500 });
        
      // Cadre pour les informations administratives
      const adminBoxHeight = 45;
      doc
        .roundedRect(50, y + 15, 500, adminBoxHeight, 3)
        .lineWidth(0.5)
        .stroke('#E0E0E0')
        .fill('#F8F9FA');
        
      // Contenu des informations administratives
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#333333')
        .text(`N°: ${data.numeroActe || 'N/A'}`, 60, y + 25, { width: 180, lineBreak: false })
        .text(`Mairie: ${data.mairie || 'N/A'}`, 250, y + 25, { width: 140, lineBreak: false })
        .text(`Date: ${data.dateEnregistrement || 'N/A'}`, 400, y + 25, { width: 140, lineBreak: false });
        
      // Mettre à jour la position Y pour la section suivante
      y += adminBoxHeight + 20;
      
      // 2. Informations du défunt
      doc
        .font('Helvetica-Bold')
        .fontSize(11)
        .fillColor('#002689')
        .text('INFORMATIONS SUR LE DÉFUNT', 50, y, { width: 500 });
        
      // Cadre pour les informations du défunt
      const defuntBoxHeight = 120;
      doc
        .roundedRect(50, y + 15, 500, defuntBoxHeight, 0)
        .lineWidth(0.5)
        .stroke('#E0E0E0')
        .fill('#FFFFFF');
        
      // Contenu des informations du défunt
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#333333')
        .text('Nom:', 60, y + 25, { width: 100, continued: true })
        .font('Helvetica-Bold').text(data.nomDefunt || 'N/A').font('Helvetica')
        
        .text('Prénoms:', 300, y + 25, { width: 100, continued: true })
        .font('Helvetica-Bold').text(data.prenomsDefunt || 'N/A').font('Helvetica')
        
        .text('Né(e) le:', 60, y + 45, { width: 100, continued: true })
        .font('Helvetica-Bold').text(data.dateNaissanceDefunt || 'N/A').font('Helvetica')
        
        .text('À:', 220, y + 45, { width: 40, continued: true })
        .font('Helvetica-Bold').text(data.lieuNaissanceDefunt || 'N/A').font('Helvetica')
        
        .text('Profession:', 60, y + 65, { width: 100, continued: true })
        .font('Helvetica-Bold').text(data.professionDefunt || 'N/A').font('Helvetica')
        
        .text('Domicile:', 300, y + 65, { width: 100, continued: true })
        .font('Helvetica-Bold').text(data.domicileDefunt || 'N/A').font('Helvetica')
        
        .text('Décédé(e) le:', 60, y + 85, { width: 100, continued: true })
        .font('Helvetica-Bold').text(data.dateDeces || 'N/A').font('Helvetica')
        
        .text('À:', 220, y + 85, { width: 40, continued: true })
        .font('Helvetica-Bold').text(data.lieuDeces || 'N/A').font('Helvetica')
        
        .text('Heure:', 60, y + 105, { width: 100, continued: true })
        .font('Helvetica-Bold').text(data.heureDeces || 'Non spécifiée').font('Helvetica')
        
        .text('Cause:', 300, y + 105, { width: 80, continued: true })
        .font('Helvetica-Bold').text(data.causeDeces || 'Non spécifiée').font('Helvetica');
        
      // Mettre à jour la position Y pour la section suivante
      y += defuntBoxHeight + 20;
      
      // 3. Informations du déclarant (si disponible)
      if (data.declarant) {
        doc
          .font('Helvetica-Bold')
          .fontSize(11)
          .fillColor('#002689')
          .text('INFORMATIONS DU DÉCLARANT', 50, y, { width: 500 });
          
        // Cadre pour les informations du déclarant
        const declarantBoxHeight = 90;
        doc
          .roundedRect(50, y + 15, 500, declarantBoxHeight, 0)
          .lineWidth(0.5)
          .stroke('#E0E0E0')
          .fill('#F8F9FA');
          
        // Contenu des informations du déclarant
        doc
          .font('Helvetica')
          .fontSize(9)
          .fillColor('#333333')
          .text('Nom:', 60, y + 25, { width: 100, continued: true })
          .font('Helvetica-Bold').text(data.declarant.nom || 'N/A').font('Helvetica')
          
          .text('Prénoms:', 300, y + 25, { width: 100, continued: true })
          .font('Helvetica-Bold').text(data.declarant.prenoms || 'N/A').font('Helvetica')
          
          .text('Né(e) le:', 60, y + 45, { width: 100, continued: true })
          .font('Helvetica-Bold').text(data.declarant.dateNaissance || 'N/A').font('Helvetica')
          
          .text('À:', 220, y + 45, { width: 40, continued: true })
          .font('Helvetica-Bold').text(data.declarant.lieuNaissance || 'N/A').font('Helvetica')
          
          .text('Profession:', 60, y + 65, { width: 100, continued: true })
          .font('Helvetica-Bold').text(data.declarant.profession || 'N/A').font('Helvetica')
          
          .text('Domicile:', 300, y + 65, { width: 100, continued: true })
          .font('Helvetica-Bold').text(data.declarant.domicile || 'N/A').font('Helvetica')
          
          .text('Lien avec le défunt:', 60, y + 85, { width: 120, continued: true })
          .font('Helvetica-Bold').text(data.declarant.lien || 'Non spécifié').font('Helvetica');
          
        // Mettre à jour la position Y pour la section suivante
        y += declarantBoxHeight + 20;
      }
      
      // 4. Signature
      doc
        .moveTo(100, y)
        .lineTo(500, y)
        .lineWidth(0.5)
        .stroke('#CCCCCC');
        
      // Texte de signature
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#666666')
        .text(`Fait à ${data.ville || data.mairie || 'N/A'}, le ${data.dateEnregistrement || ''}`, 300, y + 5, { align: 'right' })
        .font('Helvetica-Bold')
        .text('Le Maire', 450, y + 20, { align: 'right' })
        .font('Helvetica')
        .fontSize(8)
        .fillColor('#999999')
        .text('Cachet et signature', 450, y + 35, { align: 'right' });
        
      // Numéro de page
      const pageNumber = `Page 1/1`;
      doc
        .fontSize(8)
        .fillColor('#999999')
        .text(pageNumber, 0, 800, { align: 'center', width: 600 });
      
      // Finaliser le document
      doc.end();
      
    } catch (error) {
      console.error('Erreur lors de la génération du PDF de décès:', error);
      reject(error);
    }
  });
};

/**
 * Génère un PDF en fonction du type de document
 * @param {string} type - Le type de document (naissance, mariage, deces, etc.)
 * @param {Object} data - Les données du document
 * @returns {Promise<Buffer>} Le buffer du PDF généré
 */
const generatePdf = async (type, data) => {
  try {
    switch (type.toLowerCase()) {
      case 'deces':
        return await generateDecesPdf(data);
      default:
        throw new Error('Type de document non pris en charge');
    }
  } catch (error) {
    logger.error('Erreur lors de la génération du PDF', { error, type });
    throw error;
  }
};

// Exporter les fonctions
module.exports = {
  generateDecesPdf,
  generatePdf,
  generateHeader,
  generatePersonneSection
};
