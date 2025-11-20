const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const crypto = require('crypto');

// Chemins des ressources
const resourcesPath = path.join(__dirname, '../public/images');
const fontsPath = path.join(__dirname, '../public/fonts');

// Police par défaut si les polices personnalisées ne sont pas disponibles
const defaultFont = 'Helvetica';
const defaultBoldFont = 'Helvetica-Bold';

// Configuration des couleurs
const colors = {
  primary: '#1a5276',    // Bleu foncé
  secondary: '#2980b9',  // Bleu moyen
  accent: '#e74c3c',     // Rouge
  lightGray: '#f8f9fa',  // Gris clair
  darkGray: '#343a40',   // Gris foncé
  white: '#ffffff',      // Blanc
  black: '#000000'       // Noir
};

/**
 * Dessine un rectangle avec des coins arrondis
 */
function roundedRect(doc, x, y, width, height, radius = 5) {
  doc
    .moveTo(x + radius, y)
    .lineTo(x + width - radius, y)
    .quadraticCurveTo(x + width, y, x + width, y + radius)
    .lineTo(x + width, y + height - radius)
    .quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
    .lineTo(x + radius, y + height)
    .quadraticCurveTo(x, y + height, x, y + height - radius)
    .lineTo(x, y + radius)
    .quadraticCurveTo(x, y, x + radius, y)
    .closePath();
}

/**
 * Ajoute un cadre avec un titre
 */
function addSection(doc, title, x, y, width, height) {
  // Cadre principal
  doc.save()
     .lineWidth(0.5)
     .rect(x, y, width, height)
     .stroke(colors.primary);
  
  // Bandeau de titre
  doc.fill(colors.primary)
     .rect(x + 1, y + 1, width - 2, 20)
     .fill();
  
  // Texte du titre
  doc.fill(colors.white)
     .fontSize(10)
     .font(defaultBoldFont)
     .text(title.toUpperCase(), x + 10, y + 6);
  
  doc.restore();
  
  return { x: x + 10, y: y + 30, width: width - 20 };
}

/**
 * Génère un identifiant unique pour le document
 */
function generateDocumentId(data) {
  const hash = crypto.createHash('md5').update(JSON.stringify(data)).digest('hex');
  return `ACTE-${data.numeroActe || 'ND'}-${hash.substring(0, 8).toUpperCase()}`;
}

/**
 * Vérifie si un fichier existe
 */
function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch (err) {
    return false;
  }
}

/**
 * Formate une date au format français
 */
function formatDate(dateString) {
  if (!dateString) return 'Non spécifiée';
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date) 
    ? date.toLocaleDateString('fr-FR', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : dateString;
}

/**
 * Ajoute un filigrane de sécurité au document
 */
function addWatermark(doc, text) {
  doc.save();
  doc.opacity(0.03);
  doc.fontSize(80);
  doc.font(defaultBoldFont);
  
  // Positionner le filigrane en diagonale
  doc.rotate(35, { origin: [300, 400] });
  
  // Remplir la page avec le filigrane
  for (let y = -200; y < 1000; y += 180) {
    for (let x = -200; x < 700; x += 400) {
      doc.fill(colors.primary)
         .text(text, x, y, { 
           width: 500, 
           align: 'center',
           lineGap: 5
         });
    }
  }
  
  doc.restore();
}

/**
 * Ajoute un en-tête de page avec le logo et les informations de la mairie
 */
