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
    PRIMARY: '#002689',
    SECONDARY: '#FFD100',
    ACCENT: '#CE1126',
    TEXT: '#333333',
    LIGHT_BG: '#F8F9FA',
    BORDER: '#CCCCCC'
  },
  MARGINS: {
    LEFT: 35,
    RIGHT: 35,
    TOP: 40,
    BOTTOM: 40
  },
  FLAG: {
    WIDTH: 80,  // Légèrement réduit pour gagner de l'espace
    HEIGHT: 48, // Légèrement réduit pour gagner de l'espace
    X: 50,
    Y: 40      // Position Y plus haute pour l'en-tête
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
      .text('RÉPUBLIQUE DU TCHAD', 180, 50, { align: 'center', width: 300 })
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
  
  // Vérifier si on a assez d'espace sur la page
  if (sectionY + height > doc.page.height - 50) {
    doc.addPage();
    sectionY = 50;
  }
  
  // Dessiner le cadre de la section
  doc
    .roundedRect(
      CONFIG.MARGINS.LEFT, 
      sectionY, 
      doc.page.width - (CONFIG.MARGINS.LEFT + CONFIG.MARGINS.RIGHT), 
      height, 
      3
    )
    .stroke(CONFIG.COLORS.BORDER)
    .fill(bgColor);
  
  // Ajouter le titre de la section
  doc
    .font(CONFIG.FONTS.BOLD)
    .fontSize(12)
    .fillColor('white')
    .fillOpacity(0.8)
    .rect(CONFIG.MARGINS.LEFT, sectionY, 150, 25)
    .fillAndStroke(CONFIG.COLORS.PRIMARY, CONFIG.COLORS.PRIMARY)
    .fillColor('white')
    .text(title, CONFIG.MARGINS.LEFT + 10, sectionY + 8, {
      width: 140,
      align: 'left'
    })
    .fillOpacity(1)
    .fillColor(CONFIG.COLORS.TEXT);
  
  // Positionner le curseur pour le contenu
  doc.y = sectionY + 30;
  
  return { 
    y: sectionY, 
    height,
    contentStartY: sectionY + 30,
    contentWidth: doc.page.width - (CONFIG.MARGINS.LEFT + CONFIG.MARGINS.RIGHT + 20)
  };
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
const generateChildInfoSection = (doc, data) => {
  const section = generateFormSection(
    doc,
    'INFORMATIONS DE L\'ENFANT',
    null,
    { height: 140, bgColor: '#E6F3FF' }
  );
  
  const startY = section.contentStartY;
  const col1 = 60;
  const col2 = 300;
  const lineHeight = 20;
  
  // Fonction utilitaire pour ajouter une ligne de texte avec gestion du débordement
  const addLine = (label, value, y, x = col1) => {
    doc
      .font(CONFIG.FONTS.BOLD)
      .fontSize(10)
      .text(`${label}: `, x, y, { width: 100, continued: true })
      .font(CONFIG.FONTS.NORMAL)
      .text(value || 'Non renseigné', { width: 200 });
    return y + lineHeight;
  };
  
  let currentY = startY;
  
  // Première ligne : Nom et Prénoms
  currentY = addLine('Nom', data.nomEnfant, currentY, col1);
  currentY = addLine('Prénoms', data.prenomsEnfant, currentY, col2);
  
  // Deuxième ligne : Date et Heure de naissance
  const dateNaissance = data.dateNaissance ? 
    new Date(data.dateNaissance).toLocaleDateString('fr-FR') : 'Non spécifiée';
  currentY = addLine('Date de naissance', dateNaissance, currentY, col1);
  currentY = addLine('Heure de naissance', data.heureNaissance || 'Non spécifiée', currentY - lineHeight, col2);
  
  // Troisième ligne : Lieu de naissance et Sexe
  currentY = addLine('Lieu de naissance', data.lieuNaissance, currentY, col1);
  const sexe = data.sexe === 'M' ? 'Masculin' : data.sexe === 'F' ? 'Féminin' : 'Non spécifié';
  addLine('Sexe', sexe, currentY - lineHeight, col2);
  
  // Mettre à jour la position Y du document
  doc.y = currentY + 10;
};

// Générer la section des informations des parents
const generateParentsSection = (doc, data) => {
  const section = generateFormSection(
    doc,
    'FILIATION',
    null,
    { height: 200, bgColor: '#FFF9E6' }
  );
  
  const startY = section.contentStartY;
  const col1 = 60;
  const col2 = 320;
  const lineHeight = 20;
  const labelWidth = 120;
  const valueWidth = 200;
  
  // Fonction utilitaire pour ajouter une ligne de texte
  const addParentLine = (label, value, y, x, isBold = false) => {
    doc
      .font(isBold ? CONFIG.FONTS.BOLD : CONFIG.FONTS.NORMAL)
      .fontSize(10)
      .text(label, x, y, { width: labelWidth });
      
    if (value) {
      doc
        .font(CONFIG.FONTS.NORMAL)
        .text(value, x + labelWidth, y, { width: valueWidth });
    }
    
    return y + lineHeight;
  };
  
  // Section Père
  let yPere = startY;
  doc.font(CONFIG.FONTS.BOLD).fontSize(11).text('PÈRE', col1, yPere);
  yPere += 20;
  
  yPere = addParentLine('Nom :', data.nomPere, yPere, col1);
  yPere = addParentLine('Prénoms :', data.prenomsPere, yPere, col1);
  
  if (data.dateNaissancePere) {
    const birthDate = new Date(data.dateNaissancePere).toLocaleDateString('fr-FR');
    yPere = addParentLine('Date de naissance :', birthDate, yPere, col1);
  }
  
  if (data.lieuNaissancePere) {
    yPere = addParentLine('Lieu de naissance :', data.lieuNaissancePere, yPere, col1);
  }
  
  if (data.professionPere) {
    yPere = addParentLine('Profession :', data.professionPere, yPere, col1);
  }
  
  // Section Mère
  let yMere = startY;
  doc.font(CONFIG.FONTS.BOLD).fontSize(11).text('MÈRE', col2, yMere);
  yMere += 20;
  
  yMere = addParentLine('Nom :', data.nomMere, yMere, col2);
  yMere = addParentLine('Prénoms :', data.prenomsMere, yMere, col2);
  
  if (data.dateNaissanceMere) {
    const birthDate = new Date(data.dateNaissanceMere).toLocaleDateString('fr-FR');
    yMere = addParentLine('Date de naissance :', birthDate, yMere, col2);
  }
  
  if (data.lieuNaissanceMere) {
    yMere = addParentLine('Lieu de naissance :', data.lieuNaissanceMere, yMere, col2);
  }
  
  if (data.professionMere) {
    yMere = addParentLine('Profession :', data.professionMere, yMere, col2);
  }
  
  // Mettre à jour la position Y du document avec la plus grande des deux colonnes
  doc.y = Math.max(yPere, yMere) + 10;
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
        // 1) En-tête (drapeau + titres République)
        generateHeader(doc);
        
        // Filigrane supprimé définitivement

        // Numéro de document (haut-gauche)
        doc
          .font(CONFIG.FONTS.NORMAL)
          .fontSize(10)
          .fillColor('#6c757d')
          .text(`N°: ${data.numeroActe || 'N/A'}`, CONFIG.MARGINS.LEFT, 20);

        // Timbre officiel supprimé selon la demande

        // 2) Titre principal et sous-titre
        doc
          .moveDown(3)
          .fontSize(22)
          .font(CONFIG.FONTS.BOLD)
          .fillColor('#0e5b23')
          .text('ACTE DE NAISSANCE', { 
            align: 'center',
            y: 120  // Position Y ajustée pour éviter le chevauchement
          })
          .fontSize(12)
          .fillColor('#212529')
          .text("Extrait des registres de l'état civil", { 
            align: 'center',
            y: 150  // Position Y ajustée pour le sous-titre
          })
          .moveDown(0.8);
        
        // 3) Informations sur l'enfant
        doc
          .moveDown(1)
          .font(CONFIG.FONTS.BOLD)
          .fontSize(13)
          .fillColor('#0e5b23')
          .text("INFORMATIONS SUR L'ENFANT");
        doc.moveDown(0.5);

        const colLeftX = 60;
        const colRightX = 300;
        const lineH = 18;
        let y = doc.y;
        const info = (label, value, x, yPos) => {
          doc
            .font(CONFIG.FONTS.BOLD)
            .fillColor('#0e5b23')
            .fontSize(10)
            .text(`${label} `, x, yPos, { continued: true })
            .font(CONFIG.FONTS.NORMAL)
            .fillColor('#212529')
            .text(value || 'Non spécifié');
        };
        const sexe = data.sexe === 'M' ? 'Masculin' : data.sexe === 'F' ? 'Féminin' : 'Non spécifié';
        info('Nom de famille :', data.nomEnfant, colLeftX, y); info('Prénom(s) :', data.prenomsEnfant, colRightX, y); y += lineH;
        info('Sexe :', sexe, colLeftX, y); info('Date de naissance :', data.dateNaissance ? new Date(data.dateNaissance).toLocaleDateString('fr-FR') : 'Non spécifiée', colRightX, y); y += lineH;
        info('Heure de naissance :', data.heureNaissance || 'Non spécifiée', colLeftX, y); info('Lieu de naissance :', data.lieuNaissance || 'Non spécifié', colRightX, y); y += lineH + 6;
        doc.y = y;

        // 4) Informations sur les parents
        doc
          .font(CONFIG.FONTS.BOLD)
          .fontSize(13)
          .fillColor('#0e5b23')
          .text('INFORMATIONS SUR LES PARENTS');
        doc.moveDown(0.5);
        y = doc.y;
        // Père
        doc
          .font(CONFIG.FONTS.NORMAL)
          .fillColor('#212529')
          .text('Père : ', colLeftX, y, { continued: true })
          .font(CONFIG.FONTS.BOLD)
          .text(`${data.nomPere || ''} ${data.prenomsPere || ''}`.trim());
        y += lineH;
        info('Date de naissance :', data.dateNaissancePere ? new Date(data.dateNaissancePere).toLocaleDateString('fr-FR') : 'Non spécifiée', colLeftX, y);
        info('Lieu de naissance :', data.lieuNaissancePere || 'Non spécifié', colRightX, y); y += lineH;
        // Mère
        doc
          .font(CONFIG.FONTS.NORMAL)
          .fillColor('#212529')
          .text('Mère : ', colLeftX, y, { continued: true })
          .font(CONFIG.FONTS.BOLD)
          .text(`${data.nomMere || ''} ${data.prenomsMere || ''}`.trim());
        y += lineH;
        info('Date de naissance :', data.dateNaissanceMere ? new Date(data.dateNaissanceMere).toLocaleDateString('fr-FR') : 'Non spécifiée', colLeftX, y);
        info('Lieu de naissance :', data.lieuNaissanceMere || 'Non spécifié', colRightX, y); y += lineH + 6;
        doc.y = y;

        // 5) Déclaration de naissance
        doc
          .font(CONFIG.FONTS.BOLD)
          .fontSize(13)
          .fillColor('#0e5b23')
          .text('DÉCLARATION DE NAISSANCE');
        doc.moveDown(0.5);
        y = doc.y;
        info('Déclarée le :', data.dateEtablissement ? new Date(data.dateEtablissement).toLocaleDateString('fr-FR') : 'Non spécifiée', colLeftX, y);
        info('Heure :', data.heureDeclaration || 'Non spécifiée', colRightX, y); y += lineH;
        const declarantTxt = data.declarant ? `${data.declarant.nom || ''} ${data.declarant.prenoms || ''}${data.declarant.qualite ? ` (${data.declarant.qualite})` : ''}`.trim() : 'Non spécifié';
        info('Déclarant :', declarantTxt, colLeftX, y); y += lineH;
        info('Lieu de déclaration :', data.mairie || 'Non spécifié', colLeftX, y); y += lineH;
        info("Officier de l'état civil :", data.officierEtatCivil || 'Non spécifié', colLeftX, y); y += lineH + 6;
        doc.y = y;

        // 6) Mentions marginales (infos admin)
        doc
          .font(CONFIG.FONTS.BOLD)
          .fontSize(13)
          .fillColor('#0e5b23')
          .text('MENTIONS MARGINALES');
        doc.moveDown(0.5);
        y = doc.y;
        info("Numéro d'acte :", data.numeroActe || 'N/A', colLeftX, y); info('Volume :', data.volume || 'N/A', colRightX, y); y += lineH;
        info("Date d'édition :", new Date().toLocaleDateString('fr-FR'), colLeftX, y); info('Registre :', 'Naissances 2023', colRightX, y); y += lineH + 12;
        doc.y = y;

        // 7) Signature
        doc
          .font(CONFIG.FONTS.NORMAL)
          .fillColor('#212529')
          .text(`Le Maire de ${data.mairie || ''},`, { align: 'right' })
          .text((data.maire || '').toString(), { align: 'right' });
        const sigX = doc.page.width - CONFIG.MARGINS.RIGHT - 250;
        const sigY = doc.y + 5;
        doc.moveTo(sigX, sigY).lineTo(sigX + 250, sigY).stroke('#000');
        doc.fontSize(10).fillColor('#6c757d').text('Signature et cachet', sigX, sigY + 5, { width: 250, align: 'center' });

        // 8) Pied de page
        doc
          .moveDown(2)
          .fontSize(9)
          .fillColor('#6c757d')
          .text("Document officiel délivré par la Mairie centrale", { align: 'center' })
          .text("Ce document est un modèle et n'a aucune valeur légale", { align: 'center' });
        
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
      details: error.details || {}
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

/**
 * Génère l'en-tête standard d'un acte avec le drapeau et le titre
 * @param {PDFDocument} doc - L'instance PDFKit
 * @param {string} title - Le titre de l'acte (ex: "ACTE DE NAISSANCE")
 * @param {Object} data - Les données de l'acte
 * @returns {number} La position Y après l'en-tête
 */
const generateActeHeader = (doc, title, data) => {
  // 1) En-tête (drapeau + titres République)
  generateHeader(doc);
  
  // Filigrane supprimé définitivement

  // Numéro de document (haut-gauche)
  doc
    .font(CONFIG.FONTS.NORMAL)
    .fontSize(10)
    .fillColor('#6c757d')
    .text(`N°: ${data.numeroActe || 'N/A'}`, CONFIG.MARGINS.LEFT, 20);

  // 2) Titre principal et sous-titre
  doc
    .moveDown(3)
    .fontSize(22)
    .font(CONFIG.FONTS.BOLD)
    .fillColor('#0e5b23')
    .text(title, { 
      align: 'center',
      y: 120
    })
    .fontSize(12)
    .fillColor('#212529')
    .text("Extrait des registres de l'état civil", { 
      align: 'center',
      y: 150
    })
    .moveDown(0.8);
    
  return 180; // Retourne la position Y après l'en-tête
};

/**
 * Génère une section d'information avec titre et contenu
 * @param {PDFDocument} doc - L'instance PDFKit
 * @param {string} title - Titre de la section
 * @param {Object} content - Contenu de la section
 * @param {Object} options - Options de mise en forme
 * @returns {number} La position Y après la section
 */
const generateSection = (doc, title, content, options = {}) => {
  const { y = doc.y, color = '#0e5b23' } = options;
  
  // Titre de la section
  doc
    .font(CONFIG.FONTS.BOLD)
    .fontSize(13)
    .fillColor(color)
    .text(title, { y: y + 10 });
    
  // Contenu de la section
  const startY = y + 30;
  
  // Retourne la position Y après la section
  return startY + (content.lines || 1) * 20;
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
  generateActeHeader,
  generateSection,
  PdfGenerationError
};
