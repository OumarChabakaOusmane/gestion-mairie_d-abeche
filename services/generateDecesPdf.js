const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const logger = require('../config/logger');

/**
 * Génère un PDF pour un acte de décès
 * @param {Object} data - Les données de l'acte de décès
 * @returns {Promise<Buffer>} Le buffer du PDF généré
 */
const generateDecesPdf = (data) => {
  return new Promise((resolve, reject) => {
    const log = (message, meta = {}) => {
      console.log(`[PDF Deces] ${message}`, meta);
    };

    log('Début de la génération du PDF de décès', { data: JSON.stringify(data).substring(0, 200) + '...' });

    try {
      // Créer un nouveau document PDF
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
        bufferPages: true
      });

      // Pour collecter les données du PDF
      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => {
        const result = Buffer.concat(chunks);
        log('PDF de décès généré avec succès', { size: result.length });
        resolve(result);
      });

      // Gestion des erreurs
      doc.on('error', (err) => {
        log('Erreur lors de la génération du PDF de décès', { error: err.message });
        reject(err);
      });

      // Ajouter le contenu du PDF
      doc
        .fontSize(16)
        .text('ACTE DE DÉCÈS', { align: 'center' })
        .moveDown(0.5);

      // Informations du défunt
      doc
        .fontSize(12)
        .text('INFORMATIONS DU DÉFUNT', { underline: true })
        .moveDown(0.5);

      if (data.defunt) {
        doc
          .fontSize(10)
          .text(`Nom: ${data.defunt.nom || 'Non spécifié'}`)
          .text(`Prénom(s): ${data.defunt.prenom || 'Non spécifié'}`)
          .text(`Date de naissance: ${data.defunt.dateNaissance || 'Non spécifiée'}`)
          .text(`Lieu de naissance: ${data.defunt.lieuNaissance || 'Non spécifié'}`)
          .text(`Date du décès: ${data.dateDeces || 'Non spécifiée'}`)
          .text(`Lieu du décès: ${data.lieuDeces || 'Non spécifié'}`)
          .text(`Profession: ${data.defunt.profession || 'Non spécifiée'}`)
          .text(`Domicile: ${data.defunt.adresse || 'Non spécifié'}`)
          .moveDown();
      }

      // Informations des parents
      if (data.parents) {
        doc
          .fontSize(12)
          .text('INFORMATIONS DES PARENTS', { underline: true })
          .moveDown(0.5)
          .fontSize(10);

        if (data.parents.pere) {
          doc
            .text(`Père: ${data.parents.pere.nom || 'Non spécifié'} ${data.parents.pere.prenom || ''}`);
        }

        if (data.parents.mere) {
          doc
            .text(`Mère: ${data.parents.mere.nom || 'Non spécifiée'} ${data.parents.mere.prenom || ''}`);
        }

        doc.moveDown();
      }

      // Informations complémentaires
      if (data.observations) {
        doc
          .fontSize(12)
          .text('OBSERVATIONS', { underline: true })
          .moveDown(0.5)
          .fontSize(10)
          .text(data.observations)
          .moveDown();
      }

      // Pied de page
      const footerY = 750;
      doc
        .moveTo(50, footerY)
        .lineTo(550, footerY)
        .stroke()
        .fontSize(8)
        .text(`Document généré le ${new Date().toLocaleDateString('fr-FR')}`, 50, footerY + 10);

      // Finaliser le document
      doc.end();

    } catch (error) {
      log('Erreur critique lors de la génération du PDF de décès', {
        error: error.message,
        stack: error.stack
      });
      reject(error);
    }
  });
};

module.exports = generateDecesPdf;
