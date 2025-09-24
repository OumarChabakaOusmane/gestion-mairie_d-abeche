const PDFDocument = require('pdfkit');
const { logger } = require('../config/logger');

/**
 * Service PDF unifié pour tous les types d'actes
 * Utilise la même structure professionnelle pour tous les documents
 */

// Couleurs et styles cohérents
const COLORS = {
  primary: '#0e5b23',      // Vert foncé pour les titres
  secondary: '#212529',     // Noir pour le texte principal
  gray: '#6c757d',         // Gris pour les labels
  lightGray: '#dee2e6',    // Gris clair pour les séparateurs
  background: '#f8f9fa',   // Fond gris très clair
  white: '#ffffff',        // Blanc
  flag: {
    blue: '#002689',
    yellow: '#FFD100', 
    red: '#CE1126'
  }
};

const FONTS = {
  title: { size: 19, weight: 'bold' },
  subtitle: { size: 11, weight: 'bold' },
  label: { size: 9, weight: 'normal' },
  text: { size: 9, weight: 'normal' },
  small: { size: 7, weight: 'normal' }
};

/**
 * Génère l'en-tête standard avec le drapeau du Tchad
 */
function generateHeader(doc, acteData) {
  const marginTop = 36;
  const marginLeft = 35;
  const marginRight = 35;
  
  // Drapeau du Tchad (plus petit et mieux positionné)
  const flagX = marginLeft;
  const flagY = marginTop;
  const flagWidth = 54;
  const flagHeight = 36;
  
  // Fond blanc du drapeau
  doc.rect(flagX, flagY, flagWidth, flagHeight)
     .fillColor(COLORS.white)
     .fill()
     .strokeColor('#000000')
     .lineWidth(0.5)
     .stroke();
  
  // Bandes du drapeau
  doc.rect(flagX, flagY, flagWidth/3, flagHeight)
     .fillColor(COLORS.flag.blue)
     .fill();
  doc.rect(flagX + flagWidth/3, flagY, flagWidth/3, flagHeight)
     .fillColor(COLORS.flag.yellow)
     .fill();
  doc.rect(flagX + 2*flagWidth/3, flagY, flagWidth/3, flagHeight)
     .fillColor(COLORS.flag.red)
     .fill();
  
  // Contour du drapeau
  doc.rect(flagX, flagY, flagWidth, flagHeight)
     .strokeColor('#000000')
     .lineWidth(0.5)
     .stroke();
  
  // Texte officiel
  const textX = flagX + flagWidth + 15;
  doc.fillColor(COLORS.secondary);
  doc.fontSize(15).font('Helvetica-Bold')
     .text('RÉPUBLIQUE DU TCHAD', textX, flagY + 5);
  doc.fontSize(10).font('Helvetica-Oblique')
     .text('Unité - Travail - Progrès', textX, flagY + 25);
  
  // Numéro d'acte en haut à droite
  const acteNumber = acteData.numeroActe || 'En cours de génération';
  doc.fontSize(10).font('Helvetica-Bold')
     .fillColor(COLORS.primary)
     .text(`N° ${acteNumber}`, doc.page.width - marginRight - 100, flagY + 5, { width: 100, align: 'right' });
  
  return flagY + flagHeight + 20; // Retourne la position Y pour la suite
}

/**
 * Génère le filigrane (SUPPRIMÉ)
 */
function generateWatermark(doc) {
  // Filigrane supprimé définitivement
  return;
}

/**
 * Génère le titre principal de l'acte
 */
function generateMainTitle(doc, title, subtitle = '') {
  const marginLeft = 35;
  const marginRight = 35;
  
  // Titre principal
  doc.fillColor(COLORS.primary);
  doc.fontSize(FONTS.title.size).font('Helvetica-Bold')
     .text(title, marginLeft, 120, { 
       width: doc.page.width - marginLeft - marginRight,
       align: 'center' 
     });
  
  // Sous-titre si fourni
  if (subtitle) {
    doc.fillColor(COLORS.gray);
    doc.fontSize(FONTS.small.size).font('Helvetica')
       .text(subtitle, marginLeft, 150, { 
         width: doc.page.width - marginLeft - marginRight,
         align: 'center' 
       });
  }
  
  return subtitle ? 170 : 150; // Retourne la position Y pour la suite
}

