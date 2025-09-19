const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const logger = require('../config/logger');

// Configuration
const CONFIG = {
  OUTPUT_DIR: path.join(__dirname, '../public/pdfs'),
  FONTS: {
    NORMAL: 'Helvetica',
    BOLD: 'Helvetica-Bold',
    ITALIC: 'Helvetica-Oblique'
  },
  COLORS: {
    PRIMARY: '#002689',    // Bleu du drapeau tchadien
    SECONDARY: '#FFD100',  // Jaune du drapeau
    ACCENT: '#CE1126',     // Rouge du drapeau
    TEXT: '#333333',
    LIGHT_BG: '#F8F9FA',
    BORDER: '#CCCCCC',
    WHITE: '#FFFFFF',
    BLACK: '#000000'
  },
  MARGINS: {
    LEFT: 50,
    RIGHT: 50,
    TOP: 50,
    BOTTOM: 50
  },
  FLAG: {
    WIDTH: 80,
    HEIGHT: 48,
    COLORS: {
      BLUE: '#002689',
      YELLOW: '#FFD100',
      RED: '#CE1126'
    }
  },
  SECTION: {
    PADDING: 15,
    MARGIN_BOTTOM: 20,
    BORDER_RADIUS: 5
  }
};

// Vérifier et créer le dossier de sortie
const ensureOutputDir = () => {
  if (!fs.existsSync(CONFIG.OUTPUT_DIR)) {
    try {
      fs.mkdirSync(CONFIG.OUTPUT_DIR, { recursive: true });
      logger.info(`Dossier de sortie créé: ${CONFIG.OUTPUT_DIR}`);
    } catch (error) {
      const errorMsg = `Impossible de créer le dossier de sortie: ${error.message}`;
      logger.error(errorMsg, { error });
      throw new Error(errorMsg);
    }
  }
};

// Vérifier les polices disponibles
const checkFonts = (doc) => {
  const availableFonts = [];
  
  // Vérifier les polices de base
  const baseFonts = [CONFIG.FONTS.NORMAL, CONFIG.FONTS.BOLD, CONFIG.FONTS.ITALIC];
  
  baseFonts.forEach(font => {
    try {
      doc.font(font);
      availableFonts.push(font);
    } catch (error) {
      logger.warn(`Police non disponible: ${font}`, { error: error.message });
    }
  });
  
  if (availableFonts.length === 0) {
    throw new Error('Aucune police valide disponible pour la génération du PDF');
  }
  
  return availableFonts;
};

// Valider les données d'entrée
const validateInputData = (data, requiredFields = []) => {
  if (!data || typeof data !== 'object') {
    throw new Error('Les données fournies sont invalides');
  }
  
  const missingFields = [];
  requiredFields.forEach(field => {
    if (data[field] === undefined || data[field] === null || data[field] === '') {
      missingFields.push(field);
    }
  });
  
  if (missingFields.length > 0) {
    throw new Error(`Champs obligatoires manquants: ${missingFields.join(', ')}`);
  }
  
  return true;
};

