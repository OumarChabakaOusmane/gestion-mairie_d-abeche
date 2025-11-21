const generateDecesPdf = require('./generateDecesPdf');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Configuration centralisée
const PDF_CONFIG = {
  margins: { top: 50, right: 40, bottom: 50, left: 40 },
  colors: {
    primary: '#000000',
    secondary: '#333333',
    accent: '#555555',
    text: '#000000',
    border: '#cccccc'
  },
  fonts: {
    bold: 'Times-Bold',
    normal: 'Times-Roman',
    italic: 'Times-Italic'
  },
  lineHeight: 15,
  sectionSpacing: 20
};

// Helper: formater une date en FR avec validation
const formatDate = (date) => {
  if (!date) return '--/--/----';
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '--/--/----';
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch (e) {
    return '--/--/----';
  }
};

// Helper: nettoyer et formater les textes
const sanitizeText = (text, defaultValue = '') => {
  if (text === null || text === undefined || text === '') return defaultValue;
  return String(text).trim();
};

class PdfGenerationError extends Error {
  constructor(message, code = 'PDF_GENERATION_ERROR', details = {}) {
    super(message);
    this.name = 'PdfGenerationError';
    this.code = code;
    this.details = details;
  }
}

// Classe utilitaire pour la gestion du PDF
class PdfBuilder {
  constructor(doc, config = PDF_CONFIG) {
    this.doc = doc;
    this.config = config;
    this.y = config.margins.top;
  }

  // Méthode pour écrire une ligne avec label et valeur
  writeLine(label, value, options = {}) {
    const { 
      margin = this.config.margins.left, 
      lineHeight = this.config.lineHeight,
      labelWidth = 80,
      valueWidth = 200
    } = options;

    // Label en gras
    this.doc.font(this.config.fonts.bold)
           .fontSize(10)
           .fillColor(this.config.colors.primary)
           .text(sanitizeText(label), margin, this.y);

    // Valeur en police normale
    if (value !== undefined && value !== null && value !== '') {
      this.doc.font(this.config.fonts.normal)
             .fontSize(10)
             .fillColor(this.config.colors.text)
             .text(sanitizeText(value), margin + labelWidth, this.y, {
               width: valueWidth,
               continued: false
             });
    }

    this.y += lineHeight;
    return this.y;
  }

  // Méthode pour dessiner une section
  drawSection(title, subtitle = '') {
    // Titre de section
    this.doc.font(this.config.fonts.bold)
           .fontSize(12)
           .fillColor(this.config.colors.primary)
           .text(title, this.config.margins.left, this.y);

    this.y += 8;

    // Ligne de séparation
    this.doc.moveTo(this.config.margins.left, this.y)
           .lineTo(this.doc.page.width - this.config.margins.right, this.y)
           .lineWidth(0.5)
           .strokeColor(this.config.colors.border)
           .stroke();

    this.y += 12;

    // Sous-titre optionnel
    if (subtitle) {
      this.doc.font(this.config.fonts.normal)
             .fontSize(9)
             .fillColor(this.config.colors.secondary)
             .text(subtitle, this.config.margins.left, this.y);
      this.y += this.config.lineHeight;
    }

    return this.y;
  }

  // Méthode pour ajouter un espace
  addSpace(height = PDF_CONFIG.lineHeight) {
    this.y += height;
    return this.y;
  }

  // Méthode pour vérifier si on doit créer une nouvelle page
  checkPageBreak(minHeight = 100) {
    if (this.y > this.doc.page.height - this.config.margins.bottom - minHeight) {
      this.doc.addPage();
      this.y = this.config.margins.top;
      return true;
    }
    return false;
  }
}