/**
 * Génère une section avec titre et contenu
 */
function generateSection(doc, title, content, startY) {
  const marginLeft = 35;
  const marginRight = 35;
  const sectionWidth = doc.page.width - marginLeft - marginRight;
  
  let y = startY + 16;
  
  // Titre de section
  doc.fillColor(COLORS.primary);
  doc.fontSize(FONTS.subtitle.size).font('Helvetica-Bold')
     .text(title, marginLeft, y);
  
  y += 16;
  
  // Ligne de séparation
  doc.moveTo(marginLeft, y)
     .lineTo(doc.page.width - marginRight, y)
     .strokeColor(COLORS.lightGray)
     .lineWidth(1)
     .stroke();
  
  // Espace entre le titre et le contenu (réduit pour compacter)
  y += 10;
  
  // Contenu de la section
  if (typeof content === 'string') {
    doc.fillColor(COLORS.secondary);
    doc.fontSize(FONTS.text.size).font('Helvetica')
       .text(content, marginLeft, y, { 
         width: sectionWidth,
         lineGap: 3 
       });
    // Calcul dynamique de la hauteur du bloc de texte
    const blockH = doc.heightOfString(content, { width: sectionWidth, lineGap: 2 });
    y += blockH + 4;
  } else if (Array.isArray(content)) {
    const labelColWidth = 105;
    const valueColWidth = sectionWidth - labelColWidth - 10;
    content.forEach(item => {
      if (typeof item === 'string') {
        doc.fillColor(COLORS.secondary);
        doc.fontSize(FONTS.text.size).font('Helvetica');
        const blockH = doc.heightOfString(item, { width: sectionWidth, lineGap: 2 });
        doc.text(item, marginLeft, y, { width: sectionWidth, lineGap: 2 });
        y += blockH + 4;
      } else if (item && (item.label || item.value)) {
        const labelText = item.label ? `${item.label} :` : '';
        const valueText = item.value ? String(item.value) : '';

        // Mesurer les hauteurs selon les polices utilisées
        doc.font('Helvetica').fontSize(FONTS.label.size);
        const labelH = labelText 
          ? doc.heightOfString(labelText, { width: labelColWidth }) 
          : 0;

        doc.font('Helvetica').fontSize(FONTS.text.size);
        const valueH = valueText 
          ? doc.heightOfString(valueText, { width: valueColWidth }) 
          : 0;

        const rowH = Math.max(labelH, valueH) || FONTS.text.size + 4;

        // Dessiner label et valeur
        if (labelText) {
          doc.fillColor(COLORS.gray).font('Helvetica').fontSize(FONTS.label.size)
             .text(labelText, marginLeft, y, { width: labelColWidth });
        }
        if (valueText) {
          doc.fillColor(COLORS.secondary).font('Helvetica').fontSize(FONTS.text.size)
             .text(valueText, marginLeft + labelColWidth + 10, y, { width: valueColWidth });
        }

        y += rowH + 3; // petit espace entre lignes
      }
    });
  }
  
  // Espace après la section (réduit)
  return y + 8;
}

/**
 * Génère la zone de signature
 */
function generateSignatureArea(doc, mairie, dateEnregistrement, startY) {
  const marginLeft = 35;
  const marginRight = 35;
  
  let y = startY + 20;
  
  // Ligne de signature
  doc.moveTo(marginLeft + 200, y)
     .lineTo(doc.page.width - marginRight, y)
     .strokeColor(COLORS.lightGray)
     .lineWidth(0.5)
     .stroke();
  
  // Texte de signature
  const signatureText = `Fait à ${mairie || 'N\'Djamena'}, le ${dateEnregistrement ? new Date(dateEnregistrement).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR')}`;
  
  doc.fillColor(COLORS.gray);
  doc.fontSize(FONTS.small.size).font('Helvetica')
     .text(signatureText, marginLeft + 200, y + 10, { 
       width: doc.page.width - marginRight - marginLeft - 200,
       align: 'right' 
     });
  
  y += 30;
  
  // Signature de l'officier
  doc.fillColor(COLORS.secondary);
  doc.fontSize(FONTS.text.size).font('Helvetica-Bold')
     .text('L\'Officier de l\'État Civil', marginLeft + 200, y, { 
       width: doc.page.width - marginRight - marginLeft - 200,
       align: 'right' 
     });
  
  y += 20;
  
  // Ligne pour la signature
  doc.moveTo(marginLeft + 200, y)
     .lineTo(doc.page.width - marginRight, y)
     .strokeColor(COLORS.secondary)
     .lineWidth(0.5)
     .stroke();
  
  doc.fillColor(COLORS.gray);
  doc.fontSize(FONTS.small.size).font('Helvetica')
     .text('Signature et cachet', marginLeft + 200, y + 5, { 
       width: doc.page.width - marginRight - marginLeft - 200,
       align: 'right' 
     });
  
  return y + 30;
}

