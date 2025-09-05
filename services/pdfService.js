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
 * Génère un PDF pour un acte de divorce
 * @param {Object} data - Les données de l'acte de divorce
 * @returns {Promise<Buffer>} - Le buffer du PDF généré
 */
const generateDivorcePdf = async (data) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, bufferPages: true });
      const buffers = [];
      
      // Collecter les chunks de données
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      // En-tête du document
      generateHeader(doc);
      
      // Titre du document
      doc
        .fontSize(16)
        .font('Helvetica-Bold')
        .text('ACTE DE DIVORCE', { align: 'center', underline: true })
        .moveDown(2);
      
      // Informations de l'acte
      doc
        .fontSize(12)
        .font('Helvetica')
        .text(`Numéro d'acte: ${data.numeroActe}`, { align: 'left' })
        .text(`Date d'établissement: ${new Date(data.dateEtablissement).toLocaleDateString('fr-FR')}`, { align: 'left' })
        .text(`Lieu d'établissement: ${data.lieuEtablissement}`, { align: 'left' })
        .moveDown();
      
      // Informations sur le mariage
      doc
        .font('Helvetica-Bold')
        .text('INFORMATIONS SUR LE MARIAGE', { underline: true })
        .moveDown(0.5);
      
      doc
        .font('Helvetica')
        .text(`Date du mariage: ${new Date(data.dateMariage).toLocaleDateString('fr-FR')}`)
        .text(`Lieu du mariage: ${data.lieuMariage}`)
        .text(`Régime matrimonial: ${data.regimeMatrimonial}`)
        .moveDown();
      
      // Informations sur l'époux
      generatePersonneSection(doc, 'ÉPOUX', data.epoux);
      
      // Informations sur l'épouse
      generatePersonneSection(doc, 'ÉPOUSE', data.epouse);
      
      // Informations sur le divorce
      doc
        .addPage()
        .font('Helvetica-Bold')
        .fontSize(14)
        .text('INFORMATIONS SUR LE DIVORCE', { align: 'center', underline: true })
        .moveDown();
      
      doc
        .font('Helvetica')
        .fontSize(12)
        .text(`Date du divorce: ${new Date(data.dateDivorce).toLocaleDateString('fr-FR')}`)
        .text(`Type de divorce: ${data.typeDivorce}`)
        .text(`Motifs: ${data.motifs}`)
        .moveDown();
      
      // Garde des enfants
      if (data.gardeEnfants && data.gardeEnfants.length > 0) {
        doc
          .font('Helvetica-Bold')
          .text('GARDE DES ENFANTS', { underline: true })
          .moveDown(0.5);
        
        data.gardeEnfants.forEach((enfant, index) => {
          doc
            .font('Helvetica')
            .text(`${index + 1}. ${enfant.prenom} ${enfant.nom}`)
            .text(`   Né(e) le: ${new Date(enfant.dateNaissance).toLocaleDateString('fr-FR')}`)
            .text(`   Garde: ${enfant.garde}`)
            .moveDown(0.5);
        });
      }
      
      // Signature
      doc
        .moveTo(50, doc.y + 20)
        .lineTo(550, doc.y + 20)
        .stroke()
        .fontSize(10)
        .text('Signature et cachet de l\'officier d\'état civil', 50, doc.y + 30);
      
      doc.end();
    } catch (error) {
      logger.error('Erreur lors de la génération du PDF de divorce', { error: error.message });
      reject(error);
    }
  });
};

/**
 * Génère un PDF pour un engagement de concubinage
 * @param {Object} data - Les données de l'engagement de concubinage
 * @returns {Promise<Buffer>} - Le buffer du PDF généré
 */
