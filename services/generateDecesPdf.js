const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Configuration des chemins
const publicPath = path.join(__dirname, '../public');
const imagesPath = path.join(publicPath, 'images');
const fontsPath = path.join(publicPath, 'fonts');

// Configuration des couleurs (alignées avec pdfService.js)
const colors = {
  primary: '#000000',    // Noir pour les titres
  secondary: '#333333',  // Gris foncé pour le texte secondaire
  accent: '#555555',     // Gris foncé pour les éléments importants
  text: '#000000',       // Noir pour le texte normal
  border: '#cccccc',     // Gris clair pour les bordures
  darkGray: '#666666',   // Gris pour les éléments secondaires
  lightGray: '#f5f5f5'   // Gris très clair pour les fonds
};

/**
 * Affiche un titre de section avec un style élégant
 */
const drawSectionTitle = (doc, title, y) => {
  const startY = y + 10;

  // Style du titre
  doc.font('Helvetica-Bold')
    .fontSize(12)
    .fillColor(colors.primary)
    .text(title.toUpperCase(), 50, startY, {
      align: 'left',
      width: doc.page.width - 100
    });

  // Ligne de séparation fine
  doc.moveTo(50, startY + 15)
    .lineTo(doc.page.width - 50, startY + 15)
    .lineWidth(0.5)
    .stroke(colors.border);

  return startY + 30; // Retourne la position Y après le titre
};

// Configuration des polices
const fonts = {
  bold: 'Helvetica-Bold',
  normal: 'Helvetica',
  italic: 'Helvetica-Oblique'
};

/**
 * Formate une date au format français
 */
const formatDate = (dateString) => {
  if (!dateString) return '--/--/----';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '--/--/----';
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    return '--/--/----';
  }
};

/**
 * Nettoie et formate le texte
 */
const sanitizeText = (text, defaultValue = '') => {
  if (text === null || text === undefined || text === '') return defaultValue;
  return String(text).trim();
};

/**
 * Crée l'en-tête du document
 */
const createHeader = (doc, title, numeroActe) => {
  const headerY = 50;

  // Chemins des images
  const flagPath = path.join(imagesPath, 'td.png');
  const logoPath = path.join(imagesPath, 'logotchad.png');

  // Ajout du drapeau à gauche
  if (fs.existsSync(flagPath)) {
    doc.image(flagPath, 50, headerY, { width: 50 });
  }

  // Ajout du logo à droite
  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, doc.page.width - 100, headerY, { width: 50 });
  }

  // Texte centré
  doc.font(fonts.bold)
    .fontSize(14)
    .fillColor(colors.primary)
    .text('RÉPUBLIQUE DU TCHAD', 120, headerY + 5, {
      width: doc.page.width - 240,
      align: 'center'
    })
    .font(fonts.normal)
    .fontSize(10)
    .text('Unité - Travail - Progrès', 120, headerY + 25, {
      width: doc.page.width - 240,
      align: 'center'
    });

  // Titre du document
  doc.font(fonts.bold)
    .fontSize(12)
    .text(title.toUpperCase(), 120, headerY + 50, {
      width: doc.page.width - 240,
      align: 'center'
    });

  // Numéro d'acte
  doc.font(fonts.normal)
    .fontSize(10)
    .text(`N° ${numeroActe || '.../MAT-SG/DGAT/DLP/...'}`, 50, headerY + 80, {
      align: 'right',
      width: doc.page.width - 100
    });

  // Ligne de séparation
  doc.moveTo(50, headerY + 100)
    .lineTo(doc.page.width - 50, headerY + 100)
    .stroke(colors.primary);

  return headerY + 120;
};

/**
 * Crée le pied de page
 */
const createFooter = (doc, dateEtablissement) => {
  const footerY = doc.page.height - 50;

  // Ligne de séparation (conservée pour la structure visuelle)
  doc.moveTo(50, footerY - 10)
    .lineTo(doc.page.width - 50, footerY - 10)
    .stroke(colors.border);



};