/**
 * Génère un PDF d'acte de naissance
 */
async function generateNaissancePdf(acteData) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ 
        size: 'A4', 
        margins: { top: 40, bottom: 40, left: 35, right: 35 }
      });
      
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      
      const details = acteData.details || {};
      
      // En-tête
      generateHeader(doc, acteData);
      
      // Filigrane
      generateWatermark(doc);
      
      // Titre principal
      generateMainTitle(doc, 'ACTE DE NAISSANCE', 'Certificat officiel de naissance');
      
      // Section informations sur l'enfant
      const enfantInfo = [
        { label: 'Nom de famille', value: (details.nom || '').toUpperCase() },
        { label: 'Prénom(s)', value: details.prenom || '' },
        { label: 'Sexe', value: details.sexe === 'M' ? 'Masculin' : details.sexe === 'F' ? 'Féminin' : '' },
        { label: 'Date de naissance', value: details.dateNaissance ? new Date(details.dateNaissance).toLocaleDateString('fr-FR') : '' },
        { label: 'Heure de naissance', value: details.heureNaissance || '' },
        { label: 'Lieu de naissance', value: details.lieuNaissance || '' }
      ];
      
      let y = generateSection(doc, 'INFORMATIONS SUR L\'ENFANT', enfantInfo, 170);
      
      // Section informations sur les parents
      const parentsInfo = [
        { label: 'Père', value: `${details.nomPere || details.pere || ''} ${details.prenomPere || ''}`.trim() },
        { label: 'Date de naissance du père', value: details.dateNaissancePere ? new Date(details.dateNaissancePere).toLocaleDateString('fr-FR') : '' },
        { label: 'Lieu de naissance du père', value: details.lieuNaissancePere || '' },
        { label: 'Mère', value: `${details.nomMere || details.mere || ''} ${details.prenomMere || ''}`.trim() },
        { label: 'Date de naissance de la mère', value: details.dateNaissanceMere ? new Date(details.dateNaissanceMere).toLocaleDateString('fr-FR') : '' },
        { label: 'Lieu de naissance de la mère', value: details.lieuNaissanceMere || '' },
        { label: 'Profession du père', value: details.professionPere || '' },
        { label: 'Profession de la mère', value: details.professionMere || '' },
        { label: 'Domicile des parents', value: details.adresse || '' }
      ];
      
      y = generateSection(doc, 'INFORMATIONS SUR LES PARENTS', parentsInfo, y);
      
      // Section déclaration
      const declarationText = `Nous, Officier de l'État Civil, certifions que l'enfant mentionné ci-dessus est né le ${details.dateNaissance ? new Date(details.dateNaissance).toLocaleDateString('fr-FR') : ''} à ${details.lieuNaissance || ''} et déclaré par ses parents.`;
      
      y = generateSection(doc, 'DÉCLARATION DE NAISSANCE', declarationText, y);
      
      // Section mentions marginales
      const mentionsText = 'Aucune mention marginale à ce jour.';
      y = generateSection(doc, 'MENTIONS MARGINALES', mentionsText, y);
      
      // Zone de signature
      generateSignatureArea(doc, acteData.mairie, acteData.dateEnregistrement, y);
      
      doc.end();
      
    } catch (error) {
      logger.error('Erreur lors de la génération du PDF de naissance', { error: error.message });
      reject(error);
    }
  });
}

/**
 * Génère un PDF d'acte de mariage
 */