// Fonction pour créer l'en-tête du document
const createHeader = (doc, title, numeroActe, config = PDF_CONFIG) => {
  let y = config.margins.top;

  // Drapeau du Tchad (optionnel)
  try {
    const flagPath = path.join(__dirname, '../public/images/td.png');
    if (fs.existsSync(flagPath)) {
      doc.image(flagPath, config.margins.left, 30, { width: 25 });
    }
  } catch (err) {
    console.warn('Drapeau non trouvé, continuation sans...');
  }

  // Titre principal
  doc.font(config.fonts.bold)
     .fontSize(14)
     .fillColor(config.colors.primary)
     .text('RÉPUBLIQUE DU TCHAD', { 
       align: 'center',
       y: y
     });
  
  y += 18;
  
  // Devise
  doc.font(config.fonts.bold)
     .fontSize(10)
     .fillColor(config.colors.secondary)
     .text('Unité - Travail - Progrès', {
       align: 'center',
       y: y
     });
  
  y += 20;
  
  // Mairie
  doc.font(config.fonts.bold)
     .fontSize(12)
     .fillColor(config.colors.primary)
     .text('MAIRIE DE LA VILLE D\'ABÉCHÉ', {
       align: 'center',
       y: y
     });
  
  y += 25;

  // Numéro d'acte
  if (numeroActe) {
    doc.font(config.fonts.bold)
       .fontSize(9)
       .fillColor(config.colors.text)
       .text(`N° ${sanitizeText(numeroActe)}`, {
         align: 'right',
         y: y
       });
  }
  
  y += 15;

  // Titre du document
  doc.font('Times-Bold')
     .fontSize(14)
     .fillColor(config.colors.primary)
     .text(title, {
       align: 'center',
       y: y
     });
  
  return y + 25;
};

// Fonction pour créer le pied de page
const createFooter = (doc, dateEtablissement, config = PDF_CONFIG) => {
  const footerY = doc.page.height - config.margins.bottom - 80;
  
  // Ligne de séparation
  doc.moveTo(config.margins.left, footerY)
     .lineTo(doc.page.width - config.margins.right, footerY)
     .lineWidth(0.5)
     .strokeColor(config.colors.border)
     .stroke();
  
  // Date
  doc.font(config.fonts.normal)
     .fontSize(9)
     .fillColor(config.colors.text)
     .text(`Fait à Abéché, le ${formatDate(dateEtablissement)}`, 
           config.margins.left, footerY + 10);
  
  // Signature
  doc.font(config.fonts.bold)
     .fontSize(9)
     .text('L\'Officier d\'état civil', 
           doc.page.width - 150, footerY + 30);
  
  // Cachet
  const stampSize = 45;
  const stampX = doc.page.width - config.margins.right - stampSize;
  const stampY = footerY + 5;
  
  doc.circle(stampX + stampSize/2, stampY + stampSize/2, stampSize/2)
     .strokeColor(config.colors.accent)
     .lineWidth(1)
     .stroke();
  
  doc.font(config.fonts.bold)
     .fontSize(7)
     .fillColor(config.colors.accent)
     .text('CACHET', stampX, stampY + 15, { 
       width: stampSize, 
       align: 'center' 
     })
     .text('OFFICIEL', stampX, stampY + 25, { 
       width: stampSize, 
       align: 'center' 
     });
};

