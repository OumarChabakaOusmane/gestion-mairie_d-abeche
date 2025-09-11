const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const logger = require('../config/logger');

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
    const log = (message, meta = {}) => {
      console.log(`[PDF Deces] ${message}`, meta);
      logger.info(`[PDF Deces] ${message}`, meta);
    };
    
    log('Début de la génération du PDF de décès', { data: JSON.stringify(data).substring(0, 500) });
    
    if (!data) {
      const error = new Error('Aucune donnée fournie pour la génération du PDF');
      log('Erreur: Aucune donnée fournie');
      return reject(error);
    }
    
    // Vérification des champs obligatoires
    const requiredFields = [
      'numeroActe', 'dateEnregistrement', 'mairie', 
      'nomDefunt', 'prenomsDefunt', 'dateDeces', 'lieuDeces'
    ];
    
    const missingFields = requiredFields.filter(field => !data[field]);
    if (missingFields.length > 0) {
      const error = new Error(`Champs manquants: ${missingFields.join(', ')}`);
      log('Erreur de validation des données', { missingFields });
      return reject(error);
    }
    
    try {
      // Créer un nouveau document PDF avec des paramètres optimisés
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        bufferPages: true,
        autoFirstPage: false
      });
      
      const chunks = [];
      let hasError = false;
      
      // Gestion des événements
      doc.on('data', chunk => {
        try {
          chunks.push(chunk);
        } catch (err) {
          log('Erreur lors de la récupération des données du PDF', { error: err.message });
          hasError = true;
          reject(new Error('Erreur lors de la génération du contenu du PDF'));
        }
      });
      
      doc.on('end', () => {
        if (hasError) return;
        try {
          log('PDF généré avec succès', { bufferSize: chunks.reduce((a, b) => a + b.length, 0) });
          resolve(Buffer.concat(chunks));
        } catch (err) {
          log('Erreur lors de la création du buffer final', { error: err.message, stack: err.stack });
          reject(new Error('Erreur lors de la création du PDF'));
        }
      });
      
      doc.on('error', (err) => {
        hasError = true;
        log('Erreur PDFKit', { error: err.message, stack: err.stack });
        reject(new Error('Erreur lors de la génération du PDF'));
      });
      
      // Création de la première page
      doc.addPage();
      
      // En-tête avec gestion d'erreur
      try {
        generateHeader(doc, 'ACTE DE DÉCÈS');
      } catch (headerErr) {
        log('Erreur lors de la génération de l\'en-tête', { error: headerErr.message });
        doc.text('ACTE DE DÉCÈS', { align: 'center', fontSize: 16 });
      }
      
      // Fonction utilitaire sécurisée pour ajouter une ligne
      const addLine = (label, value, y) => {
        try {
          doc
            .fontSize(10)
            .font('Helvetica')
            .text(label || '', 50, y, { width: 150, continued: true })
            .text(':', 200, y, { width: 10, continued: true })
            .font('Helvetica-Bold')
            .text(String(value || 'Non spécifié').substring(0, 100), 220, y, { width: 300 });
          return y + 20;
        } catch (err) {
          log('Erreur lors de l\'ajout d\'une ligne', { label, value, error: err.message });
          return y + 20; // Continue malgré l'erreur
        }
      };
      
      // Position Y initiale avec marge
      let y = 100;
      
      try {
        // Section Informations administratives
        doc.fontSize(12).font('Helvetica-Bold').text('INFORMATIONS ADMINISTRATIVES', 50, y);
        y = addLine('N\'acte', data.numeroActe, y + 20);
        y = addLine('Mairie', data.mairie, y);
        y = addLine('Date d\'enregistrement', data.dateEnregistrement, y);
        
        // Section Informations du défunt
        y += 10;
        doc.fontSize(12).text('INFORMATIONS SUR LE DÉFUNT', 50, y);
        y = addLine('Nom', data.nomDefunt, y + 20);
        y = addLine('Prénoms', data.prenomsDefunt, y);
        y = addLine('Date de naissance', data.dateNaissanceDefunt, y);
        y = addLine('Lieu de naissance', data.lieuNaissanceDefunt, y);
        y = addLine('Profession', data.professionDefunt, y);
        y = addLine('Domicile', data.domicileDefunt, y);
        y = addLine('Date du décès', data.dateDeces, y);
        y = addLine('Heure du décès', data.heureDeces, y);
        y = addLine('Lieu du décès', data.lieuDeces, y);
        y = addLine('Cause du décès', data.causeDeces, y);
        
        // Section Informations du déclarant
        if (data.nomDeclarant || data.prenomsDeclarant) {
          y += 10;
          doc.fontSize(12).text('INFORMATIONS DU DÉCLARANT', 50, y);
          y = addLine('Nom', data.nomDeclarant, y + 20);
          y = addLine('Prénoms', data.prenomsDeclarant, y);
          y = addLine('Date de naissance', data.dateNaissanceDeclarant, y);
          y = addLine('Lieu de naissance', data.lieuNaissanceDeclarant, y);
          y = addLine('Profession', data.professionDeclarant, y);
          y = addLine('Domicile', data.domicileDeclarant, y);
          y = addLine('Lien avec le défunt', data.lienDeclarant, y);
        }
        
        // Pied de page avec gestion d'erreur
        try {
          doc
            .fontSize(8)
            .font('Helvetica')
            .text(`Document généré le ${new Date().toLocaleDateString('fr-FR')}`, 50, 750);
        } catch (footerErr) {
          log('Erreur lors de l\'ajout du pied de page', { error: footerErr.message });
        }
        
      } catch (contentErr) {
        log('Erreur lors de la génération du contenu', { error: contentErr.message, stack: contentErr.stack });
        // Essayer d'ajouter un message d'erreur dans le PDF
        try {
          doc.fontSize(10).text('Erreur lors de la génération du contenu du PDF', 50, 100);
        } catch (e) {}
      }
      
      // Finaliser le document
      doc.end();
      
    } catch (error) {
      log('Erreur critique non gérée', { error: error.message, stack: error.stack });
      reject(new Error(`Erreur lors de la génération du PDF: ${error.message}`));
    }
  });
};