async function generateMariagePdf(acteData) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ 
        size: 'A4', 
        margins: { top: 40, bottom: 40, left: 35, right: 35 }
      });
      
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      
      const details = acteData.details || {};
      
      // En-tête
      generateHeader(doc, acteData);
      
      // Filigrane
      generateWatermark(doc);
      
      // Titre principal
      generateMainTitle(doc, 'ACTE DE MARIAGE', 'Certificat officiel de mariage');
      
      // Section informations sur les époux
      const epouxInfo = [
        { label: 'Premier époux/épouse', value: `${details.conjoint1 || ''} ${details.prenomConjoint1 || ''}`.trim() },
        { label: 'Deuxième époux/épouse', value: `${details.conjoint2 || ''} ${details.prenomConjoint2 || ''}`.trim() },
        { label: 'Date de mariage', value: details.dateMariage ? new Date(details.dateMariage).toLocaleDateString('fr-FR') : '' },
        { label: 'Lieu de mariage', value: details.lieuMariage || '' },
        { label: 'Profession du premier époux', value: details.professionConjoint1 || '' },
        { label: 'Profession du deuxième époux', value: details.professionConjoint2 || '' }
      ];
      
      let y = generateSection(doc, 'INFORMATIONS SUR LES ÉPOUX', epouxInfo, 170);
      
      // Section témoins
      const temoinsInfo = [
        { label: 'Premier témoin', value: `${details.temoin1 || ''} ${details.prenomTemoin1 || ''}`.trim() },
        { label: 'Deuxième témoin', value: `${details.temoin2 || ''} ${details.prenomTemoin2 || ''}`.trim() },
        { label: 'Profession du premier témoin', value: details.professionTemoin1 || '' },
        { label: 'Profession du deuxième témoin', value: details.professionTemoin2 || '' }
      ];
      
      y = generateSection(doc, 'INFORMATIONS SUR LES TÉMOINS', temoinsInfo, y);
      
      // Section déclaration
      const declarationText = `Nous, Officier de l'État Civil, certifions que le mariage entre ${details.conjoint1 || ''} et ${details.conjoint2 || ''} a été célébré le ${details.dateMariage ? new Date(details.dateMariage).toLocaleDateString('fr-FR') : ''} à ${details.lieuMariage || ''} en présence des témoins mentionnés ci-dessus.`;
      
      y = generateSection(doc, 'DÉCLARATION DE MARIAGE', declarationText, y);
      
      // Section mentions marginales
      const mentionsText = 'Aucune mention marginale à ce jour.';
      y = generateSection(doc, 'MENTIONS MARGINALES', mentionsText, y);
      
      // Zone de signature
      generateSignatureArea(doc, acteData.mairie, acteData.dateEnregistrement, y);
      
      doc.end();
      
    } catch (error) {
      logger.error('Erreur lors de la génération du PDF de mariage', { error: error.message });
      reject(error);
    }
  });
}

/**
 * Génère un PDF d'acte de décès
 */