const generateEngagementConcubinagePdf = async (data) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, bufferPages: true });
      const buffers = [];
      
      // Collecter les chunks de données
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      // En-tête du document
      generateHeader(doc);
      
      // Titre du document
      doc
        .fontSize(16)
        .font('Helvetica-Bold')
        .text('DECLARATION DE CONCUBINAGE', { align: 'center', underline: true })
        .moveDown(2);
      
      // Informations de l'acte
      doc
        .fontSize(12)
        .font('Helvetica')
        .text(`Numéro d'acte: ${data.numeroActe}`, { align: 'left' })
        .text(`Date d'établissement: ${new Date(data.dateEtablissement).toLocaleDateString('fr-FR')}`, { align: 'left' })
        .text(`Lieu d'établissement: ${data.lieuEtablissement}`, { align: 'left' })
        .moveDown();
      
      // Informations sur le concubinage
      doc
        .font('Helvetica-Bold')
        .text('INFORMATIONS SUR LE CONCUBINAGE', { underline: true })
        .moveDown(0.5);
      
      doc
        .font('Helvetica')
        .text(`Date de début du concubinage: ${new Date(data.dateDebutConcubinage).toLocaleDateString('fr-FR')}`)
        .text(`Adresse commune: ${data.adresseCommune}`)
        .text(`Régime des biens: ${data.regimeBiens}`);
      
      if (data.detailsRegimeBiens) {
        doc.text(`Détails du régime des biens: ${data.detailsRegimeBiens}`);
      }
      
      doc.moveDown();
      
      // Informations sur le premier concubin
      generatePersonneSection(doc, 'PREMIER CONJOINT', data.concubin1);
      
      // Informations sur le deuxième concubin
      generatePersonneSection(doc, 'DEUXIÈME CONJOINT', data.concubin2);
      
      // Témoins
      if (data.temoins && data.temoins.length > 0) {
        doc
          .addPage()
          .font('Helvetica-Bold')
          .text('TÉMOINS', { align: 'center', underline: true })
          .moveDown(0.5);
        
        data.temoins.forEach((temoin, index) => {
          doc
            .font('Helvetica')
            .text(`Témoin ${index + 1}: ${temoin.prenoms} ${temoin.nom}`)
            .text(`   Né(e) le: ${new Date(temoin.dateNaissance).toLocaleDateString('fr-FR')}`)
            .text(`   Adresse: ${temoin.adresse}`)
            .text(`   Pièce d'identité: ${temoin.typePieceIdentite} n°${temoin.numeroPieceIdentite}`)
            .moveDown(0.5);
        });
      }
      
      // Observations
      if (data.observations) {
        doc
          .font('Helvetica-Bold')
          .text('OBSERVATIONS', { underline: true })
          .moveDown(0.5);
        
        doc
          .font('Helvetica')
          .text(data.observations, { width: 500 });
      }
      
      // Signature
      doc
        .moveTo(50, doc.y + 20)
        .lineTo(550, doc.y + 20)
        .stroke()
        .fontSize(10)
        .text('Signature et cachet de l\'officier d\'état civil', 50, doc.y + 30);
      
      doc.end();
    } catch (error) {
      logger.error('Erreur lors de la génération du PDF d\'engagement de concubinage', { error: error.message });
      reject(error);
    }
  });
};

/**
 * Génère l'en-tête du document
 * @param {PDFDocument} doc - L'instance PDFKit
 */
const generateHeader = (doc) => {
  doc
    .image('public/images/logo.png', 50, 45, { width: 50 })
    .fillColor('#444444')
    .fontSize(20)
    .text('RÉPUBLIQUE DU TCHAD', 110, 50)
    .fontSize(10)
    .text('Unité - Travail - Progrès', 110, 75)
    .moveDown(3);
  
  // Ligne de séparation
  doc
    .strokeColor('#aaaaaa')
    .lineWidth(1)
    .moveTo(50, 100)
    .lineTo(550, 100)
    .stroke();
};

/**
 * Génère une section pour une personne (époux, épouse, concubin)
 * @param {PDFDocument} doc - L'instance PDFKit
 * @param {string} title - Le titre de la section
 * @param {Object} personne - Les informations de la personne
 */
const generatePersonneSection = (doc, title, personne) => {
  doc
    .addPage()
    .font('Helvetica-Bold')
    .fontSize(14)
    .text(title, { align: 'center', underline: true })
    .moveDown(0.5);
  
  doc
    .font('Helvetica')
    .fontSize(12)
    .text(`Nom: ${personne.nom}`)
    .text(`Prénoms: ${personne.prenoms}`)
    .text(`Date de naissance: ${new Date(personne.dateNaissance).toLocaleDateString('fr-FR')}`)
    .text(`Lieu de naissance: ${personne.lieuNaissance}`)
    .text(`Nationalité: ${personne.nationalite}`)
    .text(`Profession: ${personne.profession || 'Non renseignée'}`)
    .text(`Adresse: ${personne.adresse}`)
    .text(`Type de pièce d'identité: ${personne.typePieceIdentite}`)
    .text(`Numéro de pièce: ${personne.numeroPieceIdentite}`)
    .text(`Situation matrimoniale: ${personne.situationMatrimoniale}`);
  
  if (personne.situationMatrimoniale === 'marié(e)' && personne.nomConjoint) {
    doc.text(`Nom du conjoint: ${personne.nomConjoint}`);
    
    if (personne.dateMariage) {
      doc.text(`Date de mariage: ${new Date(personne.dateMariage).toLocaleDateString('fr-FR')}`);
    }
  }
  
  doc.moveDown();
};

/**
 * Fonction principale pour générer un PDF en fonction du type
 * @param {string} type - Le type de document ('divorce' ou 'engagement-concubinage')
 * @param {Object} data - Les données du document
 * @returns {Promise<Buffer>} - Le buffer du PDF généré
 */
const generatePdf = async (type, data) => {
  try {
    switch (type) {
      case 'divorce':
        return await generateDivorcePdf(data);
      case 'engagement-concubinage':
        return await generateEngagementConcubinagePdf(data);
      default:
        throw new Error('Type de document non pris en charge');
    }
  } catch (error) {
    logger.error('Erreur lors de la génération du PDF', { 
      type, 
      error: error.message,
      stack: error.stack 
    });
    throw error;
  }
};

module.exports = {
  generatePdf,
  generateDivorcePdf,
  generateEngagementConcubinagePdf
};