// Importer la fonction de génération des actes de naissance
const { generateNaissancePdf } = require('./pdfServiceNew.js');

/**
 * Génère un PDF pour un engagement de concubinage
 * @param {Object} data - Les données de l'engagement de concubinage
 * @returns {Promise<Buffer>} Le buffer du PDF généré
 */
const generateEngagementConcubinagePdf = (data) => {
  return new Promise((resolve, reject) => {
    const log = (message, meta = {}) => {
      console.log(`[PDF Engagement] ${message}`, meta);
      logger.info(`[PDF Engagement] ${message}`, meta);
    };
    
    log('Début de la génération du PDF d\'engagement de concubinage', { 
      data: JSON.stringify(data).substring(0, 500) 
    });
    
    if (!data) {
      const error = new Error('Aucune donnée fournie pour la génération du PDF');
      log('Erreur: Aucune donnée fournie');
      return reject(error);
    }
    
    // Vérification des champs obligatoires
    const requiredFields = [
      'numeroActe', 'dateDebut', 'mairie', 'ville',
      'concubin1.nom', 'concubin1.prenom', 'concubin2.nom', 'concubin2.prenom',
      'lieuDebut'
    ];
    
    const missingFields = requiredFields.filter(field => {
      const parts = field.split('.');
      let value = data;
      for (const part of parts) {
        value = value?.[part];
        if (value === undefined) return true;
      }
      return !value;
    });
    
    if (missingFields.length > 0) {
      const error = new Error(`Champs manquants: ${missingFields.join(', ')}`);
      log('Erreur de validation des données', { missingFields });
      return reject(error);
    }
    
    try {
      // Créer un nouveau document PDF avec des paramètres optimisés
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        bufferPages: true,
        autoFirstPage: false
      });
      
      const chunks = [];
      let hasError = false;
      
      // Gestion des événements
      doc.on('data', chunk => {
        try {
          chunks.push(chunk);
        } catch (err) {
          log('Erreur lors de la récupération des données du PDF', { error: err.message });
          hasError = true;
          reject(new Error('Erreur lors de la génération du contenu du PDF'));
        }
      });
      
      doc.on('end', () => {
        if (hasError) return;
        try {
          log('PDF généré avec succès', { bufferSize: chunks.reduce((a, b) => a + b.length, 0) });
          resolve(Buffer.concat(chunks));
        } catch (err) {
          log('Erreur lors de la création du buffer final', { error: err.message, stack: err.stack });
          reject(new Error('Erreur lors de la création du PDF'));
        }
      });
      
      doc.on('error', (err) => {
        hasError = true;
        log('Erreur PDFKit', { error: err.message, stack: err.stack });
        reject(new Error('Erreur lors de la génération du PDF'));
      });
      
      // Création de la première page
      doc.addPage();
      
      // En-tête avec gestion d'erreur
      try {
        generateHeader(doc, 'ACTE D\'ENGAGEMENT DE CONCUBINAGE');
      } catch (headerErr) {
        log('Erreur lors de la génération de l\'en-tête', { error: headerErr.message });
        doc.text('ACTE D\'ENGAGEMENT DE CONCUBINAGE', { align: 'center', fontSize: 16 });
      }
      
      // Fonction utilitaire sécurisée pour ajouter une ligne
      const addLine = (label, value, y) => {
        try {
          doc
            .fontSize(10)
            .font('Helvetica')
            .text(label || '', 50, y, { width: 150, continued: true })
            .text(':', 200, y, { width: 10, continued: true })
            .font('Helvetica-Bold')
            .text(String(value || 'Non spécifié').substring(0, 100), 220, y, { width: 300 });
          return y + 20;
        } catch (err) {
          log('Erreur lors de l\'ajout d\'une ligne', { label, value, error: err.message });
          return y + 20; // Continue malgré l'erreur
        }
      };
      
      // Position Y initiale avec marge
      let y = 100;
      
      try {
        // Section Informations administratives
        doc.fontSize(12).font('Helvetica-Bold').text('INFORMATIONS ADMINISTRATIVES', 50, y);
        y = addLine('N° d\'acte', data.numeroActe, y + 20);
        y = addLine('Mairie', `${data.mairie} (${data.ville})`, y);
        y = addLine('Date de l\'engagement', data.dateDebut, y);
        y = addLine('Statut', data.statut || 'Actif', y);
        
        // Section Premier concubin
        y += 10;
        doc.fontSize(12).text('PREMIER CONJOINT', 50, y);
        y = addLine('Nom', data.concubin1.nom, y + 20);
        y = addLine('Prénom', data.concubin1.prenom, y);
        y = addLine('Date de naissance', data.concubin1.dateNaissance, y);
        y = addLine('Lieu de naissance', data.concubin1.lieuNaissance, y);
        y = addLine('Profession', data.concubin1.profession, y);
        y = addLine('Adresse', data.concubin1.adresse, y);
        y = addLine('Nationalité', data.concubin1.nationalite, y);
        y = addLine('Type de pièce', data.concubin1.typePiece, y);
        y = addLine('N° de pièce', data.concubin1.numeroPiece, y);
        
        // Section Deuxième concubin
        y += 10;
        doc.fontSize(12).text('DEUXIÈME CONJOINT', 50, y);
        y = addLine('Nom', data.concubin2.nom, y + 20);
        y = addLine('Prénom', data.concubin2.prenom, y);
        y = addLine('Date de naissance', data.concubin2.dateNaissance, y);
        y = addLine('Lieu de naissance', data.concubin2.lieuNaissance, y);
        y = addLine('Profession', data.concubin2.profession, y);
        y = addLine('Adresse', data.concubin2.adresse, y);
        y = addLine('Nationalité', data.concubin2.nationalite, y);
        y = addLine('Type de pièce', data.concubin2.typePiece, y);
        y = addLine('N° de pièce', data.concubin2.numeroPiece, y);
        
        // Section Témoins
        if (data.temoins && data.temoins.length > 0) {
          y += 10;
          doc.fontSize(12).text('TÉMOINS', 50, y);
          
          data.temoins.forEach((temoin, index) => {
            if (index > 0) y += 10;
            y = addLine(`Témoin ${index + 1}`, 
              `${temoin.nom || ''} ${temoin.prenom || ''}`.trim(), 
              y + (index === 0 ? 20 : 0)
            );
            if (temoin.profession) y = addLine('Profession', temoin.profession, y);
            if (temoin.adresse) y = addLine('Adresse', temoin.adresse, y);
            if (temoin.residence) y = addLine('Résidence', temoin.residence, y);
          });
        }
        
        // Section Informations complémentaires
        y += 10;
        doc.fontSize(12).text('INFORMATIONS COMPLÉMENTAIRES', 50, y);
        y = addLine('Lieu de l\'engagement', data.lieuDebut, y + 20);
        y = addLine('Officier d\'état civil', data.officierEtatCivil, y);
        y = addLine('Date de création', data.createdAt, y);
        y = addLine('Créé par', data.createdBy, y);
        
        if (data.observations) {
          y += 10;
          doc.fontSize(12).text('OBSERVATIONS', 50, y);
          y += 20;
          doc.fontSize(10).text(data.observations, 50, y, { width: 500 });
          y += 20;
        }
        
        // Pied de page avec gestion d'erreur
        try {
          doc
            .fontSize(8)
            .font('Helvetica')
            .text(`Document généré le ${new Date().toLocaleDateString('fr-FR')}`, 50, 750);
        } catch (footerErr) {
          log('Erreur lors de l\'ajout du pied de page', { error: footerErr.message });
        }
        
      } catch (contentErr) {
        log('Erreur lors de la génération du contenu', { error: contentErr.message, stack: contentErr.stack });
        // Essayer d'ajouter un message d'erreur dans le PDF
        try {
          doc.fontSize(10).text('Erreur lors de la génération du contenu du PDF', 50, 100);
        } catch (e) {}
      }
      
      // Finaliser le document
      doc.end();
      
    } catch (error) {
      log('Erreur critique non gérée', { error: error.message, stack: error.stack });
      reject(new Error(`Erreur lors de la génération du PDF: ${error.message}`));
    }
  });
};