async function generateDecesPdf(acteData) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ 
        size: 'A4', 
        margins: { top: 40, bottom: 40, left: 35, right: 35 }
      });
      
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      
      const details = acteData.details || {};
      
      // En-tête
      generateHeader(doc, acteData);
      
      // Filigrane
      generateWatermark(doc);
      
      // Titre principal
      generateMainTitle(doc, 'ACTE DE DÉCÈS', 'Certificat officiel de décès');
      
      // Section informations sur le défunt
      const defuntInfo = [
        { label: 'Nom de famille', value: (details.nomDefunt || '').toUpperCase() },
        { label: 'Prénom(s)', value: details.prenomsDefunt || '' },
        { label: 'Date de naissance', value: details.dateNaissanceDefunt ? new Date(details.dateNaissanceDefunt).toLocaleDateString('fr-FR') : '' },
        { label: 'Lieu de naissance', value: details.lieuNaissanceDefunt || '' },
        { label: 'Profession', value: details.professionDefunt || '' },
        { label: 'Domicile', value: details.domicileDefunt || '' },
        { label: 'Date du décès', value: details.dateDeces ? new Date(details.dateDeces).toLocaleDateString('fr-FR') : '' },
        { label: 'Heure du décès', value: details.heureDeces || '' },
        { label: 'Lieu du décès', value: details.lieuDeces || '' },
        { label: 'Cause du décès', value: details.causeDeces || '' }
      ];
      
      let y = generateSection(doc, 'INFORMATIONS SUR LE DÉFUNT', defuntInfo, 170);
      
      // Section informations sur le déclarant
      const declarantInfo = [
        { label: 'Nom de famille', value: (details.nomDeclarant || '').toUpperCase() },
        { label: 'Prénom(s)', value: details.prenomsDeclarant || '' },
        { label: 'Date de naissance', value: details.dateNaissanceDeclarant ? new Date(details.dateNaissanceDeclarant).toLocaleDateString('fr-FR') : '' },
        { label: 'Lieu de naissance', value: details.lieuNaissanceDeclarant || '' },
        { label: 'Profession', value: details.professionDeclarant || '' },
        { label: 'Domicile', value: details.domicileDeclarant || '' },
        { label: 'Lien avec le défunt', value: details.lienDeclarant || '' }
      ];
      
      y = generateSection(doc, 'INFORMATIONS SUR LE DÉCLARANT', declarantInfo, y);
      
      // Section déclaration
      const declarationText = `Nous, Officier de l'État Civil, certifions que ${details.nomDefunt || ''} ${details.prenomsDefunt || ''} est décédé(e) le ${details.dateDeces ? new Date(details.dateDeces).toLocaleDateString('fr-FR') : ''} à ${details.lieuDeces || ''} et déclaré par ${details.nomDeclarant || ''} ${details.prenomsDeclarant || ''}.`;
      
      y = generateSection(doc, 'DÉCLARATION DE DÉCÈS', declarationText, y);
      
      // Section mentions marginales
      const mentionsText = 'Aucune mention marginale à ce jour.';
      y = generateSection(doc, 'MENTIONS MARGINALES', mentionsText, y);
      
      // Zone de signature
      generateSignatureArea(doc, acteData.mairie, acteData.dateEnregistrement, y);
      
      doc.end();
      
    } catch (error) {
      logger.error('Erreur lors de la génération du PDF de décès', { error: error.message });
      reject(error);
    }
  });
}

/**
 * Génère un PDF d'acte d'engagement de concubinage
 */
async function generateEngagementPdf(acteData) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ 
        size: 'A4', 
        margins: { top: 40, bottom: 40, left: 35, right: 35 }
      });
      
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      
      const details = acteData.details || {};
      
      // En-tête
      generateHeader(doc, acteData);
      
      // Filigrane
      generateWatermark(doc);
      
      // Titre principal
      generateMainTitle(doc, 'ACTE D\'ENGAGEMENT DE CONCUBINAGE', 'Certificat officiel d\'engagement');
      
      // Section informations sur les concubins
      const concubinsInfo = [
        { label: 'Premier concubin', value: `${details.concubin1 || ''} ${details.prenomConcubin1 || ''}`.trim() },
        { label: 'Deuxième concubin', value: `${details.concubin2 || ''} ${details.prenomConcubin2 || ''}`.trim() },
        { label: 'Date d\'engagement', value: details.dateEngagement ? new Date(details.dateEngagement).toLocaleDateString('fr-FR') : '' },
        { label: 'Lieu d\'engagement', value: details.lieuEngagement || '' },
        { label: 'Profession du premier concubin', value: details.professionConcubin1 || '' },
        { label: 'Profession du deuxième concubin', value: details.professionConcubin2 || '' }
      ];
      
      let y = generateSection(doc, 'INFORMATIONS SUR LES CONCUBINS', concubinsInfo, 170);
      
      // Section témoins
      const temoinsInfo = [
        { label: 'Premier témoin', value: `${details.temoin1 || ''} ${details.prenomTemoin1 || ''}`.trim() },
        { label: 'Deuxième témoin', value: `${details.temoin2 || ''} ${details.prenomTemoin2 || ''}`.trim() },
        { label: 'Profession du premier témoin', value: details.professionTemoin1 || '' },
        { label: 'Profession du deuxième témoin', value: details.professionTemoin2 || '' }
      ];
      
      y = generateSection(doc, 'INFORMATIONS SUR LES TÉMOINS', temoinsInfo, y);
      
      // Section déclaration
      const declarationText = `Nous, Officier de l'État Civil, certifions que l'engagement de concubinage entre ${details.concubin1 || ''} et ${details.concubin2 || ''} a été enregistré le ${details.dateEngagement ? new Date(details.dateEngagement).toLocaleDateString('fr-FR') : ''} à ${details.lieuEngagement || ''} en présence des témoins mentionnés ci-dessus.`;
      
      y = generateSection(doc, 'DÉCLARATION D\'ENGAGEMENT', declarationText, y);
      
      // Section mentions marginales
      const mentionsText = 'Aucune mention marginale à ce jour.';
      y = generateSection(doc, 'MENTIONS MARGINALES', mentionsText, y);
      
      // Zone de signature
      generateSignatureArea(doc, acteData.mairie, acteData.dateEnregistrement, y);
      
      doc.end();
      
    } catch (error) {
      logger.error('Erreur lors de la génération du PDF d\'engagement', { error: error.message });
      reject(error);
    }
  });
}