// Gestionnaire d'erreurs centralisé
class PdfGenerationError extends Error {
  constructor(message, code = 'PDF_GENERATION_ERROR', details = {}) {
    super(message);
    this.name = 'PdfGenerationError';
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

// ==================== FONCTIONS D'AIDE ====================

// Formater une date au format français
const formatDate = (dateString) => {
  if (!dateString) return 'Non spécifiée';
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString; // Retourne la chaîne originale si la date est invalide
    
    const options = { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      weekday: 'long'
    };
    
    return date.toLocaleDateString('fr-FR', options);
  } catch (error) {
    logger.error('Erreur de formatage de date', { dateString, error: error.message });
    return dateString;
  }
};

// Générer une ligne d'information
const generateInfoLine = (doc, label, value, x, y, options = {}) => {
  const { labelWidth = 200, valueWidth = 300 } = options;
  
  doc.font(CONFIG.FONTS.BOLD)
     .fontSize(10)
     .fillColor(CONFIG.COLORS.TEXT)
     .text(label, x, y, { width: labelWidth, align: 'left' });
     
  doc.font(CONFIG.FONTS.NORMAL)
     .fontSize(10)
     .fillColor(CONFIG.COLORS.TEXT)
     .text(value || 'Non spécifié', x + labelWidth, y, { 
       width: valueWidth, 
       align: 'left',
       lineGap: 5
     });
     
  return y + 20; // Retourne la nouvelle position Y
};

// Générer un cadre de section
const generateSectionBox = (doc, x, y, width, height, options = {}) => {
  const { 
    fillColor = CONFIG.COLORS.WHITE,
    strokeColor = CONFIG.COLORS.BORDER,
    radius = CONFIG.SECTION.BORDER_RADIUS
  } = options;
  
  doc.save()
     .roundedRect(x, y, width, height, radius)
     .fillAndStroke(fillColor, strokeColor)
     .restore();
     
  return y + height + 10; // Retourne la position Y après le cadre
};

// ==================== GÉNÉRATION D'EN-TÊTE ====================

// Générer l'en-tête avec le drapeau du Tchad
const generateActeHeader = (doc, title, data) => {
  // Dessiner le drapeau du Tchad (3 bandes verticales)
  const flagX = CONFIG.MARGINS.LEFT;
  const flagY = CONFIG.MARGINS.TOP;
  const flagWidth = CONFIG.FLAG.WIDTH;
  const flagHeight = CONFIG.FLAG.HEIGHT;
  const bandWidth = flagWidth / 3;
  
  // Contour noir du drapeau
  doc.rect(flagX, flagY, flagWidth, flagHeight).fillAndStroke(CONFIG.COLORS.WHITE, CONFIG.COLORS.BLACK);
  
  // Bandes du drapeau
  doc.rect(flagX, flagY, bandWidth, flagHeight).fill(CONFIG.FLAG.COLORS.BLUE);
  doc.rect(flagX + bandWidth, flagY, bandWidth, flagHeight).fill(CONFIG.FLAG.COLORS.YELLOW);
  doc.rect(flagX + (2 * bandWidth), flagY, bandWidth, flagHeight).fill(CONFIG.FLAG.COLORS.RED);
  
  // Titre de l'acte
  const titleX = flagX + flagWidth + 20;
  const titleY = flagY + 5;
  
  doc.font(CONFIG.FONTS.BOLD)
     .fontSize(16)
     .fillColor(CONFIG.COLORS.PRIMARY)
     .text(title.toUpperCase(), titleX, titleY, {
       width: doc.page.width - titleX - CONFIG.MARGINS.RIGHT,
       align: 'center'
     });
     
  // Ligne de séparation
  const lineY = titleY + 25;
  doc.moveTo(titleX, lineY)
     .lineTo(doc.page.width - CONFIG.MARGINS.RIGHT, lineY)
     .lineWidth(1)
     .stroke(CONFIG.COLORS.ACCENT);
     
  // Numéro d'acte et date
  const infoY = lineY + 15;
  
  if (data.numeroActe) {
    doc.font(CONFIG.FONTS.BOLD)
       .fontSize(10)
       .fillColor(CONFIG.COLORS.TEXT)
       .text(`N°: ${data.numeroActe}`, titleX, infoY);
  }
  
  doc.font(CONFIG.FONTS.NORMAL)
     .fontSize(10)
     .fillColor(CONFIG.COLORS.TEXT)
     .text(`Fait à ${data.ville || 'N\'Djamena'}, le ${formatDate(new Date())}`, 
           doc.page.width - CONFIG.MARGINS.RIGHT - 200, infoY, {
             width: 200,
             align: 'right'
           });
           
  return infoY + 30; // Retourne la position Y après l'en-tête
};

// ==================== GÉNÉRATION DE SECTIONS ====================

// Générer une section avec titre
const generateSection = (doc, title, content, options = {}) => {
  const { 
    x = CONFIG.MARGINS.LEFT,
    y = doc.y + 10,
    width = doc.page.width - CONFIG.MARGINS.LEFT - CONFIG.MARGINS.RIGHT,
    titleBgColor = CONFIG.COLORS.PRIMARY,
    titleTextColor = CONFIG.COLORS.WHITE,
    padding = CONFIG.SECTION.PADDING
  } = options;
  
  // Titre de la section
  const titleHeight = 25;
  
  doc.save()
     .roundedRect(x, y, width, titleHeight, { 
       topLeft: 5, 
       topRight: 5,
       bottomLeft: 0,
       bottomRight: 0 
     })
     .fill(titleBgColor);
     
  doc.font(CONFIG.FONTS.BOLD)
     .fontSize(12)
     .fillColor(titleTextColor)
     .text(title, x + padding, y + (titleHeight / 2) - 4, {
       width: width - (2 * padding),
       align: 'center'
     });
     
  // Contenu de la section
  const contentY = y + titleHeight;
  const contentHeight = options.contentHeight || 100; // Hauteur par défaut
  
  doc.save()
     .roundedRect(x, contentY, width, contentHeight, { 
       topLeft: 0,
       topRight: 0,
       bottomLeft: 5,
       bottomRight: 5
     })
     .fill(CONFIG.COLORS.WHITE)
     .stroke(CONFIG.COLORS.BORDER);
     
  // Restaurer l'état du document
  doc.restore();
  
  return contentY + contentHeight + 10; // Retourne la position Y après la section
};

// ==================== GÉNÉRATION DE PDF ====================

// Générer un PDF d'acte de naissance
const generateNaissancePdf = async (data) => {
  const doc = new PDFDocument({
    size: 'A4',
    margins: {
      top: CONFIG.MARGINS.TOP,
      bottom: CONFIG.MARGINS.BOTTOM,
      left: CONFIG.MARGINS.LEFT,
      right: CONFIG.MARGINS.RIGHT
    },
    bufferPages: true
  });
  
  // Pour collecter les données du PDF
  const chunks = [];
  const pdfPromise = new Promise((resolve, reject) => {
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
  
  try {
    // Ajouter une page
    doc.addPage();
    
    // Générer l'en-tête
    let y = generateActeHeader(doc, 'ACTE DE NAISSANCE', data);
    
    // Section informations de l'enfant
    y = generateSection(doc, 'INFORMATIONS DE L\'ENFANT', {}, { y });
    
    // Ajouter les informations de l'enfant
    doc.font(CONFIG.FONTS.NORMAL)
       .fontSize(10)
       .fillColor(CONFIG.COLORS.TEXT);
    
    // ... (code pour ajouter les informations de l'enfant)
    
    // Section filiation
    y = generateSection(doc, 'FILIATION', {}, { y: y + 20 });
    
    // Ajouter les informations des parents
    // ... (code pour ajouter les informations des parents)
    
    // Section déclarant
    if (data.declarant) {
      y = generateSection(doc, 'INFORMATIONS DU DÉCLARANT', {}, { y: y + 20 });
      // ... (code pour ajouter les informations du déclarant)
    }
    
    // Section observations
    if (data.observations) {
      y = generateSection(doc, 'OBSERVATIONS', {}, { y: y + 20, contentHeight: 50 });
      doc.text(data.observations, CONFIG.MARGINS.LEFT + 10, y + 10, {
        width: doc.page.width - CONFIG.MARGINS.LEFT - CONFIG.MARGINS.RIGHT - 20,
        align: 'left'
      });
    }
    
    // Pied de page avec signature
    const footerY = doc.page.height - CONFIG.MARGINS.BOTTOM - 50;
    doc.moveTo(CONFIG.MARGINS.LEFT, footerY)
       .lineTo(doc.page.width - CONFIG.MARGINS.RIGHT, footerY)
       .stroke(CONFIG.COLORS.BORDER);
    
    doc.font(CONFIG.FONTS.ITALIC)
       .fontSize(9)
       .fillColor(CONFIG.COLORS.TEXT)
       .text('Fait à ' + (data.ville || 'N\'Djamena') + ', le ' + formatDate(new Date()),
             CONFIG.MARGINS.LEFT, footerY + 10);
    
    // Zone de signature
    doc.font(CONFIG.FONTS.BOLD)
       .fontSize(10)
       .fillColor(CONFIG.COLORS.TEXT)
       .text('L\'officier d\'état civil,', 
             doc.page.width - CONFIG.MARGINS.RIGHT - 150, 
             footerY + 10, { width: 150, align: 'center' });
    
    doc.moveTo(doc.page.width - CONFIG.MARGINS.RIGHT - 150, footerY + 50)
       .lineTo(doc.page.width - CONFIG.MARGINS.RIGHT, footerY + 50)
       .stroke(CONFIG.COLORS.BLACK);
    
    // Finaliser le document
    doc.end();
    
    return await pdfPromise;
    
  } catch (error) {
    logger.error('Erreur lors de la génération du PDF de naissance', {
      error: error.message,
      stack: error.stack
    });
    
    throw new PdfGenerationError(
      'Erreur lors de la génération du PDF de naissance',
      'NAISSANCE_PDF_ERROR',
      { originalError: error.message }
    );
  }
};

// Générer un PDF d'acte de mariage
const generateMariagePdf = async (data) => {
  const doc = new PDFDocument({
    size: 'A4',
    margins: {
      top: CONFIG.MARGINS.TOP,
      bottom: CONFIG.MARGINS.BOTTOM,
      left: CONFIG.MARGINS.LEFT,
      right: CONFIG.MARGINS.RIGHT
    },
    bufferPages: true
  });
  
  // Pour collecter les données du PDF
  const chunks = [];
  const pdfPromise = new Promise((resolve, reject) => {
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
  
  try {
    // Ajouter une page
    doc.addPage();
    
    // Générer l'en-tête avec le numéro d'acte
    let y = generateActeHeader(doc, 'ACTE DE MARIAGE', data);
    
    // Numéro d'acte et date d'enregistrement
    doc.font(CONFIG.FONTS.NORMAL)
       .fontSize(10)
       .fillColor(CONFIG.COLORS.TEXT)
       .text(`N°: ${data.numeroActe || 'N/A'}`, CONFIG.MARGINS.LEFT, 20)
       .text(`Enregistré le: ${formatDate(data.dateEnregistrement || new Date())}`, CONFIG.MARGINS.LEFT, 35);
    
    // Section informations des époux
    y = generateSection(doc, 'I. INFORMATIONS SUR LES ÉPOUX', {}, { 
      y: y + 20, 
      titleBgColor: CONFIG.COLORS.SECONDARY 
    });
    
    // Section époux 1
    y = generateSection(doc, '1. ÉPOUX', {}, { 
      y: y + 10, 
      titleBgColor: CONFIG.COLORS.PRIMARY 
    });
    
    // Ajouter les informations de l'époux 1
    y = generateInfoLine(doc, '• Nom', data.conjoint1Nom, CONFIG.MARGINS.LEFT + 20, y + 15);
    y = generateInfoLine(doc, '• Prénom(s)', data.conjoint1Prenom, CONFIG.MARGINS.LEFT + 20, y + 5);
    y = generateInfoLine(doc, '• Date de naissance', formatDate(data.dateNaissanceConjoint1), CONFIG.MARGINS.LEFT + 20, y + 5);
    y = generateInfoLine(doc, '• Lieu de naissance', data.lieuNaissanceConjoint1, CONFIG.MARGINS.LEFT + 20, y + 5);
    y = generateInfoLine(doc, '• Profession', data.professionConjoint1, CONFIG.MARGINS.LEFT + 20, y + 5);
    y = generateInfoLine(doc, '• Adresse', data.adresseConjoint1, CONFIG.MARGINS.LEFT + 20, y + 5);
    y = generateInfoLine(doc, '• Nationalité', data.nationaliteConjoint1, CONFIG.MARGINS.LEFT + 20, y + 5);
    y = generateInfoLine(doc, '• Type de pièce', data.typePieceConjoint1, CONFIG.MARGINS.LEFT + 20, y + 5);
    y = generateInfoLine(doc, '• N° de pièce', data.numeroPieceConjoint1, CONFIG.MARGINS.LEFT + 20, y + 5);
    
    // Parents de l'époux
    if (data.parentsConjoint1) {
      y = generateInfoLine(doc, '• Père', 
        `${data.parentsConjoint1.pere.nom || ''} ${data.parentsConjoint1.pere.prenom || ''}`.trim() || 'Non spécifié', 
        CONFIG.MARGINS.LEFT + 20, y + 5
      );
      y = generateInfoLine(doc, '• Mère', 
        `${data.parentsConjoint1.mere.nom || ''} ${data.parentsConjoint1.mere.prenom || ''}`.trim() || 'Non spécifié', 
        CONFIG.MARGINS.LEFT + 20, y + 5
      );
    }
    
    // Section épouse
    y = generateSection(doc, '2. ÉPOUSE', {}, { 
      y: y + 15, 
      titleBgColor: CONFIG.COLORS.ACCENT 
    });
    
    // Ajouter les informations de l'épouse
    y = generateInfoLine(doc, '• Nom', data.conjoint2Nom, CONFIG.MARGINS.LEFT + 20, y + 15);
    y = generateInfoLine(doc, '• Prénom(s)', data.conjoint2Prenom, CONFIG.MARGINS.LEFT + 20, y + 5);
    y = generateInfoLine(doc, '• Nom de jeune fille', data.nomJeuneFilleConjoint2 || 'Non spécifié', CONFIG.MARGINS.LEFT + 20, y + 5);
    y = generateInfoLine(doc, '• Date de naissance', formatDate(data.dateNaissanceConjoint2), CONFIG.MARGINS.LEFT + 20, y + 5);
    y = generateInfoLine(doc, '• Lieu de naissance', data.lieuNaissanceConjoint2, CONFIG.MARGINS.LEFT + 20, y + 5);
    y = generateInfoLine(doc, '• Profession', data.professionConjoint2, CONFIG.MARGINS.LEFT + 20, y + 5);
    y = generateInfoLine(doc, '• Adresse', data.adresseConjoint2, CONFIG.MARGINS.LEFT + 20, y + 5);
    y = generateInfoLine(doc, '• Nationalité', data.nationaliteConjoint2, CONFIG.MARGINS.LEFT + 20, y + 5);
    y = generateInfoLine(doc, '• Type de pièce', data.typePieceConjoint2, CONFIG.MARGINS.LEFT + 20, y + 5);
    y = generateInfoLine(doc, '• N° de pièce', data.numeroPieceConjoint2, CONFIG.MARGINS.LEFT + 20, y + 5);
    
    // Parents de l'épouse
    if (data.parentsConjoint2) {
      y = generateInfoLine(doc, '• Père', 
        `${data.parentsConjoint2.pere.nom || ''} ${data.parentsConjoint2.pere.prenom || ''}`.trim() || 'Non spécifié', 
        CONFIG.MARGINS.LEFT + 20, y + 5
      );
      y = generateInfoLine(doc, '• Mère', 
        `${data.parentsConjoint2.mere.nom || ''} ${data.parentsConjoint2.mere.prenom || ''}`.trim() || 'Non spécifié', 
        CONFIG.MARGINS.LEFT + 20, y + 5
      );
    }
    
    // Section détails du mariage
    y = generateSection(doc, 'II. DÉTAILS DU MARIAGE', {}, { 
      y: y + 20, 
      titleBgColor: CONFIG.COLORS.SECONDARY 
    });
    
    // Ajouter les détails du mariage
    y = generateInfoLine(doc, '• Date du mariage', formatDate(data.dateMariage), CONFIG.MARGINS.LEFT + 20, y + 15);
    y = generateInfoLine(doc, '• Heure du mariage', data.heureMariage || 'Non spécifiée', CONFIG.MARGINS.LEFT + 20, y + 5);
    y = generateInfoLine(doc, '• Lieu du mariage', data.lieuMariage, CONFIG.MARGINS.LEFT + 20, y + 5);
    y = generateInfoLine(doc, '• Régime matrimonial', data.regimeMatrimonial || 'Communauté réduite aux acquêts', CONFIG.MARGINS.LEFT + 20, y + 5);
    y = generateInfoLine(doc, '• Contrat de mariage', data.contratMariage ? 'Oui' : 'Non', CONFIG.MARGINS.LEFT + 20, y + 5);
    
    if (data.contratMariage && data.notaire) {
      y = generateInfoLine(doc, '• Notaire', data.notaire, CONFIG.MARGINS.LEFT + 20, y + 5);
    }
    
    // Section témoins
    if (data.temoins && data.temoins.length > 0) {
      y = generateSection(doc, 'III. TÉMOINS', {}, { 
        y: y + 20, 
        titleBgColor: CONFIG.COLORS.PRIMARY 
      });
      
      // Ajouter les témoins
      data.temoins.forEach((temoin, index) => {
        y = generateSection(doc, `Témoin ${index + 1}`, {}, { 
          y: y + 10, 
          titleBgColor: index % 2 === 0 ? CONFIG.COLORS.SECONDARY : CONFIG.COLORS.ACCENT 
        });
        
        y = generateInfoLine(doc, '• Nom', temoin.nom, CONFIG.MARGINS.LEFT + 20, y + 15);
        y = generateInfoLine(doc, '• Prénom(s)', temoin.prenom, CONFIG.MARGINS.LEFT + 20, y + 5);
        y = generateInfoLine(doc, '• Date de naissance', formatDate(temoin.dateNaissance), CONFIG.MARGINS.LEFT + 20, y + 5);
        y = generateInfoLine(doc, '• Profession', temoin.profession, CONFIG.MARGINS.LEFT + 20, y + 5);
        y = generateInfoLine(doc, '• Adresse', temoin.adresse, CONFIG.MARGINS.LEFT + 20, y + 5);
        y = generateInfoLine(doc, '• Lien avec les époux', temoin.lien || 'Non spécifié', CONFIG.MARGINS.LEFT + 20, y + 5);
      });
    }
    
    // Section mentions marginales
    if (data.mentionsMarginales && data.mentionsMarginales.length > 0) {
      y = generateSection(doc, 'IV. MENTIONS MARGINALES', {}, { 
        y: y + 20, 
        titleBgColor: CONFIG.COLORS.SECONDARY 
      });
      
      data.mentionsMarginales.forEach((mention, index) => {
        y = generateInfoLine(doc, `• Mention ${index + 1}`, mention, CONFIG.MARGINS.LEFT + 20, y + (index === 0 ? 15 : 5));
      });
      
      y += 10;
    }
    
    // Section observations
    if (data.observations) {
      y = generateSection(doc, 'V. OBSERVATIONS', {}, { 
        y: y + 10, 
        titleBgColor: CONFIG.COLORS.PRIMARY 
      });
      
      // Gérer le texte d'observation sur plusieurs lignes si nécessaire
      const observations = doc
        .font(CONFIG.FONTS.NORMAL)
        .fontSize(10)
        .fillColor(CONFIG.COLORS.TEXT)
        .text(data.observations, CONFIG.MARGINS.LEFT + 20, y + 15, {
          width: doc.page.width - CONFIG.MARGINS.LEFT - CONFIG.MARGINS.RIGHT - 40,
          align: 'left',
          lineGap: 5
        });
      
      y = observations.y + 10;
    }
    
    // Pied de page avec signature
    const footerY = doc.page.height - CONFIG.MARGINS.BOTTOM - 50;
    
    // Ligne de séparation
    doc.moveTo(CONFIG.MARGINS.LEFT, footerY)
       .lineTo(doc.page.width - CONFIG.MARGINS.RIGHT, footerY)
       .stroke(CONFIG.COLORS.BORDER);
    
    // Date et lieu
    doc.font(CONFIG.FONTS.ITALIC)
       .fontSize(9)
       .fillColor(CONFIG.COLORS.TEXT)
       .text(`Fait à ${data.mairie || 'N\'Djamena'}, le ${formatDate(data.dateEtablissement || new Date())}`,
             CONFIG.MARGINS.LEFT, footerY + 10);
    
    // Zone de signature
    const signatureX = doc.page.width - CONFIG.MARGINS.RIGHT - 200;
    
    // Ligne de signature
    doc.moveTo(signatureX, footerY + 40)
       .lineTo(doc.page.width - CONFIG.MARGINS.RIGHT, footerY + 40)
       .stroke(CONFIG.COLORS.BLACK);
    
    // Texte de la signature
    doc.font(CONFIG.FONTS.BOLD)
       .fontSize(10)
       .fillColor(CONFIG.COLORS.TEXT)
       .text('L\'officier d\'état civil,', 
             signatureX, 
             footerY + 10, 
             { width: 200, align: 'center' });
    
    // Numéro de page
    const pageNumber = doc.bufferedPageRange().count;
    doc.font(CONFIG.FONTS.NORMAL)
       .fontSize(8)
       .fillColor(CONFIG.COLORS.TEXT)
       .text(
         `Page ${pageNumber}`, 
         doc.page.width / 2 - 20, 
         doc.page.height - 30,
         { align: 'center' }
       );
    
    // Finaliser le document
    doc.end();
    
    return await pdfPromise;
    
  } catch (error) {
    logger.error('Erreur lors de la génération du PDF de mariage', {
      error: error.message,
      stack: error.stack
    });
    
    throw new PdfGenerationError(
      'Erreur lors de la génération du PDF de mariage',
      'MARIAGE_PDF_ERROR',
      { originalError: error.message }
    );
  }
};

// Générer un PDF en fonction du type de document
const generatePdf = async (type, data) => {
  logger.info(`Début de la génération d'un PDF de type: ${type}`);
  
  try {
    let result;
    
    switch (type.toLowerCase()) {
      case 'naissance':
        result = await generateNaissancePdf(data);
        break;
        
      case 'mariage':
        result = await generateMariagePdf(data);
        break;
        
      case 'deces':
        // Implémenter la génération du PDF de décès si nécessaire
        throw new Error('Génération des PDF de décès non encore implémentée');
        
      case 'engagement-concubinage':
        // Implémenter la génération du PDF d'engagement de concubinage si nécessaire
        throw new Error('Génération des PDF d\'engagement de concubinage non encore implémentée');
        
      default:
        throw new Error(`Type de document non pris en charge: ${type}`);
    }
    
    logger.info(`PDF de type ${type} généré avec succès (${result.length} octets)`);
    return result;
    
  } catch (error) {
    logger.error(`Erreur lors de la génération du PDF de type ${type}`, {
      error: error.message,
      stack: error.stack
    });
    
    throw error;
  }
};

// Exporter les fonctions
module.exports = {
  generatePdf,
  generateNaissancePdf,
  generateMariagePdf,
  PdfGenerationError,
  // Exporter les fonctions utilitaires pour les tests
  _test: {
    formatDate,
    generateInfoLine,
    generateSection,
    generateActeHeader
  }
};
