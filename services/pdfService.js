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
    'numeroActe', 'dateDebutConcubinage', 'lieuEtablissement', 'officierEtatCivil',
    'concubin1.nom', 'concubin1.prenoms', 'concubin1.dateNaissance', 'concubin1.lieuNaissance',
    'concubin2.nom', 'concubin2.prenoms', 'concubin2.dateNaissance', 'concubin2.lieuNaissance',
    'adresseCommune', 'regimeBiens'
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
    
    // Section d'introduction
    doc
      .font(CONFIG.FONTS.NORMAL)
      .fontSize(11)
      .fillColor(CONFIG.COLORS.TEXT)
      .text(
        `L'an deux mille vingt-cinq, le ${utils.formatDate(data.dateEtablissement || new Date())}, ` +
        `à ${data.lieuEtablissement}, s'est présenté(e) devant l'officier de l'état civil :`,
        CONFIG.MARGINS.LEFT,
        y + 15,
        { align: 'justify', width: 500 }
      );
    
    y += 50;
    
    // Section des concubins
    y = contentGenerators.generateSection(doc, 'INFORMATIONS SUR LES CONCUBINS', {}, { y });
    
    // Fonction utilitaire pour formater les informations personnelles
    const formatPersonne = (personne, index) => {
      const type = index === 1 ? 'Premier(e)' : 'Deuxième';
      const situationMatrimoniale = personne.situationMatrimoniale || 'Non spécifiée';
      const typePiece = personne.typePieceIdentite || 'Non spécifié';
      const numPiece = personne.numeroPieceIdentite || 'Non spécifié';
      const nationalite = personne.nationalite || 'Tchadienne';
      
      return {
        titre: `${type} concubin(e)`,
        nomComplet: `${personne.nom || ''} ${personne.prenoms || ''}`.trim(),
        dateNaissance: utils.formatDate(personne.dateNaissance),
        lieuNaissance: personne.lieuNaissance || 'Non spécifié',
        profession: personne.profession || 'Sans profession',
        adresse: personne.adresse || 'Non spécifiée',
        nationalite,
        situationMatrimoniale,
        pieceIdentite: `${typePiece} n° ${numPiece}`,
        parents: {
          pere: personne.nomPere ? `${personne.prenomPere || ''} ${personne.nomPere || ''}`.trim() : 'Non spécifié',
          mere: personne.nomMere ? `${personne.prenomMere || ''} ${personne.nomMere || ''}`.trim() : 'Non spécifié',
          domicileParents: personne.domicileParents || 'Non spécifié'
        }
      };
    };
    
    const concubin1 = formatPersonne(data.concubin1, 1);
    const concubin2 = formatPersonne(data.concubin2, 2);
    
    // Fonction pour ajouter une section de concubin
    const addConcubinSection = (concubin, yPos) => {
      let currentY = yPos;
      
      // Titre de la section
      doc
        .font(CONFIG.FONTS.BOLD)
        .fontSize(11)
        .fillColor(CONFIG.COLORS.PRIMARY)
        .text(concubin.titre, CONFIG.MARGINS.LEFT, currentY);
      
      currentY += 15;
      
      // Cadre pour les informations
      currentY = contentGenerators.generateSectionBox(doc, CONFIG.MARGINS.LEFT, currentY, 500, 180);
      
      // Informations personnelles
      currentY = contentGenerators.generateInfoLine(doc, 'Nom et prénoms', concubin.nomComplet, CONFIG.MARGINS.LEFT + 20, currentY + 15);
      currentY = contentGenerators.generateInfoLine(doc, 'Né(e) le', concubin.dateNaissance, CONFIG.MARGINS.LEFT + 20, currentY + 10);
      currentY = contentGenerators.generateInfoLine(doc, 'À', concubin.lieuNaissance, CONFIG.MARGINS.LEFT + 20, currentY + 10);
      currentY = contentGenerators.generateInfoLine(doc, 'Profession', concubin.profession, CONFIG.MARGINS.LEFT + 20, currentY + 10);
      currentY = contentGenerators.generateInfoLine(doc, 'Domicile', concubin.adresse, CONFIG.MARGINS.LEFT + 20, currentY + 10);
      currentY = contentGenerators.generateInfoLine(doc, 'Nationalité', concubin.nationalite, CONFIG.MARGINS.LEFT + 20, currentY + 10);
      currentY = contentGenerators.generateInfoLine(doc, 'Situation matrimoniale', concubin.situationMatrimoniale, CONFIG.MARGINS.LEFT + 20, currentY + 10);
      currentY = contentGenerators.generateInfoLine(doc, 'Pièce d\'identité', concubin.pieceIdentite, CONFIG.MARGINS.LEFT + 20, currentY + 10);
      
      // Section parents
      currentY += 10;
      doc
        .font(CONFIG.FONTS.BOLD)
        .fontSize(10)
        .fillColor(CONFIG.COLORS.PRIMARY)
        .text('Parents :', CONFIG.MARGINS.LEFT + 20, currentY + 10);
      
      currentY = contentGenerators.generateInfoLine(doc, 'Père', concubin.parents.pere, CONFIG.MARGINS.LEFT + 40, currentY + 20);
      currentY = contentGenerators.generateInfoLine(doc, 'Mère', concubin.parents.mere, CONFIG.MARGINS.LEFT + 40, currentY + 10);
      currentY = contentGenerators.generateInfoLine(doc, 'Domicile des parents', concubin.parents.domicileParents, CONFIG.MARGINS.LEFT + 40, currentY + 10);
      
      return currentY + 20; // Retourne la position Y après la section
    };
    
    // Ajouter les sections pour les deux concubins
    y = addConcubinSection(concubin1, y + 10);
    y = addConcubinSection(concubin2, y);
    
    // Section des détails de l'engagement
    y = contentGenerators.generateSection(doc, "DÉTAILS DE L'ENGAGEMENT", {}, { y, color: CONFIG.COLORS.ACCENT });
    
    // Afficher les détails dans un cadre
    y = contentGenerators.generateSectionBox(doc, CONFIG.MARGINS.LEFT, y + 10, 500, 150);
    
    const regimeBiensLibelle = {
      'séparation de biens': 'Séparation de biens',
      'indivision': 'Indivision',
      'autre': data.detailsRegimeBiens || 'Autre (à préciser)'
    }[data.regimeBiens] || 'Non spécifié';
    
    y = contentGenerators.generateInfoLine(doc, 'Date de début du concubinage', utils.formatDate(data.dateDebutConcubinage), CONFIG.MARGINS.LEFT + 20, y + 15);
    y = contentGenerators.generateInfoLine(doc, 'Adresse commune', data.adresseCommune, CONFIG.MARGINS.LEFT + 20, y + 10);
    y = contentGenerators.generateInfoLine(doc, 'Régime des biens', regimeBiensLibelle, CONFIG.MARGINS.LEFT + 20, y + 10);
    
    if (data.observations) {
      y += 10;
      doc
        .font(CONFIG.FONTS.BOLD)
        .fontSize(10)
        .fillColor(CONFIG.COLORS.PRIMARY)
        .text('Observations :', CONFIG.MARGINS.LEFT + 20, y + 10);
      
      doc
        .font(CONFIG.FONTS.NORMAL)
        .fontSize(10)
        .fillColor(CONFIG.COLORS.TEXT)
        .text(data.observations, CONFIG.MARGINS.LEFT + 40, y + 25, {
          width: 440,
          align: 'justify',
          lineGap: 4
        });
      
      y += 40; // Ajuster selon la longueur du texte
    }
    
    // Section des témoins si disponibles
    if (data.temoins && data.temoins.length > 0) {
      y += 10;
      y = contentGenerators.generateSection(doc, 'TÉMOINS', {}, { y, color: CONFIG.COLORS.SECONDARY });
      
      // Afficher les témoins dans un cadre
      const temoinsHeight = 40 + (data.temoins.length * 80);
      y = contentGenerators.generateSectionBox(doc, CONFIG.MARGINS.LEFT, y + 10, 500, temoinsHeight);
      
      data.temoins.forEach((temoin, index) => {
        const temoinY = index === 0 ? y + 15 : y + 10;
        
        doc
          .font(CONFIG.FONTS.BOLD)
          .fontSize(10)
          .fillColor(CONFIG.COLORS.PRIMARY)
          .text(`Témoin ${index + 1}`, CONFIG.MARGINS.LEFT + 20, temoinY);
        
        y = contentGenerators.generateInfoLine(doc, 'Nom et prénoms', `${temoin.prenoms || ''} ${temoin.nom || ''}`.trim(), CONFIG.MARGINS.LEFT + 40, temoinY + 15);
        y = contentGenerators.generateInfoLine(doc, 'Né(e) le', utils.formatDate(temoin.dateNaissance), CONFIG.MARGINS.LEFT + 40, y + 10);
        y = contentGenerators.generateInfoLine(doc, 'Profession', temoin.profession || 'Non spécifiée', CONFIG.MARGINS.LEFT + 40, y + 10);
        y = contentGenerators.generateInfoLine(doc, 'Adresse', temoin.adresse || 'Non spécifiée', CONFIG.MARGINS.LEFT + 40, y + 10);
        y = contentGenerators.generateInfoLine(doc, 'Pièce d\'identité', `${temoin.typePieceIdentite || 'CNI'} n° ${temoin.numeroPieceIdentite || 'Non spécifié'}`, CONFIG.MARGINS.LEFT + 40, y + 10);
        
        y += 10; // Espacement entre les témoins
      });
    }
    
    // Section des mentions marginales si disponibles
    if (data.mentionsMarginales && data.mentionsMarginales.length > 0) {
      y += 10;
      y = contentGenerators.generateSection(doc, 'MENTIONS MARGINALES', {}, { y, color: CONFIG.COLORS.ACCENT });
      
      // Afficher les mentions dans un cadre
      const mentionsHeight = 20 + (data.mentionsMarginales.length * 25);
      y = contentGenerators.generateSectionBox(doc, CONFIG.MARGINS.LEFT, y + 10, 500, mentionsHeight);
      
      data.mentionsMarginales.forEach((mention, index) => {
        const mentionY = index === 0 ? y + 15 : y + 10;
        
        doc
          .font(CONFIG.FONTS.NORMAL)
          .fontSize(10)
          .fillColor(CONFIG.COLORS.TEXT)
          .text(`• ${mention.date ? utils.formatDate(mention.date) + ' - ' : ''}${mention.texte}`, CONFIG.MARGINS.LEFT + 20, mentionY, {
            width: 460,
            align: 'justify'
          });
        
        y = mentionY + 15;
      });
    }
    
    // Texte de conclusion
    y += 20;
    doc
      .font(CONFIG.FONTS.NORMAL)
      .fontSize(11)
      .fillColor(CONFIG.COLORS.TEXT)
      .text(
        `Les parties déclarent s'engager dans une vie commune en concubinage à compter du ${utils.formatDate(data.dateDebutConcubinage)} ` +
        `et avoir pris connaissance des dispositions légales applicables à leur situation.`,
        CONFIG.MARGINS.LEFT,
        y,
        { align: 'justify', width: 500 }
      );
    
    // Pied de page avec la signature
    y += 40;
    doc
      .moveTo(100, y)
      .lineTo(500, y)
      .stroke(CONFIG.COLORS.BORDER);
    
    // Date et lieu
    doc
      .font(CONFIG.FONTS.ITALIC)
      .fontSize(10)
      .fillColor('#6c757d')
      .text(
        `Fait à ${data.lieuEtablissement}, le ${utils.formatDate(data.dateEtablissement || new Date())}`,
        350,
        y + 10
      );
    
    // Signature de l'officier d'état civil
    doc
      .font(CONFIG.FONTS.NORMAL)
      .fontSize(10)
      .fillColor(CONFIG.COLORS.TEXT)
      .text('L\'officier d\'état civil,', 350, y + 40);
    
    doc
      .font(CONFIG.FONTS.BOLD)
      .fontSize(11)
      .fillColor(CONFIG.COLORS.PRIMARY)
      .text(data.officierEtatCivil || 'Nom de l\'officier', 350, y + 70);
    
    // Numéro de page
    doc
      .font(CONFIG.FONTS.NORMAL)
      .fontSize(8)
      .fillColor('#6c757d')
      .text(
        `Page 1/1 - ${data.numeroActe || ''}`,
        CONFIG.MARGINS.LEFT,
        800,
        { width: 500, align: 'right' }
      );
    
    // Finaliser le document
    doc.end();
    
    // Attendre la fin de la génération du PDF
    return await pdfPromise;
    
  } catch (error) {
    // En cas d'erreur, terminer le document et propager l'erreur
    if (!doc._ended) {
      doc.end();
    }
    
    logger.error('Erreur lors de la génération du PDF d\'engagement de concubinage', {
      error: error.message,
      stack: error.stack,
      data: JSON.stringify(data, null, 2).substring(0, 1000) + '...'
    });
    
    throw error instanceof PdfGenerationError 
      ? error 
      : new PdfGenerationError(
          'Erreur lors de la génération du PDF d\'engagement de concubinage',
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