function addHeader(doc, data) {
  const margin = 40;
  const logoPath = path.join(resourcesPath, 'logo-mairie.png');
  const flagPath = path.join(resourcesPath, 'flag-tchad.png');
  const hasLogo = fileExists(logoPath);
  const hasFlag = fileExists(flagPath);
  
  // Fond de l'en-tête
  doc.save()
     .fill(colors.primary)
     .rect(0, 0, doc.page.width, 120)
     .fill();
  
  // Ajouter le logo et le drapeau
  if (hasLogo) {
    doc.image(logoPath, margin, 20, { width: 70, align: 'left' });
  }
  
  if (hasFlag) {
    doc.image(flagPath, doc.page.width - margin - 70, 20, { width: 70 });
  }
  
  // Titres
  doc.fill(colors.white)
     .fontSize(14)
     .font(defaultBoldFont)
     .text('RÉPUBLIQUE DU TCHAD', { 
       align: 'center',
       y: 30
     })
     .fontSize(10)
     .font(defaultFont)
     .text('Unité - Travail - Progrès', { 
       align: 'center',
       y: 50
     })
     .fontSize(16)
     .font(defaultBoldFont)
     .text('MAIRIE DE ' + (data.mairie || 'ABÉCHÉ').toUpperCase(), {
       align: 'center',
       y: 70
     })
     .fontSize(12)
     .text('SERVICE DE L\'ÉTAT CIVIL', {
       align: 'center',
       y: 90
     });
  
  // Ligne de séparation
  doc.stroke(colors.white, 1)
     .moveTo(margin, 115)
     .lineTo(doc.page.width - margin, 115)
     .stroke();
  
  // Titre du document
  doc.fill(colors.primary)
     .fontSize(18)
     .font(defaultBoldFont)
     .text('ACTE DE DÉCÈS N° ' + (data.numeroActe || ''), {
       align: 'center',
       y: 130
     });
  
  // Date d'enregistrement
  doc.fontSize(10)
     .fill(colors.black)
     .text(`Enregistré le: ${formatDate(data.dateEnregistrement)}`, {
       align: 'right',
       y: 150,
       x: doc.page.width - margin
     });
  
  doc.restore();
  
  return 170; // Retourne la position Y après l'en-tête
}

/**
 * Dessine un tableau avec en-tête et lignes
 */
function drawTable(doc, y, headers, rows, options = {}) {
  const {
    margin = 40,
    rowHeight = 20,
    headerBgColor = colors.primary,
    headerTextColor = colors.white,
    borderColor = colors.darkGray,
    textColor = colors.black,
    cellPadding = 5,
    colWidths = null
  } = options;
  
  const startY = y;
  const tableWidth = doc.page.width - (2 * margin);
  const columnCount = headers.length;
  const columnWidth = colWidths || Array(columnCount).fill(tableWidth / columnCount);
  
  // Dessiner l'en-tête du tableau
  doc.save();
  doc.font(defaultBoldFont);
  
  let x = margin;
  headers.forEach((header, i) => {
    // Fond de l'en-tête
    doc.fill(headerBgColor)
       .rect(x, y, columnWidth[i], rowHeight)
       .fill();
    
    // Texte de l'en-tête
    doc.fill(headerTextColor)
       .fontSize(10)
       .text(header, 
         x + cellPadding, 
         y + (rowHeight - 10) / 2, 
         { width: columnWidth[i] - (2 * cellPadding), align: 'left' }
       );
    
    // Bordure
    doc.stroke(borderColor, 0.5)
       .rect(x, y, columnWidth[i], rowHeight)
       .stroke();
    
    x += columnWidth[i];
  });
  
  // Dessiner les lignes du tableau
  doc.font(defaultFont);
  rows.forEach((row, rowIndex) => {
    y = startY + ((rowIndex + 1) * rowHeight);
    x = margin;
    
    row.forEach((cell, cellIndex) => {
      // Fond de la cellule (alternance de couleurs pour les lignes)
      if (options.alternateRowColors && rowIndex % 2 === 0) {
        doc.fill(colors.lightGray)
           .rect(x, y, columnWidth[cellIndex], rowHeight)
           .fill();
      }
      
      // Texte de la cellule
      doc.fill(textColor)
         .fontSize(9)
         .text(cell || '-', 
           x + cellPadding, 
           y + (rowHeight - 9) / 2, 
           { 
             width: columnWidth[cellIndex] - (2 * cellPadding), 
             align: 'left',
             lineGap: 2,
             ellipsis: true
           }
         );
      
      // Bordure de la cellule
      doc.stroke(borderColor, 0.3)
         .rect(x, y, columnWidth[cellIndex], rowHeight)
         .stroke();
      
      x += columnWidth[cellIndex];
    });
  });
  
  doc.restore();
  
  return {
    y: startY + ((rows.length + 1) * rowHeight) + 10,
    height: (rows.length + 1) * rowHeight
  };
}

