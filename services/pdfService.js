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
    PRIMARY: '#002689',
    SECONDARY: '#FFD100',
    ACCENT: '#CE1126',
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
    try {
      if (!dateStr) return 'Non spécifiée';
      const date = new Date(dateStr);
      return date.toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (error) {
      logger.error('Erreur de formatage de date:', error);
      return dateStr || 'Date invalide';
    }
  },

  // Créer un document PDF de base
  createPdfDocument: () => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 0,
      bufferPages: true
    });
    return doc;
  },

  // Configurer les gestionnaires d'événements du document
  setupDocumentHandlers: (doc) => {
    doc.on('error', (error) => {
      logger.error('Erreur lors de la génération du PDF:', error);
      throw new PdfGenerationError('Erreur lors de la génération du document PDF', 'PDF_CREATION_ERROR', { error });
    });

    doc.on('pageAdded', () => {
      // Ajouter un en-tête et un pied de page à chaque nouvelle page
      const pageNumber = doc.bufferedPageRange().count;
      if (pageNumber > 1) {
        doc.addPage();
      }
    });

    return doc;
  }
};

// Fonctions de génération de contenu
const contentGenerators = {
  // Générer l'en-tête avec le drapeau du Tchad
  generateHeader: (doc) => {
    doc.image(path.join(__dirname, '../public/images/logo.png'), CONFIG.FLAG.X, CONFIG.FLAG.Y, {
      width: CONFIG.FLAG.WIDTH,
      height: CONFIG.FLAG.HEIGHT
    })
    .fillColor(CONFIG.COLORS.PRIMARY)
    .font(CONFIG.FONTS.BOLD)
    .fontSize(14)
    .text('RÉPUBLIQUE DU TCHAD', CONFIG.MARGINS.LEFT + 100, CONFIG.MARGINS.TOP, {
      align: 'center',
      width: 400
    })
    .font(CONFIG.FONTS.NORMAL)
    .fontSize(10)
    .text('Unité - Travail - Progrès', CONFIG.MARGINS.LEFT + 100, CONFIG.MARGINS.TOP + 20, {
      align: 'center',
      width: 400
    })
    .font(CONFIG.FONTS.BOLD)
    .fontSize(16)
    .text('MAIRIE DE LA VILLE D\'ABÉCHÉ', CONFIG.MARGINS.LEFT + 100, CONFIG.MARGINS.TOP + 40, {
      align: 'center',
      width: 400
    })
    .font(CONFIG.FONTS.NORMAL)
    .fontSize(10)
    .text('Région du Ouaddaï - Tchad', CONFIG.MARGINS.LEFT + 100, CONFIG.MARGINS.TOP + 60, {
      align: 'center',
      width: 400
    })
    .moveDown(2);

    return doc;
  },

  // Générer l'en-tête d'un acte
  generateActeHeader: (doc, title, data) => {
    doc.font(CONFIG.FONTS.BOLD)
       .fontSize(16)
       .text(title, { align: 'center' })
       .moveDown(1)
       .font(CONFIG.FONTS.NORMAL)
       .fontSize(10)
       .text(`N°: ${data.numeroActe || 'Non spécifié'}`)
       .text(`Fait à: ${data.lieuEtablissement || 'Abéché'}`)
       .text(`Le: ${utils.formatDate(data.dateEtablissement)}`)
       .moveDown(2);
    return doc;
  },

  // Générer une section avec titre et contenu
  generateSection: (doc, title, content, options = {}) => {
    const { font = CONFIG.FONTS.NORMAL, fontSize = 10, marginTop = 10, marginBottom = 5 } = options;
    
    doc.font(CONFIG.FONTS.BOLD)
       .fontSize(fontSize + 1)
       .text(title, { continued: false })
       .moveDown(0.5);
    
    doc.font(font)
       .fontSize(fontSize)
       .text(content, { align: 'justify' })
       .moveDown(marginBottom);
    
    return doc;
  },

  // Générer une ligne d'information
  generateInfoLine: (doc, label, value, x, y, options = {}) => {
    const { width = 250, height = 15 } = options;
    
    doc.font(CONFIG.FONTS.BOLD)
       .fontSize(10)
       .text(label, x, y, { width, height, align: 'left' })
       .font(CONFIG.FONTS.NORMAL)
       .text(value || 'Non spécifié', x + 100, y, { width: width - 100, height, align: 'left' });
    
    return doc;
  },

  // Générer un cadre pour une section
  generateSectionBox: (doc, x, y, width, height, options = {}) => {
    const { color = CONFIG.COLORS.BORDER, radius = 5, fill = false } = options;
    
    doc.roundedRect(x, y, width, height, radius)
       .stroke(color);
    
    if (fill) {
      doc.fill(color);
    }
    
    return doc;
  }
};

// Générateur pour l'acte de mariage
const generateMariagePdf = async (data) => {
  // ... (le contenu existant de generateMariagePdf) ...
};

/**
 * Génère un PDF pour un acte de divorce
 * @param {Object} data - Les données du divorce
 * @returns {Promise<Buffer>} Le buffer du PDF généré
 */