/**
 * Génère un PDF d'acte de divorce
 */
async function generateDivorcePdf(acteData) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ 
        size: 'A4', 
        margins: { top: 40, bottom: 40, left: 35, right: 35 }
      });
      
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      
      const details = acteData.details || {};
      
      // En-tête
      generateHeader(doc, acteData);
      
      // Filigrane
      generateWatermark(doc);
      
      // Titre principal
      generateMainTitle(doc, 'ACTE DE DIVORCE', 'Certificat officiel de divorce');
      
      // Section informations sur les ex-époux
      const exEpouxInfo = [
        { label: 'Premier ex-époux/épouse', value: `${details.exConjoint1 || ''} ${details.prenomExConjoint1 || ''}`.trim() },
        { label: 'Deuxième ex-époux/épouse', value: `${details.exConjoint2 || ''} ${details.prenomExConjoint2 || ''}`.trim() },
        { label: 'Date de divorce', value: details.dateDivorce ? new Date(details.dateDivorce).toLocaleDateString('fr-FR') : '' },
        { label: 'Lieu de divorce', value: details.lieuDivorce || '' },
        { label: 'Motif du divorce', value: details.motifDivorce || '' },
        { label: 'Profession du premier ex-époux', value: details.professionExConjoint1 || '' },
        { label: 'Profession du deuxième ex-époux', value: details.professionExConjoint2 || '' }
      ];
      
      let y = generateSection(doc, 'INFORMATIONS SUR LES EX-ÉPOUX', exEpouxInfo, 170);
      
      // Section enfants
      if (details.enfants && details.enfants.length > 0) {
        const enfantsInfo = details.enfants.map((enfant, index) => ({
          label: `Enfant ${index + 1}`,
          value: `${enfant.nom || ''} ${enfant.prenom || ''}`.trim()
        }));
        
        y = generateSection(doc, 'INFORMATIONS SUR LES ENFANTS', enfantsInfo, y);
      }
      
      // Section déclaration
      const declarationText = `Nous, Officier de l'État Civil, certifions que le divorce entre ${details.exConjoint1 || ''} et ${details.exConjoint2 || ''} a été prononcé le ${details.dateDivorce ? new Date(details.dateDivorce).toLocaleDateString('fr-FR') : ''} à ${details.lieuDivorce || ''} pour le motif suivant: ${details.motifDivorce || ''}.`;
      
      y = generateSection(doc, 'DÉCLARATION DE DIVORCE', declarationText, y);
      
      // Section mentions marginales
      const mentionsText = 'Aucune mention marginale à ce jour.';
      y = generateSection(doc, 'MENTIONS MARGINALES', mentionsText, y);
      
      // Zone de signature
      generateSignatureArea(doc, acteData.mairie, acteData.dateEnregistrement, y);
      
      doc.end();
      
    } catch (error) {
      logger.error('Erreur lors de la génération du PDF de divorce', { error: error.message });
      reject(error);
    }
  });
}

/**
 * Fonction principale pour générer un PDF selon le type d'acte
 */
async function generatePdf(type, acteData) {
  logger.info(`Début de génération du PDF de type: ${type}`);
  
  try {
    let result;
    
    switch (type.toLowerCase()) {
      case 'naissance':
        result = await generateNaissancePdf(acteData);
        break;
        
      case 'mariage':
        result = await generateMariagePdf(acteData);
        break;
        
      case 'deces':
        result = await generateDecesPdf(acteData);
        break;
        
      case 'engagement-concubinage':
        result = await generateEngagementPdf(acteData);
        break;
        
      case 'divorce':
        result = await generateDivorcePdf(acteData);
        break;
        
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
}

module.exports = {
  generatePdf,
  generateNaissancePdf,
  generateMariagePdf,
  generateDecesPdf,
  generateEngagementPdf,
  generateDivorcePdf
};