/**
 * Génère un PDF pour un acte de décès avec une mise en page professionnelle
 * conforme aux normes administratives tchadiennes
 */
const generateDecesPdf = async (data) => {
  console.log('=== DÉBUT generateDecesPdf ===');
  console.log('Données reçues dans generateDecesPdf:', JSON.stringify(data, null, 2));

  return new Promise(async (resolve, reject) => {
    try {
      // Créer un nouveau document PDF
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
        prenoms: details.prenom || data.prenom || '',
        sexe: details.sexe || data.sexe || '',
        // Informations du décès
        dateDeces: details.dateDeces || data.dateDeces || '',
        heureDeces: details.heureDeces || data.heureDeces || '',
        lieuDeces: details.lieuDeces || data.lieuDeces || '',
        causeDeces: details.causeDeces || data.causeDeces || '',
        age: details.age || data.age || null,
        nationalite: details.nationalite || data.nationalite || 'Tchadienne',
        adresse: details.adresse || data.adresse || '',
        centreEtatCivil: details.centreEtatCivil || data.centreEtatCivil || data.mairie || '',
        // Informations des parents
        pere: details.pere || data.pere || null,
        mere: details.mere || data.mere || null,
        // Informations du déclarant
        declarant: {
          nom: details.nomDeclarant || (data.declarant?.nom || ''),
          prenom: details.prenomDeclarant || (data.declarant?.prenom || ''),
          lien: details.lienDeclarant || (data.declarant?.lien || 'NON DÉCLARÉ'),
          adresse: details.adresseDeclarant || (data.declarant?.adresse || 'NON DÉCLARÉE')
        },
        // Numéro d'acte avec valeur par défaut
        numeroActe: data.numeroActe || '.../MAT-SG/DGAT/DLP/...',
        // Date d'établissement avec valeur par défaut
        dateEtablissement: data.dateEtablissement || new Date().toISOString(),
        // Informations de la mairie
        mairie: data.mairie || details.centreEtatCivil || 'N\'Djaména'
      };

      // Configuration des gestionnaires d'événements pour le buffer
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      // Créer l'en-tête
      const startY = createHeader(doc, 'ACTE DE DÉCÈS', pdfData.numeroActe);

      // Position de départ pour le contenu
      let y = startY;

      // Section des informations du défunt
      y = drawSectionTitle(doc, 'Informations du défunt', y);

      // Tableau des informations du défunt
      const infoDefunt = [
        { label: 'Nom', value: pdfData.nom },
        { label: 'Prénom(s)', value: pdfData.prenoms },
        { label: 'Sexe', value: pdfData.sexe === 'M' ? 'Masculin' : pdfData.sexe === 'F' ? 'Féminin' : 'Non spécifié' },
        { label: 'Date de décès', value: formatDate(pdfData.dateDeces) },
        { label: 'Lieu de décès', value: pdfData.lieuDeces || 'Non spécifié' },
        { label: 'Âge au décès', value: pdfData.age ? `${pdfData.age} ans` : 'Non spécifié' },
        { label: 'Nationalité', value: pdfData.nationalite || 'Tchadienne' },
        { label: 'Dernier domicile', value: pdfData.adresse || 'Non spécifié' }
      ];

      // Afficher les informations du défunt
      infoDefunt.forEach(item => {
        doc.font(fonts.bold)
          .fontSize(10)
          .fillColor(colors.primary)
          .text(`${item.label} :`, 60, y);

        doc.font(fonts.normal)
          .fontSize(10)
          .fillColor(colors.text)
          .text(item.value || 'Non spécifié', 200, y);

        y += 15;
      });

      y += 10;

      // Section des informations du décès
      y = drawSectionTitle(doc, 'Informations du décès', y);

      // Tableau des informations du décès
      const infoDeces = [
        { label: 'Heure du décès', value: pdfData.heureDeces || 'Non spécifiée' },
        { label: 'Cause du décès', value: pdfData.causeDeces || 'Non spécifiée' },
        { label: 'Centre d\'état civil', value: pdfData.centreEtatCivil || pdfData.mairie || 'Non spécifié' }
      ];

      // Afficher les informations du décès
      infoDeces.forEach(item => {
        doc.font(fonts.bold)
          .fontSize(10)
          .fillColor(colors.primary)
          .text(`${item.label} :`, 60, y);

        doc.font(fonts.normal)
          .fontSize(10)
          .fillColor(colors.text)
          .text(item.value, 200, y);

        y += 15;
      });

      y += 10;

      // Section des informations des parents (seulement si renseignés)
      if (pdfData.pere || pdfData.mere) {
        y = drawSectionTitle(doc, 'Informations des parents', y);

        // Tableau des informations des parents
        const infoParents = [];
        if (pdfData.pere) {
          infoParents.push({ label: 'Père', value: pdfData.pere });
        }
        if (pdfData.mere) {
          infoParents.push({ label: 'Mère', value: pdfData.mere });
        }

        // Afficher les informations des parents
        if (infoParents.length > 0) {
          infoParents.forEach(item => {
            doc.font(fonts.bold)
              .fontSize(10)
              .fillColor(colors.primary)
              .text(`${item.label} :`, 60, y);

            doc.font(fonts.normal)
              .fontSize(10)
              .fillColor(colors.text)
              .text(item.value, 200, y);

            y += 15;
          });

          y += 10;
        }
      }

      // Section des informations du déclarant
      y = drawSectionTitle(doc, 'Informations du déclarant', y);

      // Tableau des informations du déclarant
      const infoDeclarant = [
        { label: 'Nom', value: pdfData.declarant.nom },
        { label: 'Prénom(s)', value: pdfData.declarant.prenom },
        { label: 'Lien avec le défunt', value: pdfData.declarant.lien },
        { label: 'Adresse', value: pdfData.declarant.adresse }
      ];

      // Afficher les informations du déclarant
      infoDeclarant.forEach(item => {
        doc.font(fonts.bold)
          .fontSize(10)
          .fillColor(colors.primary)
          .text(`${item.label} :`, 60, y);

        doc.font(fonts.normal)
          .fontSize(10)
          .fillColor(colors.text)
          .text(item.value, 200, y);

        y += 15;
      });

      y += 20;

      // Section des mentions légales
      doc.font(fonts.italic)
        .fontSize(9)
        .fillColor(colors.secondary)
        .text('Je soussigné(e), Maire de la commune de ' + pdfData.mairie + ', certifie que le présent acte a été dressé conformément aux déclarations qui m\'ont été faites et aux pièces produites.',
          60, y, { width: 500, align: 'justify' });

      y += 30;

      doc.font(fonts.italic)
        .fontSize(9)
        .fillColor(colors.secondary)
        .text('En foi de quoi, le présent acte a été dressé pour servir et valoir ce que de droit.',
          60, y, { width: 500, align: 'justify' });

      y += 40;

      // Section des signatures
      const signatureY = y;
      const signatureWidth = 150;
      const signatureHeight = 1;

      // Signature du maire
      doc.font(fonts.normal)
        .fontSize(10)
        .fillColor(colors.primary)
        .text('Le Maire', 100, signatureY);

      doc.moveTo(100, signatureY + 20)
        .lineTo(100 + signatureWidth, signatureY + 20)
        .stroke(colors.primary, 1);

      // Signature du déclarant
      doc.font(fonts.normal)
        .fontSize(10)
        .fillColor(colors.primary)
        .text('Le Déclarant', 350, signatureY);

      doc.moveTo(350, signatureY + 20)
        .lineTo(350 + signatureWidth, signatureY + 20)
        .stroke(colors.primary, 1);

      y += 60;

      // Ajouter le pied de page
      createFooter(doc, pdfData.dateEtablissement);

      // Finaliser le document
      doc.end();

    } catch (error) {
      console.error('Erreur lors de la génération du PDF de décès:', error);
      reject(error);
    }
  });
};

module.exports = generateDecesPdf;