// Fonction pour générer un PDF d'acte de naissance (version améliorée)
const generateNaissancePdf = (data) => {
  console.log('=== DÉBUT generateNaissancePdf ===');
  console.log('Données reçues dans generateNaissancePdf:', JSON.stringify(data, null, 2));
  
  return new Promise((resolve, reject) => {
    try {
      console.log('Création du document PDF...');
      // Réduire les marges pour gagner de l'espace
      const doc = new PDFDocument({ 
        size: 'A4', 
        bufferPages: true,
        margins: { top: 30, right: 40, bottom: 20, left: 40 }
      });
      
      const buffers = [];
      
      // Extraire et formater les données
      const details = data.details || {};
      const pdfData = {
        ...data,
        ...details,
        // Formater les noms complets
        nom: (details.nom || data.nom || '').toUpperCase(),
        prenoms: details.prenom || data.prenoms || '',
        dateNaissance: details.dateNaissance || data.dateNaissance || '',
        lieuNaissance: details.lieuNaissance || data.lieuNaissance || '',
        sexe: details.sexe || data.sexe || '',
        // Formater les noms des parents
        pere: details.pere ? 
          `${details.pere} ${details.prenomPere || ''}`.trim() : 
          (data.pere || 'NON DÉCLARÉ'),
        mere: details.mere ? 
          `${details.mere} ${details.prenomMere || ''}`.trim() : 
          (data.mere || 'NON DÉCLARÉE'),
        // Informations du déclarant
        declarant: {
          nom: details.nomDeclarant || (data.declarant?.nom || ''),
          prenom: details.prenomsDeclarant || (data.declarant?.prenom || ''),
          lien: details.lienDeclarant || (data.declarant?.lien || 'NON DÉCLARÉ'),
          adresse: details.adresseDeclarant || (data.declarant?.adresse || 'NON DÉCLARÉE')
        },
        // Numéro d'acte avec valeur par défaut
        numeroActe: data.numeroActe || '.../MAT-SG/DGAT/DLP/...',
        // Date d'établissement avec valeur par défaut
        dateEtablissement: data.dateEtablissement || new Date().toISOString()
      };
      // Configuration des gestionnaires d'événements pour le buffer
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      // Position de départ
      let y = 80;  // Position initiale plus basse pour laisser de l'espace pour l'en-tête

      // Position Y de départ pour l'en-tête
      let headerY = 50;
      
      // Dimensions et espacements
      const flagWidth = 50;
      const leftMargin = 50;  // Réduit la marge gauche
      const rightMargin = doc.page.width - 100;  // Ajusté pour l'équilibre
      const centerX = doc.page.width / 2;
      const textLeftMargin = leftMargin + flagWidth + 30;  // 30px d'espace après le drapeau
      const textRightMargin = rightMargin - 30;  // 30px d'espace avant le logo
      const textWidth = textRightMargin - textLeftMargin;  // Largeur disponible pour le texte
      
      // Ajout du drapeau à gauche
      const flagPath = path.join(__dirname, '../public/images/td.png');
      if (fs.existsSync(flagPath)) {
        doc.image(flagPath, leftMargin, headerY, { width: flagWidth });
      }
      
      // Chemin vers l'image du logo
      const logoPath = path.join(__dirname, '../public/images/logotchad.png');
      
      // Ajout du logo à droite s'il existe
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, rightMargin, headerY, { 
          width: flagWidth
        });
      } else {
        console.warn('Logo non trouvé à l\'emplacement:', logoPath);
      }
      
      // Texte centré entre les deux images avec espacement
      doc.font('Helvetica-Bold')
         .fontSize(14)
         .fillColor('#000000')
         .text('RÉPUBLIQUE DU TCHAD', textLeftMargin, headerY + 5, {
           width: textWidth,
           align: 'center'
         })
         .font('Helvetica')
         .fontSize(10)
         .text('Unité - Travail - Progrès', textLeftMargin, headerY + 25, {
           width: textWidth,
           align: 'center'
         })
         .font('Helvetica-Bold')
         .fontSize(12)
         .text('MAIRIE DE LA VILLE D\'ABÉCHÉ', textLeftMargin, headerY + 45, {
           width: textWidth,
           align: 'center'
         });

      // Numéro d'acte à droite
      doc.font('Helvetica-Bold')
         .fontSize(12)
         .fillColor('#000000')
         .text(`N° ${sanitizeText(pdfData.numeroActe)}`, {
             align: 'right',
             x: doc.page.width - 50,
             y: 45
         });

      // Titre du document
      y = 130;  // Position après l'en-tête
      doc.font('Times-Bold')
         .fontSize(14)
         .fillColor('#000000')
         .text('EXTRAIT D\'ACTE DE NAISSANCE', {
             align: 'center',
             y: y
         });

      y += 25;  // Espace après le titre
      
      // Fonction utilitaire pour écrire les champs
      // Constante pour l'espacement des lignes
      const lineHeight = 25;
      
      const writeField = (label, value, yOffset) => {
        const x = 70; // Marge gauche
        const labelWidth = 200; // Largeur fixe pour les labels
        const valueX = x + labelWidth + 10; // Position X pour les valeurs
        
        doc.font('Helvetica-Bold')
           .fontSize(12)
           .fillColor('#000000')
           .text(label, x, y + yOffset);
           
        doc.font('Helvetica')
           .fontSize(12)
           .fillColor('#000000')
           .text(value || '................................', valueX, y + yOffset);
      };
      
      // Informations de l'enfant avec espacement fixe
      writeField('NOM :', pdfData.nom, 0);
      writeField('Prénoms :', pdfData.prenoms, lineHeight);
      writeField('Date de naissance :', formatDate(pdfData.dateNaissance), lineHeight * 2);
      writeField('Heure de naissance :', pdfData.heureNaissance || '..............', lineHeight * 3);
      writeField('Lieu de naissance :', pdfData.lieuNaissance, lineHeight * 4);
      writeField('Sexe :', pdfData.sexe, lineHeight * 5);
      
      // Section Parents
      y += lineHeight * 7; // Espace avant la section parents
      doc.font('Helvetica-Bold')
         .fontSize(14)
         .fillColor('#000000')
         .text('PARENTS', 70, y);
      
      y += lineHeight; // Espace après le titre
      
      // Informations du père
      writeField('Père :', pdfData.pere, 0);
      writeField('Date de naissance du père :', pdfData.dateNaissancePere ? formatDate(pdfData.dateNaissancePere) : '..............', lineHeight);
      writeField('Lieu de naissance du père :', pdfData.lieuNaissancePere || '..............', lineHeight * 2);
      writeField('Nationalité du père :', pdfData.nationalitePere || '..............', lineHeight * 3);
      writeField('Profession du père :', pdfData.professionPere || '..............', lineHeight * 4);
      
      // Informations de la mère
      y += lineHeight * 6; // Espace avant la section mère
      writeField('Mère :', pdfData.mere, 0);
      writeField('Date de naissance de la mère :', pdfData.dateNaissanceMere ? formatDate(pdfData.dateNaissanceMere) : '..............', lineHeight);
      writeField('Lieu de naissance de la mère :', pdfData.lieuNaissanceMere || '..............', lineHeight * 2);
      writeField('Nationalité de la mère :', pdfData.nationaliteMere || '..............', lineHeight * 3);
      writeField('Profession de la mère :', pdfData.professionMere || '..............', lineHeight * 4);
      
      // Signature et date
      y = doc.page.height - 100; // Position fixe en bas de page
      const signatureX = 70;
      const signatureY = y + 20;
      
      // Ligne de signature
      doc.moveTo(signatureX, signatureY)
         .lineTo(signatureX + 150, signatureY)
         .lineWidth(1)
         .stroke('#000000');
      
      // Texte de la signature
      doc.font('Helvetica')
         .fontSize(11)
         .text("L'Officier d'État Civil", signatureX, signatureY + 5);
      
      // Date
      doc.font('Helvetica')
         .fontSize(11)
         .text(`Fait à Abéché, le ${formatDate(pdfData.dateEtablissement)}`, signatureX, y);
      
      // Suppression du pied de page

      console.log('Données utilisées pour la génération du PDF:', JSON.stringify(pdfData, null, 2));
      console.log('Finalisation du document PDF...');
      doc.end();
    } catch (err) {
      console.error('=== ERREUR dans generateNaissancePdf ===');
      console.error('Type d\'erreur:', typeof err);
      console.error('Message d\'erreur:', err.message);
      console.error('Stack trace:', err.stack);
      
      const error = new PdfGenerationError(
        `Erreur lors de la génération du PDF de naissance: ${err.message}`,
        'NAISSANCE_PDF_ERROR',
        { 
          original: {
            name: err.name,
            message: err.message,
            stack: err.stack
          } 
        }
      );
      
      console.error('Erreur de génération PDF:', error);
      reject(error);
    } finally {
      console.log('=== FIN generateNaissancePdf ===');
    }
  });
};