/**
 * Ajoute un pied de page avec numéro de page et mentions légales
 */
function addFooter(doc, pageNumber, totalPages, documentId) {
  const margin = 40;
  const footerY = doc.page.height - 50;
  
  // Ligne de séparation
  doc.stroke(colors.primary, 0.5)
     .moveTo(margin, footerY)
     .lineTo(doc.page.width - margin, footerY)
     .stroke();
  
  // Numéro de page
  doc.fontSize(8)
     .fill(colors.darkGray)
     .text(`Page ${pageNumber} sur ${totalPages}`, 
       margin, 
       footerY + 10, 
       { width: 100, align: 'left' }
     );
  
  // Mentions légales
  doc.fontSize(8)
     .fill(colors.darkGray)
     .text('Document officiel - Toute reproduction ou falsification est passible de poursuites', 
       { 
         width: doc.page.width - (2 * margin) - 200,
         align: 'center',
         x: margin + 100,
         y: footerY + 10
       }
     );
  
  // ID du document
  doc.fontSize(8)
     .fill(colors.darkGray)
     .text(`ID: ${documentId}`, 
       doc.page.width - margin - 100, 
       footerY + 10, 
       { width: 100, align: 'right' }
     );
}

/**
 * Ajoute une page de signature à la fin du document
 */
function addSignaturePage(doc, data, documentId) {
  doc.addPage();
  
  const margin = 50;
  const centerX = doc.page.width / 2;
  let y = 100;
  
  // Titre de la page
  doc.fontSize(14)
     .font(defaultBoldFont)
     .fill(colors.primary)
     .text('SIGNATURES ET CACHETS', { align: 'center', y });
  
  y += 40;
  
  // Cadre pour la signature de l'officier d'état civil
  doc.save()
     .rect(margin, y, doc.page.width - (2 * margin), 150)
     .stroke(colors.primary, 0.5);
  
  doc.fontSize(10)
     .fill(colors.darkGray)
     .text('Signature et cachet de l\'officier d\'état civil :', margin + 10, y + 10);
  
  y += 170;
  
  // Cadre pour la signature du déclarant
  doc.save()
     .rect(margin, y, doc.page.width - (2 * margin), 100)
     .stroke(colors.primary, 0.5);
  
  doc.fontSize(10)
     .fill(colors.darkGray)
     .text('Signature du déclarant :', margin + 10, y + 10);
  
  // Mention de délivrance
  y += 120;
  doc.fontSize(9)
     .fill(colors.darkGray)
     .text('Délivré en un seul exemplaire pour servir et valoir ce que de droit.', 
       { align: 'center', width: doc.page.width - (2 * margin), x: margin, y }
     );
  
  // Date et lieu
  y += 30;
  doc.fontSize(9)
     .fill(colors.darkGray)
     .text(`Fait à ${data.mairie || 'Abéché'}, le ${formatDate(new Date())}`, 
       { align: 'right', width: 300, x: doc.page.width - margin - 300, y }
     );
  
  // Code QR de vérification
  y += 40;
  const qrData = {
    id: documentId,
    type: 'acte_deces',
    numero: data.numeroActe,
    date: new Date().toISOString(),
    mairie: data.mairie || 'Abéché',
    hash: crypto.createHash('md5').update(JSON.stringify(data)).digest('hex')
  };
  
  const qrText = JSON.stringify(qrData);
  const qrSize = 100;
  const qrX = doc.page.width - margin - qrSize;
  const qrY = doc.page.height - margin - qrSize - 20;
  
  // Ajouter le code QR
  doc.save()
     .rect(qrX - 5, qrY - 5, qrSize + 10, qrSize + 10)
     .fill(colors.lightGray);
  
  // Générer le code QR
  QRCode.toBuffer(qrText, { 
    errorCorrectionLevel: 'H',
    type: 'png',
    width: qrSize,
    margin: 1
  }).then(qrCode => {
    doc.image(qrCode, qrX, qrY, { width: qrSize });
  }).catch(err => {
    console.error('Erreur lors de la génération du QR code:', err);
  });
  
  // Texte sous le QR code
  doc.fontSize(7)
     .fill(colors.darkGray)
     .text('Scannez pour vérifier l\'authenticité', 
       qrX, 
       qrY + qrSize + 5, 
       { width: qrSize, align: 'center' }
     );
  
  doc.restore();
}

