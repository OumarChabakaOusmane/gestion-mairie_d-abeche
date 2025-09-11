const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { logger } = require('../config/logger');

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
    TOP: 50,
    BOTTOM: 50
  },
  FLAG: {
    WIDTH: 90,
    HEIGHT: 60,
    X: 50,
    Y: 50
  }
};

// Vérifier et créer le dossier de sortie
const ensureOutputDir = () => {
  try {
    if (!fs.existsSync(CONFIG.OUTPUT_DIR)) {
      fs.mkdirSync(CONFIG.OUTPUT_DIR, { recursive: true });
      logger.info(`Dossier de sortie créé: ${CONFIG.OUTPUT_DIR}`);
    }
  } catch (error) {
    logger.error('Erreur lors de la création du dossier de sortie', {
      error: error.message,
      path: CONFIG.OUTPUT_DIR
    });
    throw new Error(`Impossible de créer le dossier de sortie: ${error.message}`);
  }
};

// Vérifier les polices disponibles
const checkFonts = (doc) => {
  const availableFonts = [];
  
  Object.entries(CONFIG.FONTS).forEach(([name, font]) => {
    try {
      doc.font(font);
      availableFonts.push({ name, available: true });
    } catch (error) {
      availableFonts.push({ name, available: false, error: error.message });
      logger.warn(`Police non disponible: ${font}`, { error: error.message });
    }
  });
  
  const missingFonts = availableFonts.filter(f => !f.available);
  if (missingFonts.length > 0) {
    logger.error('Polices manquantes', { missingFonts });
  }
  
  return availableFonts.every(f => f.available);
};