/**
 * Génère un PDF en fonction du type de document
 * @param {string} type - Le type de document (naissance, mariage, deces, engagement-concubinage, etc.)
 * @param {Object} data - Les données du document
 * @returns {Promise<Buffer>} Le buffer du PDF généré
 */
const generatePdf = async (type, data) => {
  console.log(`[PDF Service] Début génération PDF de type: ${type}`);
  console.log(`[PDF Service] Données reçues:`, JSON.stringify(data, null, 2).substring(0, 500) + '...');
  
  try {
    let result;
    
    switch (type.toLowerCase()) {
      case 'deces':
        console.log('[PDF Service] Appel de generateDecesPdf');
        result = await generateDecesPdf(data);
        break;
      case 'naissance':
        console.log('[PDF Service] Appel de generateNaissancePdf');
        result = await generateNaissancePdf(data);
        break;
      case 'engagement-concubinage':
        console.log('[PDF Service] Appel de generateEngagementConcubinagePdf');
        result = await generateEngagementConcubinagePdf(data);
        break;
      default:
        const errorMsg = `Type de document non pris en charge: ${type}`;
        console.error(`[PDF Service] ${errorMsg}`);
        throw new Error(errorMsg);
    }
    
    if (!result || !(result instanceof Buffer)) {
      const errorMsg = 'Le résultat de la génération du PDF est invalide';
      console.error(`[PDF Service] ${errorMsg}`, { 
        type: typeof result,
        isBuffer: Buffer.isBuffer(result)
      });
      throw new Error(errorMsg);
    }
    
    console.log(`[PDF Service] PDF généré avec succès (${result.length} octets)`);
    return result;
    
  } catch (error) {
    console.error('[PDF Service] Erreur critique lors de la génération du PDF:', {
      type,
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
};

// Exporter les fonctions
module.exports = {
  generateDecesPdf,
  generatePdf,
  generateHeader,
  generatePersonneSection,
  generateEngagementConcubinagePdf
};