/**
 * Génère un PDF pour un acte de décès avec une mise en page professionnelle
 * conforme aux normes administratives tchadiennes
 * @param {Object} data - Les données de l'acte de décès
 * @returns {Promise<Buffer>} Le buffer du PDF généré
 */
const generateDecesPdf = async (data) => {
  return new Promise(async (resolve, reject) => {
    const log = (message, meta = {}) => {
      console.log(`[PDF Deces] ${message}`, meta);
    };

    // Extraire les détails de l'acte s'ils sont dans un objet 'details'
    const details = data.details || {};
    const acteData = {
      ...data,
      ...details,
      // Assurer la compatibilité avec les champs attendus
      nom: details.nom || data.nom,
      prenom: details.prenom || data.prenom,
      dateNaissance: details.dateNaissance || data.dateNaissance,
      lieuNaissance: details.lieuNaissance || data.lieuNaissance,
      sexe: details.sexe || data.sexe,
      nationalite: details.nationalite || data.nationalite || 'Tchadienne',
      profession: details.profession || data.profession,
      adresse: details.adresse || data.adresse,
      dateDeces: details.dateDeces || data.dateDeces,
      heureDeces: details.heureDeces || data.heureDeces,
      typeLieuDeces: details.typeLieuDeces || data.typeLieuDeces,
      lieuDeces: details.lieuDeces || data.lieuDeces,
      cause: details.cause || data.cause,
      // Informations des parents
      nomPere: details.nomPere || data.nomPere,
      nomMere: details.nomMere || data.nomMere,
      professionPere: details.professionPere || data.professionPere,
      professionMere: details.professionMere || data.professionMere,
      situationMatrimoniale: details.situationMatrimoniale || data.situationMatrimoniale,
      nomConjoint: details.nomConjoint || data.nomConjoint,
      // Informations du déclarant
      nomDeclarant: details.nomDeclarant || data.nomDeclarant,
      prenomDeclarant: details.prenomDeclarant || data.prenomDeclarant,
      lienDeclarant: details.lienDeclarant || data.lienDeclarant,
      telephoneDeclarant: details.telephoneDeclarant || data.telephoneDeclarant,
      // Informations administratives
      dateEnregistrement: details.dateEnregistrement || data.dateEnregistrement || new Date().toISOString(),
      numeroCertificat: details.numeroCertificat || data.numeroCertificat,
      medecinCertificateur: details.medecinCertificateur || data.medecinCertificateur,
      observations: details.observations || data.observations,
      // Informations de la mairie
      mairie: data.mairie || 'Abéché',
      numeroActe: data.numeroActe || 'Non numéroté'
    };

    log('Début de la génération du PDF de décès', { 
      data: JSON.stringify(acteData, null, 2).substring(0, 500) + (JSON.stringify(acteData).length > 500 ? '...' : '') 
    });

    try {
      // Générer un ID unique pour le document
      const documentId = generateDocumentId(acteData);
      
      // Créer un nouveau document PDF
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
        bufferPages: true,
        info: {
          Title: `Acte de Décès - ${acteData.numeroActe || ''}`,
          Author: `Mairie de ${acteData.mairie || 'Abéché'}`,
          Subject: 'Acte officiel de décès',
          Keywords: `acte,décès,officiel,mairie,${acteData.mairie || 'abéché'},${acteData.numeroActe || ''}`,
          Creator: 'Système de Gestion des Actes d\'État Civil',
          CreationDate: new Date(),
          ModDate: new Date(),
          Producer: 'Mairie de ' + (acteData.mairie || 'Abéché')
        }
      });

      // Pour collecter les données du PDF
      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => {
        const result = Buffer.concat(chunks);
        log('PDF de décès généré avec succès', { 
          size: result.length,
          documentId,
          numeroActe: acteData.numeroActe
        });
        resolve(result);
      });

      // Gestion des erreurs
      doc.on('error', (err) => {
        log('Erreur lors de la génération du PDF de décès', { 
          error: err.message,
          stack: err.stack,
          documentId
        });
        reject(err);
      });

      // Enregistrer les polices personnalisées si disponibles
      const arialPath = path.join(fontsPath, 'Arial.ttf');
      const arialBoldPath = path.join(fontsPath, 'Arial-Bold.ttf');
      
      if (fileExists(arialPath)) {
        doc.registerFont('Arial', arialPath);
        doc.font('Arial');
      } else {
        doc.font(defaultFont);
      }
      
      if (fileExists(arialBoldPath)) {
        doc.registerFont('Arial-Bold', arialBoldPath);
      }

      // Créer un filigrane de sécurité
      addWatermark(doc, 'DOCUMENT OFFICIEL');

      // Ajouter l'en-tête et récupérer la position Y après l'en-tête
      let currentY = addHeader(doc, acteData);
      const margin = 40;
      const pageWidth = doc.page.width - (2 * margin);
      
      // Section 1: Informations du défunt
      const section1 = addSection(doc, 'I. INFORMATIONS DU DÉFUNT', margin, currentY, pageWidth, 200);
      
      // Tableau des informations du défunt
      const headersDefunt = ['Champ', 'Valeur', 'Observations'];
      const rowsDefunt = [
        ['Nom', acteData.nom || 'Non spécifié', ''],
        ['Prénom(s)', acteData.prenom || 'Non spécifié', ''],
        ['Date de naissance', formatDate(acteData.dateNaissance) || 'Non spécifiée', ''],
        ['Lieu de naissance', acteData.lieuNaissance || 'Non spécifié', ''],
        ['Sexe', acteData.sexe === 'M' ? 'Masculin' : acteData.sexe === 'F' ? 'Féminin' : 'Non spécifié', ''],
        ['Nationalité', acteData.nationalite || 'Tchadienne', ''],
        ['Profession', acteData.profession || 'Non spécifiée', ''],
        ['Dernier domicile', acteData.adresse || 'Non spécifié', ''],
        ['Date du décès', formatDate(acteData.dateDeces) || 'Non spécifiée', ''],
        ['Heure du décès', acteData.heureDeces || 'Non spécifiée', ''],
        ['Lieu du décès', acteData.lieuDeces === 'domicile' ? 'Domicile' : acteData.lieuDeces === 'hopital' ? 'Hôpital' : acteData.lieuDeces === 'autre' ? 'Autre lieu' : acteData.lieuDeces || 'Non spécifié', ''],
        ['Cause du décès', acteData.cause || 'Non spécifiée', '']
      ];
      
      // Dessiner le tableau des informations du défunt
      const table1 = drawTable(doc, section1.y, headersDefunt, rowsDefunt, {
        alternateRowColors: true,
        colWidths: [100, 250, 150]
      });
      
      currentY = table1.y + 20;
      
      // Vérifier si on doit ajouter une nouvelle page
      if (currentY > doc.page.height - 200) {
        doc.addPage();
        currentY = 50;
      }
      
      // Section 2: Informations des parents
      const section2 = addSection(doc, 'II. INFORMATIONS DES PARENTS', margin, currentY, pageWidth, 150);
      
      // Tableau des informations des parents
      const headersParents = ['Parent', 'Nom et prénoms', 'Profession', 'Domicile'];
      const rowsParents = [
        ['Père', 
          acteData.nomPere || 'Non spécifié', 
          acteData.professionPere || 'Non spécifiée',
          acteData.adresse || 'Non spécifié'
        ],
        ['Mère', 
          acteData.nomMere || 'Non spécifiée', 
          acteData.professionMere || 'Non spécifiée',
          acteData.adresse || 'Non spécifiée'
        ]
      ];
      
      // Ajouter les informations du conjoint si disponible
      if (acteData.situationMatrimoniale === 'Marié(e)' && acteData.nomConjoint) {
        rowsParents.push([
          'Conjoint(e)',
          acteData.nomConjoint || 'Non spécifié(e)',
          '',
          acteData.adresse || 'Non spécifié'
        ]);
      }
      
      // Dessiner le tableau des parents
      const table2 = drawTable(doc, section2.y, headersParents, rowsParents, {
        alternateRowColors: true,
        colWidths: [80, 200, 120, 100]
      });
      
      currentY = table2.y + 20;
      
      // Vérifier si on doit ajouter une nouvelle page
      if (currentY > doc.page.height - 200) {
        doc.addPage();
        currentY = 50;
      }
      
      // Section 3: Informations du déclarant
      const section3 = addSection(doc, 'III. INFORMATIONS DU DÉCLARANT', margin, currentY, pageWidth, 150);
      
      // Tableau des informations du déclarant
      const headersDeclarant = ['Champ', 'Valeur', 'Coordonnées'];
      const rowsDeclarant = [
        ['Nom', acteData.nomDeclarant || 'Non spécifié', ''],
        ['Prénom(s)', acteData.prenomDeclarant || 'Non spécifié', ''],
        ['Lien avec le défunt', acteData.lienDeclarant || 'Non spécifié', ''],
        ['Téléphone', acteData.telephoneDeclarant || 'Non spécifié', ''],
        ['Date d\'enregistrement', formatDate(acteData.dateEnregistrement) || 'Non spécifiée', ''],
        ['Numéro de certificat', acteData.numeroCertificat || 'Non spécifié', ''],
        ['Médecin certificateur', acteData.medecinCertificateur || 'Non spécifié', '']
      ];
      
      // Ajouter les observations si elles existent
      if (acteData.observations) {
        rowsDeclarant.push(['Observations', acteData.observations, '']);
      }
      
      // Dessiner le tableau du déclarant
      const table3 = drawTable(doc, section3.y, headersDeclarant, rowsDeclarant, {
        alternateRowColors: true,
        colWidths: [120, 200, 180]
      });
      
      currentY = table3.y + 30;
      
      // Ajouter les mentions légales
      doc.fontSize(9)
         .font(defaultFont)
         .fill(colors.darkGray)
         .text('Je soussigné(e), Maire de la commune de ' + (acteData.mairie || 'Abéché') + ', certifie que le présent acte a été dressé conformément aux déclarations qui m\'ont été faites et aux pièces produites.', 
           { width: pageWidth, align: 'justify', x: margin, y: currentY }
         )
         .moveDown(1)
         .text('En foi de quoi, le présent acte a été dressé pour servir et valoir ce que de droit.',
           { width: pageWidth, align: 'justify' }
         );
      
      // Ajouter le pied de page pour la première page
      addFooter(doc, 1, 2, documentId);
      
      // Ajouter une page de signature
      addSignaturePage(doc, acteData, documentId);
      
      // Ajouter le pied de page pour la deuxième page
      addFooter(doc, 2, 2, documentId);
      
      // Finaliser le document
      doc.end();

      // Suppression des déclarations en double - Les sections complètes sont déjà implémentées plus haut

      // Section Signatures
      doc.addPage()
         .fillColor(primaryColor)
         .fontSize(12)
         .font('Helvetica-Bold')
         .text('IV. SIGNATURES ET CACHETS', 50, 50, { underline: false })
         .moveDown(2);
      
      // Lignes de signature
      const signatureY = 120;
      const signatureWidth = 200;
      const signatureMargin = 50;
      
      // Signature officier d'état civil
      doc.font('Helvetica')
         .fontSize(10)
         .text('L\'Officier d\'État Civil,', signatureMargin, signatureY)
         .moveTo(signatureMargin, signatureY + 40)
         .lineTo(signatureMargin + signatureWidth, signatureY + 40)
         .stroke()
         .fontSize(8)
         .text('Signature et cachet', signatureMargin, signatureY + 45);
      
      // Signature déclarant
      doc.font('Helvetica')
         .fontSize(10)
         .text('Le Déclarant,', doc.page.width - signatureMargin - signatureWidth, signatureY)
         .moveTo(doc.page.width - signatureMargin - signatureWidth, signatureY + 40)
         .lineTo(doc.page.width - signatureMargin, signatureY + 40)
         .stroke()
         .fontSize(8)
         .text('Signature', doc.page.width - signatureMargin - signatureWidth, signatureY + 45);

      // Ajouter un code QR pour la vérification
      const qrData = JSON.stringify({
        type: 'acte-deces',
        id: data._id || data.numeroActe,
        date: new Date().toISOString(),
        mairie: data.mairie || 'Mairie d\'Abéché',
        hash: require('crypto').createHash('md5').update(JSON.stringify(data)).digest('hex')
      });
      
      try {
        const qrCode = await QRCode.toDataURL(qrData, { errorCorrectionLevel: 'H' });
        doc.image(qrCode, doc.page.width - 100, doc.page.height - 120, { width: 80 });
        doc.fontSize(8)
           .text('Scannez pour vérifier', doc.page.width - 110, doc.page.height - 35, { width: 100, align: 'center' });
      } catch (err) {
        console.error('Erreur lors de la génération du QR Code:', err);
      }

      // Pied de page
      const footerY = doc.page.height - 30;
      doc.fontSize(8)
         .fillColor(darkGray)
         .text(`Document généré par ${data.mairie || 'la Mairie'} - ${data.ville || 'Abéché, Tchad'} • ${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}`, 
               50, footerY, { width: doc.page.width - 100, align: 'center' });
      
      // Mentions légales
      doc.fontSize(7)
         .fillColor('#999')
         .text('Document officiel de la République du Tchad - Toute falsification est passible de poursuites judiciaires.', 
               50, footerY + 15, { width: doc.page.width - 100, align: 'center' });

      // Numéro de page
      const pages = doc.bufferedPageRange();
      for (let i = 0; i < pages.count; i++) {
        doc.switchToPage(i);
        doc.fontSize(8)
           .fillColor(darkGray)
           .text(`Page ${i + 1} sur ${pages.count}`, 
                 doc.page.width - 50, 
                 doc.page.height - 20, 
                 { width: 50, align: 'right' });
      }

      // Finaliser le document
      doc.end();

    } catch (error) {
      log('Erreur critique lors de la génération du PDF de décès', {
        error: error.message,
        stack: error.stack
      });
      reject(error);
    }
  });
};

module.exports = {
  generateDecesPdf,
  // Exporter les fonctions utilitaires pour les tests
  _test: {
    formatDate,
    generateDocumentId,
    fileExists
  }
};