// Valider les données d'entrée
const validateInputData = (data, requiredFields) => {
  const errors = [];
  const missingFields = [];
  const invalidFields = [];
  
  requiredFields.forEach(field => {
    if (data[field] === undefined || data[field] === null || data[field] === '') {
      missingFields.push(field);
    } else if (field.includes('Date') && isNaN(new Date(data[field]).getTime())) {
      invalidFields.push({ field, value: data[field], reason: 'Format de date invalide' });
    }
  });
  
  if (missingFields.length > 0 || invalidFields.length > 0) {
    errors.push({
      type: 'VALIDATION_ERROR',
      message: 'Données d\'entrée invalides',
      missingFields,
      invalidFields
    });
  }
  
  return errors.length === 0 ? null : errors;
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

// Générer l'en-tête du document avec le drapeau du Tchad
const generateHeader = (doc) => {
  try {
    const { X, Y, WIDTH, HEIGHT } = CONFIG.FLAG;
    const stripeWidth = WIDTH / 3;
    
    // Fond blanc avec contour
    doc
      .rect(X, Y, WIDTH, HEIGHT)
      .fillAndStroke('white', 'black');
    
    // Bandes du drapeau
    doc
      .fillColor(CONFIG.COLORS.PRIMARY) // Bleu
      .rect(X, Y, stripeWidth, HEIGHT)
      .fill()
      .fillColor(CONFIG.COLORS.SECONDARY) // Jaune
      .rect(X + stripeWidth, Y, stripeWidth, HEIGHT)
      .fill()
      .fillColor(CONFIG.COLORS.ACCENT) // Rouge
      .rect(X + (stripeWidth * 2), Y, stripeWidth, HEIGHT)
      .fill();
    
    // Titre du document
    doc
      .fillColor('black')
      .font(CONFIG.FONTS.BOLD)
      .fontSize(16)
      .text('RÉPUBLIQUE DU TCHAD', 200, 60, { align: 'center' })
      .fontSize(12)
      .text('Unité - Travail - Progrès', 200, 80, { align: 'center' })
      .moveDown(2);
      
  } catch (error) {
    logger.error('Erreur lors de la génération de l\'en-tête', {
      error: error.message,
      stack: error.stack
    });
    throw new PdfGenerationError(
      'Erreur lors de la génération de l\'en-tête du document',
      'HEADER_GENERATION_ERROR',
      { originalError: error.message }
    );
  }
};

// Générer une section de formulaire avec titre et contenu
const generateFormSection = (doc, title, content, options = {}) => {
  const { y, height = 100, bgColor = CONFIG.COLORS.LIGHT_BG } = options;
  const sectionY = y || doc.y + 20;
  
  // Dessiner le cadre de la section
  doc
    .roundedRect(
      CONFIG.MARGINS.LEFT, 
      sectionY, 
      500, 
      height, 
      5
    )
    .stroke(CONFIG.COLORS.BORDER)
    .fill(bgColor);
  
  // Ajouter le titre de la section
  doc
    .font(CONFIG.FONTS.BOLD)
    .fontSize(12)
    .fillColor(CONFIG.COLORS.PRIMARY)
    .text(title, CONFIG.MARGINS.LEFT + 10, sectionY + 10);
  
  // Ajouter le contenu
  doc
    .font(CONFIG.FONTS.NORMAL)
    .fontSize(11)
    .fillColor(CONFIG.COLORS.TEXT);
  
  return { y: sectionY, height };
};

// Générer la section des informations de base
generateBasicInfoSection = (doc, data) => {
  const { y } = generateFormSection(
    doc, 
    'INFORMATIONS ADMINISTRATIVES',
    null,
    { height: 60, bgColor: '#F0F7FF' }
  );
  
  doc
    .text(`N°: ${data.numeroActe || 'N/A'}`, 60, y + 30, { width: 150 })
    .text(`Mairie de: ${data.mairie || 'N/A'}`, 220, y + 30, { width: 150 })
    .text(
      `Date: ${data.dateEtablissement ? new Date(data.dateEtablissement).toLocaleDateString('fr-FR') : 'N/A'}`,
      380, 
      y + 30, 
      { width: 150 }
    );
  
  doc.moveDown(4);
};

// Générer la section des informations de l'enfant
generateChildInfoSection = (doc, data) => {
  const { y } = generateFormSection(
    doc,
    'INFORMATIONS DE L\'ENFANT',
    null,
    { height: 120, bgColor: '#E6F3FF' }
  );
  
  doc
    .text(`Nom: ${data.nomEnfant || 'N/A'}`, 60, y + 35)
    .text(`Prénoms: ${data.prenomsEnfant || 'N/A'}`, 60, y + 55)
    .text(
      `Date de naissance: ${data.dateNaissance ? new Date(data.dateNaissance).toLocaleDateString('fr-FR') : 'N/A'}`,
      60, 
      y + 75
    )
    .text(`Heure de naissance: ${data.heureNaissance || 'N/A'}`, 300, y + 75)
    .text(`Lieu de naissance: ${data.lieuNaissance || 'N/A'}`, 60, y + 95)
    .text(
      `Sexe: ${data.sexe === 'M' ? 'Masculin' : data.sexe === 'F' ? 'Féminin' : 'N/A'}`,
      300, 
      y + 95
    );
  
  doc.moveDown(1);
};

// Générer la section des informations des parents
generateParentsSection = (doc, data) => {
  const { y } = generateFormSection(
    doc,
    'FILIATION',
    null,
    { height: 180, bgColor: '#FFF9E6' }
  );
  
  // Père
  doc
    .font(CONFIG.FONTS.BOLD)
    .text('PÈRE:', 60, y + 40)
    .font(CONFIG.FONTS.NORMAL)
    .text(`Nom: ${data.nomPere || 'N/A'}`, 90, y + 40)
    .text(`Prénoms: ${data.prenomsPere || 'N/A'}`, 90, y + 60);
    
  if (data.dateNaissancePere) {
    doc.text(
      `Date de naissance: ${new Date(data.dateNaissancePere).toLocaleDateString('fr-FR')}`,
      90,
      y + 80
    );
  }
  
  if (data.lieuNaissancePere) {
    doc.text(`Lieu de naissance: ${data.lieuNaissancePere}`, 90, y + 100);
  }
  
  if (data.professionPere) {
    doc.text(`Profession: ${data.professionPere}`, 90, y + 120);
  }
  
  // Mère
  doc
    .font(CONFIG.FONTS.BOLD)
    .text('MÈRE:', 300, y + 40)
    .font(CONFIG.FONTS.NORMAL)
    .text(`Nom: ${data.nomMere || 'N/A'}`, 330, y + 40)
    .text(`Prénoms: ${data.prenomsMere || 'N/A'}`, 330, y + 60);
    
  if (data.dateNaissanceMere) {
    doc.text(
      `Date de naissance: ${new Date(data.dateNaissanceMere).toLocaleDateString('fr-FR')}`,
      330,
      y + 80
    );
  }
  
  if (data.lieuNaissanceMere) {
    doc.text(`Lieu de naissance: ${data.lieuNaissanceMere}`, 330, y + 100);
  }
  
  if (data.professionMere) {
    doc.text(`Profession: ${data.professionMere}`, 330, y + 120);
  }
  
  doc.moveDown(3);
};

// Générer la section du déclarant (si disponible)
generateDeclarantSection = (doc, data) => {
  if (!data.nomDeclarant && !data.prenomsDeclarant) return;
  
  const { y } = generateFormSection(
    doc,
    'INFORMATIONS DU DÉCLARANT',
    null,
    { height: 100, bgColor: '#F5F5F5' }
  );
  
  doc
    .text(`Nom: ${data.nomDeclarant || 'N/A'}`, 60, y + 35)
    .text(`Prénoms: ${data.prenomsDeclarant || 'N/A'}`, 60, y + 55);
    
  if (data.lienDeclarant) {
    doc.text(`Lien avec l'enfant: ${data.lienDeclarant}`, 60, y + 75);
  }
  
  if (data.adresseDeclarant) {
    doc.text(`Adresse: ${data.adresseDeclarant}`, 300, y + 75);
  }
  
  doc.moveDown(2);
};

// Générer la section des observations (si disponible)
generateObservationsSection = (doc, data) => {
  if (!data.observations) return;
  
  const { y } = generateFormSection(
    doc,
    'OBSERVATIONS',
    null,
    { height: 80, bgColor: '#F5F5F5' }
  );
  
  doc.text(data.observations, {
    x: 60,
    y: y + 35,
    width: 480,
    align: 'justify'
  });
  
  doc.moveDown(3);
};

// Générer le pied de page avec la signature
generateFooter = (doc, data) => {
  doc
    .moveDown(2)
    .text(
      `Fait à ${data.mairie || 'N/A'}, le ${data.dateEtablissement ? new Date(data.dateEtablissement).toLocaleDateString('fr-FR') : ''}`,
      { align: 'right' }
    )
    .moveDown(3)
    .font(CONFIG.FONTS.BOLD)
    .text('Le Maire', { align: 'right' })
    .moveDown(2)
    .font(CONFIG.FONTS.NORMAL)
    .fontSize(10)
    .fillColor('#999999')
    .text('Cachet et signature', { align: 'right' });
};

/**
 * Génère un PDF pour un acte de naissance
 * @param {Object} data - Les données de l'acte de naissance
 * @returns {Promise<Buffer>} - Le buffer du PDF généré
 */
const generateNaissancePdf = async (data) => {
  const requestId = `pdf-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const log = (message, meta = {}) => {
    logger.info(`[${requestId}] ${message}`, meta);
  };
  
  log('Début de la génération du PDF', { data: JSON.stringify(data, null, 2) });
  
  try {
    // Vérifier les champs obligatoires
    const requiredFields = [
      'numeroActe', 
      'dateEtablissement', 
      'mairie', 
      'nomEnfant', 
      'prenomsEnfant', 
      'dateNaissance'
    ];
    
    const validationErrors = validateInputData(data, requiredFields);
    if (validationErrors) {
      log('Erreur de validation des données', { validationErrors });
      throw new PdfGenerationError(
        'Données d\'entrée invalides',
        'VALIDATION_ERROR',
        { validationErrors }
      );
    }
    
    // Créer le document PDF
    log('Création du document PDF...');
    const doc = new PDFDocument({ 
      margin: 50,
      bufferPages: true,
      size: 'A4'
    });
    
    // Vérifier les polices
    if (!checkFonts(doc)) {
      log('Polices manquantes, utilisation des polices par défaut');
    }
    
    // Configurer les gestionnaires d'événements
    return new Promise((resolve, reject) => {
      const buffers = [];
      
      doc.on('data', (chunk) => {
        buffers.push(chunk);
      });
      
      doc.on('error', (error) => {
        log('Erreur lors de la génération du PDF', {
          error: error.message,
          stack: error.stack
        });
        reject(new PdfGenerationError(
          'Erreur lors de la génération du PDF',
          'PDF_GENERATION_ERROR',
          { originalError: error.message }
        ));
      });
      
      doc.on('end', () => {
        try {
          const pdfBuffer = Buffer.concat(buffers);
          log('PDF généré avec succès', { bufferSize: pdfBuffer.length });
          resolve(pdfBuffer);
        } catch (error) {
          log('Erreur lors de la création du buffer PDF', {
            error: error.message,
            stack: error.stack
          });
          reject(new PdfGenerationError(
            'Erreur lors de la création du buffer PDF',
            'BUFFER_CREATION_ERROR',
            { originalError: error.message }
          ));
        }
      });
      
      // Générer le contenu du PDF
      try {
        // 1. En-tête avec drapeau
        generateHeader(doc);
        
        // 2. Titre du document
        doc
          .fontSize(18)
          .font(CONFIG.FONTS.BOLD)
          .text('ACTE DE NAISSANCE', { align: 'center' })
          .moveDown(0.5);
        
        // 3. Sections du document
        generateBasicInfoSection(doc, data);
        generateChildInfoSection(doc, data);
        generateParentsSection(doc, data);
        generateDeclarantSection(doc, data);
        generateObservationsSection(doc, data);
        generateFooter(doc, data);
        
        // Finaliser le document
        log('Finalisation du document PDF...');
        doc.end();
        
      } catch (error) {
        log('Erreur lors de la génération du contenu PDF', {
          error: error.message,
          stack: error.stack
        });
        reject(new PdfGenerationError(
          'Erreur lors de la génération du contenu PDF',
          'CONTENT_GENERATION_ERROR',
          { originalError: error.message }
        ));
      }
    });
    
  } catch (error) {
    log('Erreur critique lors de la génération du PDF', {
      error: error.message,
      stack: error.stack,
      code: error.code,
      details: error.details
    });
    
    if (error instanceof PdfGenerationError) {
      throw error;
    }
    
    throw new PdfGenerationError(
      'Erreur inattendue lors de la génération du PDF',
      'UNEXPECTED_ERROR',
      { originalError: error.message }
    );
  }
};

// Exporter les fonctions du module
module.exports = {
  generateNaissancePdf,
  generateHeader,
  generateFormSection,
  generateBasicInfoSection,
  generateChildInfoSection,
  generateParentsSection,
  generateDeclarantSection,
  generateObservationsSection,
  generateFooter,
  PdfGenerationError
};