// Configuration des couleurs (déjà définies plus haut dans le fichier)

// Configuration des marges et espacements pour une seule page
const MARGIN_LEFT = 40;
const MARGIN_RIGHT = 40;
const MARGIN_TOP = 20;
const MARGIN_BOTTOM = 30;
const LINE_HEIGHT = 12;  // Réduit pour gagner de l'espace
const TEXT_WIDTH = 520;  // Légèrement augmenté pour utiliser toute la largeur

// Les fonctions drawSectionTitle et createHeader sont déjà définies plus haut dans le fichier

// Fonction utilitaire pour afficher un champ avec label et valeur alignés
const drawField = (doc, label, value, yPos, options = {}) => {
  const leftMargin = options.leftMargin || MARGIN_LEFT;
  const labelWidth = options.labelWidth || 150;
  const lineHeight = options.lineHeight || LINE_HEIGHT;
  const valueWidth = options.valueWidth || (TEXT_WIDTH - labelWidth - 30);
  
  // Label en gras
  doc.font('Helvetica-Bold')
     .fontSize(10)
     .fillColor('#333333')
     .text(label, leftMargin, yPos, { width: labelWidth, align: 'left' });
  
  // Deux-points
  doc.text(' : ', leftMargin + labelWidth, yPos);
  
  // Valeur
  doc.font('Helvetica')
     .fontSize(10)
     .fillColor('#000000')
     .text(String(value || 'Non spécifié'), leftMargin + labelWidth + 15, yPos, {
       width: valueWidth,
       lineGap: 2
     });
  
  return yPos + lineHeight;
};

