const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const logger = require('../config/logger');
const { generateNaissancePdf } = require('./pdfServiceNew');
const generateDecesPdf = require('./generateDecesPdf');

// Configuration
const CONFIG = {
  OUTPUT_DIR: path.join(__dirname, '../public/pdfs'),
  FONTS: {
    NORMAL: 'Helvetica',
    BOLD: 'Helvetica-Bold',
    ITALIC: 'Helvetica-Oblique'
  },
  COLORS: {
    PRIMARY: '#002689',    // Bleu du drapeau
    SECONDARY: '#FFD100',  // Jaune du drapeau
    ACCENT: '#CE1126',     // Rouge du drapeau
    TEXT: '#333333',
    LIGHT_BG: '#F8F9FA',
    BORDER: '#CCCCCC'
  },
  MARGINS: {
    LEFT: 50,
    RIGHT: 50,
    TOP: 40,
    BOTTOM: 40
  },
  FLAG: {
    WIDTH: 80,
    HEIGHT: 48,
    X: 50,
    Y: 40
  }
};

// Gestion des erreurs
class PdfGenerationError extends Error {
  constructor(message, code = 'PDF_GENERATION_ERROR', details = {}) {
    super(message);
    this.name = 'PdfGenerationError';
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Fonctions utilitaires
const utils = {
  // Créer le dossier de sortie s'il n'existe pas
  ensureOutputDir: () => {
    if (!fs.existsSync(CONFIG.OUTPUT_DIR)) {
      fs.mkdirSync(CONFIG.OUTPUT_DIR, { recursive: true });
    }
  },
  
  // Formater une date au format français
  formatDate: (dateStr) => {
    if (!dateStr) return 'Non spécifiée';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('fr-FR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (error) {
      return dateStr;
    }
  },
  
  // Créer un document PDF de base
  createPdfDocument: () => {
    return new PDFDocument({
      size: 'A4',
      margins: {
        top: CONFIG.MARGINS.TOP,
        bottom: CONFIG.MARGINS.BOTTOM,
        left: CONFIG.MARGINS.LEFT,
        right: CONFIG.MARGINS.RIGHT
      },
      bufferPages: true,
      autoFirstPage: false
    });
  },
  
  // Configurer les gestionnaires d'événements du document
  setupDocumentHandlers: (doc) => {
    return new Promise((resolve, reject) => {
      const chunks = [];
      let hasError = false;
      
      doc.on('data', chunk => chunks.push(chunk));
      
      doc.on('end', () => {
        if (!hasError) {
          resolve(Buffer.concat(chunks));
        }
      });
      
      doc.on('error', (err) => {
        hasError = true;
        reject(new PdfGenerationError(
          'Erreur lors de la génération du PDF',
          'PDF_GENERATION_ERROR',
          { error: err.message, stack: err.stack }
        ));
      });
    });
  }
};

// Fonctions de génération de contenu
const contentGenerators = {
  // Générer l'en-tête avec le drapeau du Tchad
  generateHeader: (doc) => {
    const { X, Y, WIDTH, HEIGHT } = CONFIG.FLAG;
    const stripeWidth = WIDTH / 3;
    
    // Dessiner le drapeau avec contour
    doc
      .rect(X, Y, WIDTH, HEIGHT)
      .fillAndStroke('white', 'black');
    
    // Bandes du drapeau
    doc
      .fillColor(CONFIG.COLORS.PRIMARY)
      .rect(X, Y, stripeWidth, HEIGHT)
      .fill()
      .fillColor(CONFIG.COLORS.SECONDARY)
      .rect(X + stripeWidth, Y, stripeWidth, HEIGHT)
      .fill()
      .fillColor(CONFIG.COLORS.ACCENT)
      .rect(X + (stripeWidth * 2), Y, stripeWidth, HEIGHT)
      .fill();
    
    // Texte de l'en-tête
    doc
      .fillColor('black')
      .font(CONFIG.FONTS.BOLD)
      .fontSize(16)
      .text('RÉPUBLIQUE DU TCHAD', 180, 50, { align: 'center', width: 300 })
      .fontSize(12)
      .text('Unité - Travail - Progrès', 180, 70, { align: 'center', width: 300 });
  },
  
  // Générer l'en-tête d'un acte
  generateActeHeader: (doc, title, data) => {
    // 1) En-tête avec drapeau
    contentGenerators.generateHeader(doc);
    
    // 2) Filigrane
    doc.save();
    doc.rotate(-45, { origin: [150, 400] });
    doc
      .font(CONFIG.FONTS.BOLD)
      .fontSize(78)
      .fillColor(CONFIG.COLORS.PRIMARY)
      .fillOpacity(0.10)
      .text('RÉPUBLIQUE DU TCHAD', 0, 350, { align: 'left' });
    doc.fillOpacity(1).restore();
    
    // 3) Numéro de document
    doc
      .font(CONFIG.FONTS.NORMAL)
      .fontSize(10)
      .fillColor('#6c757d')
      .text(`N°: ${data.numeroActe || 'N/A'}`, CONFIG.MARGINS.LEFT, 20);
    
    // 4) Titre principal et sous-titre
    doc
      .moveDown(3)
      .fontSize(22)
      .font(CONFIG.FONTS.BOLD)
      .fillColor(CONFIG.COLORS.PRIMARY)
      .text(title, { 
        align: 'center',
        y: 120
      })
      .fontSize(12)
      .fillColor(CONFIG.COLORS.TEXT)
      .text("Extrait des registres de l'état civil", { 
        align: 'center',
        y: 150
      })
      .moveDown(0.8);
      
    return 180; // Retourne la position Y après l'en-tête
  },
  
  // Générer une section avec titre et contenu
  generateSection: (doc, title, content, options = {}) => {
    const { y = doc.y, color = CONFIG.COLORS.PRIMARY } = options;
    
    // Titre de la section
    doc
      .font(CONFIG.FONTS.BOLD)
      .fontSize(13)
      .fillColor(color)
      .text(title, { y: y + 10 });
      
    // Retourne la position Y après le titre
    return y + 20;
  },
  
  // Générer une ligne d'information
  generateInfoLine: (doc, label, value, x, y, options = {}) => {
    const { labelWidth = 150, valueWidth = 300, lineHeight = 20 } = options;
    
    doc
      .font(CONFIG.FONTS.BOLD)
      .fontSize(10)
      .fillColor(CONFIG.COLORS.PRIMARY)
      .text(`${label}: `, x, y, { 
        width: labelWidth, 
        continued: true 
      })
      .font(CONFIG.FONTS.NORMAL)
      .fillColor(CONFIG.COLORS.TEXT)
      .text(value || 'Non spécifié', x + labelWidth + 10, y, {
        width: valueWidth
      });
      
    return y + lineHeight;
  },
  
  // Générer un cadre pour une section
  generateSectionBox: (doc, x, y, width, height, options = {}) => {
    const { 
      fillColor = CONFIG.COLORS.LIGHT_BG,
      strokeColor = CONFIG.COLORS.BORDER,
      radius = 5 
    } = options;
    
    // Dessiner un rectangle avec coins arrondis
    doc
      .roundedRect(x, y, width, height, radius)
      .fillAndStroke(fillColor, strokeColor);
      
    // Retourne la position Y à l'intérieur du cadre
    return y + 15;
  }
};

// Générateur pour l'acte d'engagement de concubinage
const generateEngagementConcubinagePdf = async (data) => {
  // Vérifier les champs obligatoires
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
    throw new PdfGenerationError(
      `Champs manquants: ${missingFields.join(', ')}`,
      'MISSING_REQUIRED_FIELDS',
      { missingFields }
    );
  }
  
  // Créer le document PDF
  const doc = utils.createPdfDocument();
  
  // Configurer les gestionnaires d'événements
  const pdfPromise = utils.setupDocumentHandlers(doc);
  
  // Ajouter une page
  doc.addPage();
  
  try {
    // Générer l'en-tête de l'acte
    let y = contentGenerators.generateActeHeader(doc, "ACTE D'ENGAGEMENT DE CONCUBINAGE", data);
    
    // Section des concubins
    y = contentGenerators.generateSection(doc, 'INFORMATIONS SUR LES CONCUBINS', {}, { y });
    
    // Fonction utilitaire pour formater les informations personnelles
    const formatPersonne = (personne) => ({
      nomComplet: `${personne.prenom || ''} ${personne.nom || ''}`.trim(),
      dateNaissance: utils.formatDate(personne.dateNaissance),
      lieuNaissance: personne.lieuNaissance || 'Non spécifié',
      profession: personne.profession || 'Non spécifiée',
      adresse: personne.adresse || 'Non spécifiée',
      nationalite: personne.nationalite || 'Tchadienne'
    });
    
    const concubin1 = formatPersonne(data.concubin1);
    const concubin2 = formatPersonne(data.concubin2);
    
    // Afficher les informations du premier concubin dans un cadre
    y = contentGenerators.generateSectionBox(doc, 60, y + 10, 480, 100);
    y = contentGenerators.generateInfoLine(doc, 'Premier(e) concubin(e)', '', 80, y);
    y = contentGenerators.generateInfoLine(doc, 'Nom et prénom', concubin1.nomComplet, 80, y + 10);
    y = contentGenerators.generateInfoLine(doc, 'Né(e) le', concubin1.dateNaissance, 80, y + 5);
    y = contentGenerators.generateInfoLine(doc, 'À', concubin1.lieuNaissance, 80, y + 5);
    y = contentGenerators.generateInfoLine(doc, 'Profession', concubin1.profession, 80, y + 5);
    
    // Espacement avant le deuxième concubin
    y += 20;
    
    // Afficher les informations du deuxième concubin dans un cadre
    y = contentGenerators.generateSectionBox(doc, 60, y, 480, 100);
    y = contentGenerators.generateInfoLine(doc, 'Deuxième concubin(e)', '', 80, y);
    y = contentGenerators.generateInfoLine(doc, 'Nom et prénom', concubin2.nomComplet, 80, y + 10);
    y = contentGenerators.generateInfoLine(doc, 'Né(e) le', concubin2.dateNaissance, 80, y + 5);
    y = contentGenerators.generateInfoLine(doc, 'À', concubin2.lieuNaissance, 80, y + 5);
    y = contentGenerators.generateInfoLine(doc, 'Profession', concubin2.profession, 80, y + 5);
    
    // Section des détails de l'engagement
    y += 30;
    y = contentGenerators.generateSection(doc, "DÉTAILS DE L'ENGAGEMENT", {}, { y, color: CONFIG.COLORS.ACCENT });
    
    // Afficher les détails dans un cadre
    y = contentGenerators.generateSectionBox(doc, 60, y + 10, 480, 120);
    y = contentGenerators.generateInfoLine(doc, 'Date de l\'engagement', utils.formatDate(data.dateDebut), 80, y + 15);
    y = contentGenerators.generateInfoLine(doc, 'Lieu de l\'engagement', data.lieuDebut, 80, y + 10);
    y = contentGenerators.generateInfoLine(doc, 'Mairie', data.mairie, 80, y + 10);
    y = contentGenerators.generateInfoLine(doc, 'Ville', data.ville, 80, y + 10);
    
    // Ajouter une section pour les témoins si disponibles
    if (data.temoins && data.temoins.length > 0) {
      y += 20;
      y = contentGenerators.generateSection(doc, 'TÉMOINS', {}, { y, color: CONFIG.COLORS.SECONDARY });
      
      // Afficher les témoins dans un cadre
      y = contentGenerators.generateSectionBox(doc, 60, y + 10, 480, 40 + (data.temoins.length * 30));
      
      data.temoins.forEach((temoins, index) => {
        y = contentGenerators.generateInfoLine(
          doc, 
          `Témoin ${index + 1}`, 
          `${temoins.prenom || ''} ${temoins.nom || ''}`.trim(), 
          80, 
          index === 0 ? y + 15 : y + 10
        );
      });
    }
    
    // Pied de page avec la signature
    y += 30;
    doc
      .moveTo(100, y)
      .lineTo(500, y)
      .stroke(CONFIG.COLORS.BORDER);
      
    doc
      .font(CONFIG.FONTS.ITALIC)
      .fontSize(10)
      .fillColor('#6c757d')
      .text(
        `Fait à ${data.ville || 'N\'Djamena'}, le ${utils.formatDate(data.dateDebut)}`, 
        350, 
        y + 10
      );
      
    // Espace pour la signature
    doc
      .font(CONFIG.FONTS.NORMAL)
      .fontSize(10)
      .fillColor(CONFIG.COLORS.TEXT)
      .text('Signature et cachet de l\'officier d\'état civil', 350, y + 40);
    
    // Finaliser le document
    doc.end();
    
    // Attendre la fin de la génération du PDF
    return await pdfPromise;
    
  } catch (error) {
    // En cas d'erreur, terminer le document et propager l'erreur
    if (!doc._ended) {
      doc.end();
    }
    
    throw error instanceof PdfGenerationError 
      ? error 
      : new PdfGenerationError(
          'Erreur lors de la génération du PDF',
          'PDF_GENERATION_ERROR',
          { originalError: error.message, stack: error.stack }
        );
  }
};

// Génère un PDF pour un acte de mariage
const generateMariagePdf = async (data) => {
  // Créer le document PDF
  const doc = utils.createPdfDocument();
  
  // Configurer les gestionnaires d'événements
  const pdfPromise = utils.setupDocumentHandlers(doc);
  
  // Ajouter une page
  doc.addPage();
  
  try {
    // Générer l'en-tête de l'acte
    let y = contentGenerators.generateActeHeader(doc, "ACTE DE MARIAGE", data);
    
    // Section des époux
    y = contentGenerators.generateSection(doc, 'INFORMATIONS SUR LES ÉPOUX', {}, { y });
    
    // Fonction utilitaire pour formater les informations personnelles
    const formatPersonne = (prefix) => ({
      nomComplet: `${data[`${prefix}Prenom`] || ''} ${data[`${prefix}Nom`] || ''}`.trim(),
      dateNaissance: utils.formatDate(data[`dateNaissance${prefix}`]),
      lieuNaissance: data[`lieuNaissance${prefix}`] || 'Non spécifié',
      profession: data[`profession${prefix}`] || 'Non spécifiée',
      adresse: data[`adresse${prefix}`] || 'Non spécifiée',
      nationalite: data[`nationalite${prefix}`] || 'Tchadienne',
      pere: data[`pere${prefix}`] || 'Non renseigné',
      mere: data[`mere${prefix}`] || 'Non renseignée'
    });
    
    const epoux1 = formatPersonne('Conjoint1');
    const epoux2 = formatPersonne('Conjoint2');
    
    // Afficher les informations du premier époux dans un cadre
    y = contentGenerators.generateSectionBox(doc, 60, y + 10, 480, 120);
    y = contentGenerators.generateInfoLine(doc, 'Premier époux/épouse', '', 80, y);
    y = contentGenerators.generateInfoLine(doc, 'Nom et prénom', epoux1.nomComplet, 80, y + 10);
    y = contentGenerators.generateInfoLine(doc, 'Né(e) le', epoux1.dateNaissance, 80, y + 5);
    y = contentGenerators.generateInfoLine(doc, 'À', epoux1.lieuNaissance, 80, y + 5);
    y = contentGenerators.generateInfoLine(doc, 'Profession', epoux1.profession, 80, y + 5);
    y = contentGenerators.generateInfoLine(doc, 'Fils de', `${epoux1.pere} et de ${epoux1.mere}`, 80, y + 5);
    
    // Espacement avant le deuxième époux
    y += 20;
    
    // Afficher les informations du deuxième époux dans un cadre
    y = contentGenerators.generateSectionBox(doc, 60, y, 480, 120);
    y = contentGenerators.generateInfoLine(doc, 'Deuxième époux/épouse', '', 80, y);
    y = contentGenerators.generateInfoLine(doc, 'Nom et prénom', epoux2.nomComplet, 80, y + 10);
    y = contentGenerators.generateInfoLine(doc, 'Né(e) le', epoux2.dateNaissance, 80, y + 5);
    y = contentGenerators.generateInfoLine(doc, 'À', epoux2.lieuNaissance, 80, y + 5);
    y = contentGenerators.generateInfoLine(doc, 'Profession', epoux2.profession, 80, y + 5);
    y = contentGenerators.generateInfoLine(doc, 'Fils de', `${epoux2.pere} et de ${epoux2.mere}`, 80, y + 5);
    
    // Section des détails du mariage
    y += 30;
    y = contentGenerators.generateSection(doc, "DÉTAILS DU MARIAGE", {}, { y, color: CONFIG.COLORS.ACCENT });
    
    // Afficher les détails dans un cadre
    y = contentGenerators.generateSectionBox(doc, 60, y + 10, 480, 100);
    y = contentGenerators.generateInfoLine(doc, 'Date du mariage', utils.formatDate(data.dateMariage), 80, y + 15);
    y = contentGenerators.generateInfoLine(doc, 'Lieu du mariage', data.lieuMariage, 80, y + 10);
    y = contentGenerators.generateInfoLine(doc, 'Régime matrimonial', data.regimeMatrimonial || 'Non spécifié', 80, y + 10);
    y = contentGenerators.generateInfoLine(doc, 'Contrat de mariage', data.contratMariage ? 'Oui' : 'Non', 80, y + 10);
    
    // Ajouter une section pour les témoins si disponibles
    if (data.temoins && data.temoins.length > 0) {
      y += 20;
      y = contentGenerators.generateSection(doc, 'TÉMOINS', {}, { y, color: CONFIG.COLORS.SECONDARY });
      
      // Afficher les témoins dans un cadre
      y = contentGenerators.generateSectionBox(doc, 60, y + 10, 480, 40 + (data.temoins.length * 30));
      
      data.temoins.forEach((temoin, index) => {
        y = contentGenerators.generateInfoLine(
          doc, 
          `Témoin ${index + 1}`, 
          `${temoin.prenom || ''} ${temoin.nom || ''}`.trim(), 
          80, 
          index === 0 ? y + 15 : y + 10
        );
      });
    }
    
    // Pied de page avec la signature
    y += 30;
    doc
      .moveTo(100, y)
      .lineTo(500, y)
      .stroke(CONFIG.COLORS.BORDER);
      
    doc
      .font(CONFIG.FONTS.ITALIC)
      .fontSize(10)
      .fillColor('#6c757d')
      .text(
        `Fait à ${data.ville || 'N\'Djamena'}, le ${utils.formatDate(data.dateMariage)}`, 
        350, 
        y + 10
      );
      
    // Espace pour la signature
    doc
      .font(CONFIG.FONTS.NORMAL)
      .fontSize(10)
      .fillColor(CONFIG.COLORS.TEXT)
      .text('Signature et cachet de l\'officier d\'état civil', 350, y + 40);
    
    // Finaliser le document
    doc.end();
    
    // Attendre la fin de la génération du PDF
    return await pdfPromise;
    
  } catch (error) {
    // En cas d'erreur, terminer le document et propager l'erreur
    if (!doc._ended) {
      doc.end();
    }
    
    throw error instanceof PdfGenerationError 
      ? error 
      : new PdfGenerationError(
          'Erreur lors de la génération du PDF de mariage',
          'PDF_GENERATION_ERROR',
          { originalError: error.message, stack: error.stack }
        );
  }
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
      case 'mariage':
        console.log('[PDF Service] Appel de generateMariagePdf');
        result = await generateMariagePdf(data);
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

// Exporter les fonctions du module
module.exports = {
  generatePdf,
  generateEngagementConcubinagePdf,
  generateMariagePdf,
  PdfGenerationError
};
