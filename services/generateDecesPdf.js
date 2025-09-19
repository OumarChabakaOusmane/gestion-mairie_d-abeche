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

      // En-tête du document
      doc
        .image(path.join(__dirname, '../public/images/flag-tchad.svg'), 50, 50, { width: 60 })
        .fontSize(16)
        .font('Helvetica-Bold')
        .text('RÉPUBLIQUE DU TCHAD', { align: 'center' })
        .font('Helvetica')
        .fontSize(12)
        .text('Unité - Travail - Progrès', { align: 'center' })
        .moveDown(1);

      // Titre du document
      doc
        .fontSize(18)
        .font('Helvetica-Bold')
        .text('ACTE DE DÉCÈS', { align: 'center' })
        .moveDown(0.5);

      // Numéro d'acte et date d'enregistrement
      doc
        .fontSize(10)
        .text(`N°: ${data.numeroActe || 'Non spécifié'}`, { align: 'right' })
        .text(`Enregistré le: ${data.dateEnregistrement || new Date().toLocaleDateString('fr-FR')}`, { align: 'right' })
        .moveDown(1);

      // Section Informations du défunt
      doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .text('I. INFORMATIONS DU DÉFUNT', { underline: true })
        .moveDown(0.5)
        .font('Helvetica')
        .fontSize(10);

      // Informations personnelles du défunt
      doc
        .text(`• Nom: ${data.nomDefunt || 'Non spécifié'}`)
        .text(`• Prénom(s): ${data.prenomsDefunt || 'Non spécifié'}`)
        .text(`• Date de naissance: ${data.dateNaissanceDefunt || 'Non spécifiée'}`)
        .text(`• Lieu de naissance: ${data.lieuNaissanceDefunt || 'Non spécifié'}`)
        .text(`• Profession: ${data.professionDefunt || 'Non spécifiée'}`)
        .text(`• Dernier domicile: ${data.domicileDefunt || 'Non spécifié'}`)
        .text(`• Date du décès: ${data.dateDeces || 'Non spécifiée'}`)
        .text(`• Heure du décès: ${data.heureDeces || 'Non spécifiée'}`)
        .text(`• Lieu du décès: ${data.lieuDeces || 'Non spécifié'}`)
        .text(`• Cause du décès: ${data.causeDeces || 'Non spécifiée'}`)
        .moveDown(1);

      // Section Informations des parents
      doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .text('II. INFORMATIONS DES PARENTS', { underline: true })
        .moveDown(0.5)
        .font('Helvetica')
        .fontSize(10);

      // Informations du père
      doc
        .text('Père:')
        .text(`   • Nom: ${data.nomPere || 'Non spécifié'}`)
        .text(`   • Prénom(s): ${data.prenomsPere || 'Non spécifié'}`)
        .text(`   • Profession: ${data.professionPere || 'Non spécifiée'}`)
        .text(`   • Domicile: ${data.domicilePere || 'Non spécifié'}`)
        .moveDown(0.5);

      // Informations de la mère
      doc
        .text('Mère:')
        .text(`   • Nom: ${data.nomMere || 'Non spécifiée'}`)
        .text(`   • Prénom(s): ${data.prenomsMere || 'Non spécifiée'}`)
        .text(`   • Profession: ${data.professionMere || 'Non spécifiée'}`)
        .text(`   • Domicile: ${data.domicileMere || 'Non spécifié'}`)
        .moveDown(1);

      // Section Informations du déclarant
      doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .text('III. INFORMATIONS DU DÉCLARANT', { underline: true })
        .moveDown(0.5)
        .font('Helvetica')
        .fontSize(10);

      doc
        .text(`• Nom: ${data.nomDeclarant || 'Non spécifié'}`)
        .text(`• Prénom(s): ${data.prenomsDeclarant || 'Non spécifié'}`)
        .text(`• Date de naissance: ${data.dateNaissanceDeclarant || 'Non spécifiée'}`)
        .text(`• Lieu de naissance: ${data.lieuNaissanceDeclarant || 'Non spécifié'}`)
        .text(`• Profession: ${data.professionDeclarant || 'Non spécifiée'}`)
        .text(`• Domicile: ${data.domicileDeclarant || 'Non spécifié'}`)
        .text(`• Lien avec le défunt: ${data.lienDeclarant || 'Non spécifié'}`)
        .moveDown(1);

      // Section Mentions légales
      doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .text('MENTIONS LÉGALES', { align: 'center' })
        .font('Helvetica')
        .text('Document officiel de la République du Tchad - Toute falsification est passible de poursuites judiciaires.', { align: 'center' })
        .moveDown(0.5);

      // Pied de page
      const footerY = 750;
      doc
        .moveTo(50, footerY)
        .lineTo(550, footerY)
        .stroke()
        .fontSize(8)
        .text(`Document généré par ${data.mairie || 'la Mairie'} - ${data.ville || ''} le ${new Date().toLocaleDateString('fr-FR')}`, 50, footerY + 10);

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