// Fonction pour dessiner un titre de section avec une ligne en dessous
const drawSectionTitle = (doc, title, yPos) => {
  doc.font('Helvetica-Bold')
     .fontSize(12)
     .fillColor('#000000')
     .text(title, MARGIN_LEFT, yPos + 10);
  
  // Ligne de séparation
  doc.moveTo(MARGIN_LEFT, yPos + 25)
     .lineTo(MARGIN_LEFT + TEXT_WIDTH, yPos + 25)
     .lineWidth(0.5)
     .strokeColor('#CCCCCC')
     .stroke();
  
  return yPos + 35; // Retourne la nouvelle position Y
};

// Fonction utilitaire pour formater une date au format français
const formatDateFr = (date) => {
  if (!date) return '--/--/----';
  try {
    const d = new Date(date);
    return d.toLocaleDateString('fr-FR');
  } catch (e) {
    return '--/--/----';
  }
};

// Fonction pour générer un PDF d'acte de mariage avec une mise en page professionnelle
const generateMariagePdf = (data) => {
  return new Promise((resolve, reject) => {
    const buffers = [];
    
    const doc = new PDFDocument({ 
      size: 'A4',
      bufferPages: true,
      margins: { 
        top: MARGIN_TOP, 
        right: MARGIN_RIGHT, 
        bottom: MARGIN_BOTTOM, 
        left: MARGIN_LEFT 
      },
      info: {
        Title: `Acte de Mariage ${data.numeroActe || ''}`,
        Author: 'Mairie d\'Abéché',
        Creator: 'Système de Gestion des Actes d\'État Civil',
        CreationDate: new Date()
      }
    });

    try {
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      // Créer l'en-tête
      let y = createHeader(doc, 'EXTRAIT D\'ACTE DE MARIAGE', data.numeroActe);
      
      // Ajouter la date d'établissement
      doc.font('Helvetica')
         .fontSize(10)
         .fillColor('#333333')
         .text(`Fait à Abéché, le ${new Date().toLocaleDateString('fr-FR')}`, 0, y, { 
           align: 'right', 
           width: TEXT_WIDTH 
         });
      
      y += 30; // Espace après l'en-tête

      // Section I - Informations sur l'époux (version compacte)
      y = drawSectionTitle(doc, 'I – INFORMATIONS SUR L\'ÉPOUX', y);
      
      // Récupérer les données du conjoint 1 (époux) - version optimisée
      let conjoint1 = {
        nom: '',
        prenom: '',
        dateNaissance: '',
        lieuNaissance: '',
        profession: '',
        adresse: '',
        nationalite: 'TCHADIEN(NE)',
        pere: 'Non renseigné',
        mere: 'Non renseignée'
      };
      
      if (data.details?.conjoint1_details) {
        const c = data.details.conjoint1_details;
        conjoint1 = {
          nom: c.nom || data.details.conjoint1 || '',
          prenom: c.prenom || data.details.prenomConjoint1 || '',
          dateNaissance: c.dateNaissance || data.details.dateNaissanceConjoint1 || '',
          lieuNaissance: c.lieuNaissance || data.details.lieuNaissanceConjoint1 || '',
          profession: c.profession || data.details.professionConjoint1 || '',
          adresse: c.adresse || data.details.adresseConjoint1 || '',
          nationalite: c.nationalite || 'TCHADIEN(NE)',
          pere: (c.pere && typeof c.pere === 'object' ? c.pere.nom : c.pere) || 'Non renseigné',
          mere: (c.mere && typeof c.mere === 'object' ? c.mere.nom : c.mere) || 'Non renseignée'
        };
      } else if (data.conjoint1) {
        conjoint1 = { ...conjoint1, ...data.conjoint1 };
      }
      // Affichage compact des informations de l'époux
      y = drawField(doc, 'Nom, Prénoms', 
        `${(conjoint1.nom || '').toUpperCase() || 'NON RENSEIGNÉ'}, ${conjoint1.prenom || ''}`, 
        y, { labelWidth: 120, lineHeight: 10 });
      
      y = drawField(doc, 'Né(e) le/à', 
        `${formatDateFr(conjoint1.dateNaissance)} à ${conjoint1.lieuNaissance || 'NON RENSEIGNÉ'}`, 
        y, { labelWidth: 120, lineHeight: 10 });
      
      y = drawField(doc, 'Fils de', 
        `${conjoint1.pere || 'NON RENSEIGNÉ'} et de ${conjoint1.mere || 'NON RENSEIGNÉE'}`, 
        y, { labelWidth: 120, lineHeight: 10 });
      
      y = drawField(doc, 'Profession', 
        conjoint1.profession || 'NON RENSEIGNÉE', 
        y, { labelWidth: 120, lineHeight: 10 });
      
      y = drawField(doc, 'Domicile', 
        conjoint1.adresse || 'NON RENSEIGNÉ', 
        y, { labelWidth: 120, lineHeight: 10 });
      
      y = drawField(doc, 'Nationalité', 
        conjoint1.nationalite || 'TCHADIEN(NE)', 
        y, { labelWidth: 120, lineHeight: 10 });
      
      // Réduire l'espace entre les sections
      y += 5;
      
      // Section II - Informations sur l'épouse (version compacte)
      y = drawSectionTitle(doc, 'II – INFORMATIONS SUR L\'ÉPOUSE', y);
      
      // Récupérer les données du conjoint 2 (épouse) - version optimisée
      let conjoint2 = {
        nom: '',
        prenom: '',
        dateNaissance: '',
        lieuNaissance: '',
        profession: '',
        adresse: '',
        nationalite: 'TCHADIEN(NE)',
        pere: 'Non renseigné',
        mere: 'Non renseignée'
      };
      
      if (data.details?.conjoint2_details) {
        const c = data.details.conjoint2_details;
        conjoint2 = {
          nom: c.nom || data.details.conjoint2Nom || data.details.conjointe2 || '',
          prenom: c.prenom || data.details.conjoint2Prenom || data.details.prenomConjoint2 || '',
          dateNaissance: c.dateNaissance || data.details.dateNaissanceConjoint2 || '',
          lieuNaissance: c.lieuNaissance || data.details.lieuNaissanceConjoint2 || '',
          profession: c.profession || data.details.professionConjoint2 || '',
          adresse: c.adresse || data.details.adresseConjoint2 || '',
          nationalite: c.nationalite || 'TCHADIEN(NE)',
          pere: (c.pere && typeof c.pere === 'object' ? c.pere.nom : c.pere) || 'Non renseigné',
          mere: (c.mere && typeof c.mere === 'object' ? c.mere.nom : c.mere) || 'Non renseignée'
        };
      } else if (data.conjoint2) {
        conjoint2 = { ...conjoint2, ...data.conjoint2 };
      }
      // Affichage compact des informations de l'épouse
      y = drawField(doc, 'Nom, Prénoms', 
        `${(conjoint2.nom || '').toUpperCase() || 'NON RENSEIGNÉE'}, ${conjoint2.prenom || ''}`, 
        y, { labelWidth: 120, lineHeight: 10 });
      
      y = drawField(doc, 'Né(e) le/à', 
        `${formatDateFr(conjoint2.dateNaissance)} à ${conjoint2.lieuNaissance || 'NON RENSEIGNÉ'}`, 
        y, { labelWidth: 120, lineHeight: 10 });
      
      y = drawField(doc, 'Fille de', 
        `${conjoint2.pere || 'NON RENSEIGNÉ'} et de ${conjoint2.mere || 'NON RENSEIGNÉE'}`, 
        y, { labelWidth: 120, lineHeight: 10 });
      
      y = drawField(doc, 'Profession', 
        conjoint2.profession || 'NON RENSEIGNÉE', 
        y, { labelWidth: 120, lineHeight: 10 });
      
      y = drawField(doc, 'Domicile', 
        conjoint2.adresse || 'NON RENSEIGNÉ', 
        y, { labelWidth: 120, lineHeight: 10 });
      
      y = drawField(doc, 'Nationalité', 
        conjoint2.nationalite || 'TCHADIEN(NE)', 
        y, { labelWidth: 120, lineHeight: 10 });
      
      // Réduire l'espace entre les sections
      y += 5;
      
      // Section III - Informations sur le mariage (version compacte)
      y = drawSectionTitle(doc, 'III – INFORMATIONS SUR LE MARIAGE', y);
      
      // Récupérer les données du mariage
      const mariageDate = formatDateFr(data.details?.dateMariage || data.dateMariage);
      const mariageLieu = (data.details?.lieuMariage || data.lieuMariage || 'NON RENSEIGNÉ').toUpperCase();
      const regime = (data.details?.regimeMatrimonial || data.regimeMatrimonial || 'communauté réduite aux acquêts').toUpperCase();
      
      // Afficher les informations du mariage sur une seule ligne
      y = drawField(doc, 'Mariage célébré le', 
        `Le ${mariageDate} à ${mariageLieu} sous le régime de la ${regime}`, 
        y, { labelWidth: 150, lineHeight: 10 });
      
      // Ajouter l'heure du mariage si disponible
      if (data.details?.heureMariage) {
        y = drawField(doc, 'Heure', 
          data.details.heureMariage, 
          y, { labelWidth: 150, lineHeight: 10 });
      }
      
      // Réduire l'espace entre les sections
      y += 5;
      
      // Section IV - Témoins (version compacte)
      y = drawSectionTitle(doc, 'IV – TÉMOINS', y);
      
      const temoins = data.details?.temoins || data.temoins || [];
      if (temoins.length > 0) {
        // Afficher les témoins côte à côte
        const temoin1 = temoins[0] || {};
        const temoin2 = temoins[1] || {};
        
        // Ligne 1: Noms des témoins
        y = drawField(doc, 'Témoins', 
          `1. ${(temoin1.nom || '').toUpperCase() || 'NON RENSEIGNÉ'}` + 
          (temoins.length > 1 ? `       2. ${(temoin2.nom || '').toUpperCase() || 'NON RENSEIGNÉ'}` : ''), 
          y, { labelWidth: 80, lineHeight: 10 });
        
        // Ligne 2: Professions
        y = drawField(doc, 'Professions', 
          `${temoin1.profession || temoin1.metier || 'NON RENSEIGNÉE'}` + 
          (temoins.length > 1 ? `       ${temoin2.profession || temoin2.metier || 'NON RENSEIGNÉE'}` : ''), 
          y, { labelWidth: 80, lineHeight: 10 });
        
        // Ligne 3: Domiciles
        y = drawField(doc, 'Domiciles', 
          `${temoin1.adresse || temoin1.residence || 'NON RENSEIGNÉ'}` + 
          (temoins.length > 1 ? `       ${temoin2.adresse || temoin2.residence || 'NON RENSEIGNÉ'}` : ''), 
          y, { labelWidth: 80, lineHeight: 10 });
      } else {
        y = drawField(doc, 'Témoins', 'NON RENSEIGNÉS', y, { labelWidth: 120, lineHeight: 10 });
      }
      
      // Section de signature (version compacte)
      y += 10; // Réduire l'espace avant la signature
      
      // Ajuster la position Y si on est trop bas sur la page
      if (y > 700) {
        // Réduire la taille de police pour gagner de la place
        doc.fontSize(9);
      }
      
      // Date d'établissement formatée
      const dateEtablissement = new Date().toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });
      
      // Position X pour la signature (décalée à droite)
      const signatureX = 350;
      const signatureY = y;
      
      // Texte de la date et lieu
      doc.font('Helvetica')
         .fontSize(9)
         .fillColor('#333333')
         .text('Fait à Abéché, le ' + dateEtablissement, MARGIN_LEFT, signatureY);
      
      // Ligne de signature
      doc.moveTo(MARGIN_LEFT, signatureY + 15)
         .lineTo(MARGIN_LEFT + 200, signatureY + 15)
         .lineWidth(0.8)
         .stroke('#000000');
      
      // Texte de la signature
      doc.font('Helvetica-Bold')
         .fontSize(9)
         .fillColor('#000000')
         .text("L'Officier d'État Civil", MARGIN_LEFT, signatureY + 20);
      
      // Ajout du cachet et de la signature à droite (version plus petite)
      try {
        const signaturePath = path.join(__dirname, '../public/images/signature.png');
        if (fs.existsSync(signaturePath)) {
          doc.image(signaturePath, signatureX, signatureY - 5, { width: 100 });
        } else {
          console.warn('Fichier de signature non trouvé :', signaturePath);
        }
      } catch (err) {
        console.warn('Erreur lors du chargement de la signature :', err.message);
      }
      
      // Ajouter le numéro d'acte en bas de page
      if (data.numeroActe) {
        doc.font('Helvetica')
           .fontSize(8)
           .fillColor('#666666')
           .text(`Acte n° ${data.numeroActe}`, MARGIN_LEFT, 800, {
             align: 'left',
             width: TEXT_WIDTH
           });
      }

      // Finaliser le document
      doc.end();
    } catch (error) {
      console.error('Erreur dans generateMariagePdf:', error);
      // Vérifier si l'erreur est déjà une instance de PdfGenerationError
      if (error instanceof PdfGenerationError) {
        reject(error);
      } else {
        // Créer une nouvelle erreur avec plus de détails
        const errorDetails = {
          message: error.message,
          stack: error.stack,
          data: JSON.stringify(data, null, 2)
        };
        
        console.error('Détails de l\'erreur:', errorDetails);
        
        reject(new PdfGenerationError(
          `Erreur lors de la génération du PDF de mariage: ${error.message}`,
          'MARIAGE_PDF_ERROR',
          { 
            originalError: error.message,
            stack: error.stack,
            dataType: typeof data
          }
        ));
      }
    }
  });
};