const generateDivorcePdf = async (data) => {
  const doc = new PDFDocument({
    size: 'A4', 
    margin: 0,
    bufferPages: true
  });

  // Configuration des polices et couleurs
  doc.fontSize(10);
  doc.lineGap(5);
  
  // En-tête avec le logo et les informations de la mairie
  doc
    .image(path.join(__dirname, '../public/images/logo.png'), 50, 40, { width: 80 })
    .fillColor('#000000')
    .fontSize(12)
    .font('Helvetica-Bold')
    .text('RÉPUBLIQUE DU TCHAD', 200, 50, { align: 'center' })
    .fontSize(10)
    .font('Helvetica')
    .text('Unité - Travail - Progrès', 200, 65, { align: 'center' })
    .font('Helvetica-Bold')
    .fontSize(14)
    .text('MAIRIE DE LA VILLE D\'ABÉCHÉ', 200, 80, { align: 'center' })
    .fontSize(10)
    .text('Région du Ouaddaï - Tchad', 200, 100, { align: 'center' })
    .moveDown(2);

  // Titre du document
  doc.fontSize(16)
     .font('Helvetica-Bold')
     .text('ACTE DE DIVORCE', { align: 'center' })
     .moveDown(1);

  // Numéro d'acte et date
  doc.fontSize(10)
     .text(`N°: ${data.numeroActe || 'Non spécifié'}`, { align: 'left' })
     .text(`Fait à: ${data.lieuEtablissement || 'Abéché'}`, { align: 'left' })
     .text(`Le: ${data.dateEtablissement || new Date().toLocaleDateString('fr-FR')}`, { align: 'left' })
     .moveDown(2);

  // Contenu principal
  doc.font('Helvetica')
     .text(`Par le présent acte, nous, officier de l'état civil de la ville d'Abéché, certifions que le divorce a été prononcé entre :`)
     .moveDown(1);

  // Informations sur l'époux
  doc.font('Helvetica-Bold')
     .text('ÉPOUX :')
     .font('Helvetica')
     .text(`${data.epoux?.prenoms || ''} ${data.epoux?.nom || ''}`)
     .text(`Né(e) le: ${data.epoux?.dateNaissance || 'Non spécifiée'} à ${data.epoux?.lieuNaissance || 'Non spécifié'}`)
     .text(`Fils de: ${data.epoux?.pere?.prenoms || ''} ${data.epoux?.pere?.nom || ''} et ${data.epoux?.mere?.prenoms || ''} ${data.epoux?.mere?.nom || ''}`)
     .moveDown(1);

  // Informations sur l'épouse
  doc.font('Helvetica-Bold')
     .text('ET')
     .moveDown(1)
     .text('ÉPOUSE :')
     .font('Helvetica')
     .text(`${data.epouse?.prenoms || ''} ${data.epouse?.nom || ''}`)
     .text(`Née le: ${data.epouse?.dateNaissance || 'Non spécifiée'} à ${data.epouse?.lieuNaissance || 'Non spécifié'}`)
     .text(`Fille de: ${data.epouse?.pere?.prenoms || ''} ${data.epouse?.pere?.nom || ''} et ${data.epouse?.mere?.prenoms || ''} ${data.epouse?.mere?.nom || ''}`)
     .moveDown(2);

  // Détails du divorce
  doc.font('Helvetica-Bold')
     .text('DÉTAILS DU DIVORCE :')
     .font('Helvetica')
     .text(`Date du mariage: ${data.dateMariage || 'Non spécifiée'}`)
     .text(`Lieu du mariage: ${data.lieuMariage || 'Non spécifié'}`)
     .text(`Date du divorce: ${data.dateDivorce || 'Non spécifiée'}`)
     .text(`Type de divorce: ${data.typeDivorce || 'Non spécifié'}`)
     .text(`Motif: ${data.motifs || 'Non spécifié'}`)
     .moveDown(2);

  // Enfants et garde
  if (data.gardeEnfants && data.gardeEnfants.length > 0) {
    doc.font('Helvetica-Bold')
       .text('GARDE DES ENFANTS :')
       .font('Helvetica');
    
    data.gardeEnfants.forEach((enfant, index) => {
      doc.text(`${index + 1}. ${enfant.prenom} ${enfant.nom}, né(e) le ${enfant.dateNaissance} - Garde: ${enfant.garde}`);
    });
    doc.moveDown(2);
  }

  // Signature
  doc.moveTo(50, doc.y)
     .lineTo(550, doc.y)
     .stroke()
     .moveDown(2)
     .font('Helvetica-Bold')
     .text('L\'Officier d\'État Civil', { align: 'right' })
     .font('Helvetica')
     .text(data.officierEtatCivil || 'Nom de l\'officier', { align: 'right' });

  // Finalisation du document
  doc.end();

  // Retourner le buffer du PDF
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
};

/**
 * Génère un PDF en fonction du type de document
 * @param {string} type - Le type de document (naissance, mariage, deces, etc.)
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
      case 'divorce':
        console.log('[PDF Service] Appel de generateDivorcePdf');
        result = await generateDivorcePdf(data);
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
  generateMariagePdf,
  generateDivorcePdf
};