// Fonction principale de génération de PDF
const generatePdf = async (type, data) => {
  console.log('=== DÉBUT generatePdf ===');
  console.log('Type de document:', type);
  console.log('Données reçues:', JSON.stringify(data, null, 2));
  
  try {
    // Validation des données de base
    if (!data) {
      const error = new PdfGenerationError('Données manquantes pour la génération du PDF');
      console.error('Erreur de validation des données:', error);
      throw error;
    }

    console.log('Appel de la fonction de génération pour le type:', type);
    
    let result;
    switch (type) {
      case 'naissance':
        console.log('Génération PDF de naissance...');
        result = await generateNaissancePdf(data);
        break;
      case 'mariage':
        console.log('Génération PDF de mariage...');
        result = await generateMariagePdf(data);
        break;
      case 'deces':
        console.log('Génération PDF de décès...');
        result = await generateDecesPdf(data);
        break;
      default:
        const error = new PdfGenerationError(`Type de document non supporté: ${type}`);
        console.error('Type de document non supporté:', error);
        throw error;
    }
    
    console.log('PDF généré avec succès, taille du buffer:', result?.length || 'inconnue');
    return result;
  } catch (err) {
    console.error('=== ERREUR dans generatePdf ===');
    console.error('Type d\'erreur:', typeof err);
    console.error('Message d\'erreur:', err.message);
    console.error('Stack trace:', err.stack);
    
    if (err instanceof PdfGenerationError) {
      console.error('Erreur de génération PDF connue:', err);
      throw err;
    }
    
    const wrappedError = new PdfGenerationError(
      err.message || 'Erreur lors de la génération du PDF', 
      'GENERATION_ERROR', 
      { 
        original: {
          name: err.name,
          message: err.message,
          stack: err.stack
        } 
      }
    );
    
    console.error('Erreur enveloppée dans PdfGenerationError:', wrappedError);
    throw wrappedError;
  } finally {
    console.log('=== FIN generatePdf ===');
  }
};

module.exports = {
  generatePdf,
  PdfGenerationError,
  PDF_CONFIG // Export pour réutilisation
};