const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { logger } = require('../config/logger');

// Dossier de sortie pour les PDF générés
const OUTPUT_DIR = path.join(__dirname, '../public/pdfs');

// Créer le dossier de sortie s'il n'existe pas
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Génère l'en-tête du document avec le drapeau du Tchad
 * @param {PDFDocument} doc - L'instance PDFKit
 */
function generateHeader(doc) {
  // Drapeau du Tchad (bandes verticales)
  const flagX = 50;
  const flagY = 50;
  const flagWidth = 90;
  const stripeWidth = flagWidth / 3;
  
  // Fond blanc avec contour
  doc
    .rect(flagX, flagY, flagWidth, 60)
    .fillAndStroke('white', 'black');
  
  // Bandes du drapeau
  doc
    .fillColor('#002689') // Bleu
    .rect(flagX, flagY, stripeWidth, 60)
    .fill()
    .fillColor('#FFD100') // Jaune
    .rect(flagX + stripeWidth, flagY, stripeWidth, 60)
    .fill()
    .fillColor('#CE1126') // Rouge
    .rect(flagX + (stripeWidth * 2), flagY, stripeWidth, 60)
    .fill();
  
  // Titre du document
  doc
    .fillColor('black')
    .font('Helvetica-Bold')
    .fontSize(16)
    .text('RÉPUBLIQUE DU TCHAD', 200, 60, { align: 'center' })
    .fontSize(12)
    .text('Unité - Travail - Progrès', 200, 80, { align: 'center' })
    .moveDown(2);
}

/**
 * Génère une section pour une personne (époux, épouse, concubin)
 * @param {PDFDocument} doc - L'instance PDFKit
 * @param {string} title - Le titre de la section
 * @param {Object} personne - Les informations de la personne
 */
function generatePersonneSection(doc, title, personne) {
  if (!personne) return;
  
  doc
    .font('Helvetica-Bold')
    .fontSize(12)
    .text(`${title.toUpperCase()}:`, { underline: true })
    .moveDown(0.3);
    
  doc
    .font('Helvetica')
    .text(`Nom: ${personne.nom || 'N/A'}`)
    .text(`Prénoms: ${personne.prenom || 'N/A'}`);
    
  if (personne.dateNaissance) {
    doc.text(`Date de naissance: ${new Date(personne.dateNaissance).toLocaleDateString('fr-FR')}`);
  }
  
  if (personne.lieuNaissance) {
    doc.text(`Lieu de naissance: ${personne.lieuNaissance}`);
  }
  
  if (personne.profession) {
    doc.text(`Profession: ${personne.profession}`);
  }
  
  if (personne.adresse) {
    doc.text(`Adresse: ${personne.adresse}`);
  }
  
  doc.moveDown(0.5);
}

/**
 * Génère un PDF pour un acte de divorce
 * @param {Object} data - Les données de l'acte de divorce
 * @returns {Promise<Buffer>} - Le buffer du PDF généré
 */
const generateDivorcePdf = async (data) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, bufferPages: true });
      const buffers = [];
      
      // Collecter les chunks de données
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      // En-tête du document
      generateHeader(doc);
      
      // Titre du document
      doc
        .fontSize(16)
        .font('Helvetica-Bold')
        .text('ACTE DE DIVORCE', { align: 'center', underline: true })
        .moveDown(2);
      
      // Informations de l'acte
      doc
        .fontSize(12)
        .font('Helvetica')
        .text(`Numéro d'acte: ${data.numeroActe}`, { align: 'left' })
        .text(`Date d'établissement: ${new Date(data.dateEtablissement).toLocaleDateString('fr-FR')}`, { align: 'left' })
        .text(`Lieu d'établissement: ${data.lieuEtablissement}`, { align: 'left' })
        .moveDown();
      
      // Informations des époux
      if (data.epoux) {
        generatePersonneSection(doc, 'Époux', data.epoux);
      }
      
      if (data.epouse) {
        generatePersonneSection(doc, 'Épouse', data.epouse);
      }
      
      // Décision de divorce
      doc
        .font('Helvetica-Bold')
        .text('DÉCISION DE DIVORCE:', { underline: true })
        .moveDown(0.3);
      
      doc
        .font('Helvetica')
        .text(`Date du jugement: ${data.dateJugement ? new Date(data.dateJugement).toLocaleDateString('fr-FR') : 'N/A'}`)
        .text(`Tribunal: ${data.tribunal || 'N/A'}`)
        .text(`Numéro de dossier: ${data.numeroDossier || 'N/A'}`)
        .moveDown();
      
      // Motif du divorce
      if (data.motif) {
        doc
          .font('Helvetica-Bold')
          .text('MOTIF DU DIVORCE:', { underline: true })
          .moveDown(0.3);
        
        doc
          .font('Helvetica')
          .text(data.motif, { align: 'justify' })
          .moveDown();
      }
      
      // Signature
      doc
        .moveDown(2)
        .text('Fait à ' + (data.lieuEtablissement || 'N/A') + ', le ' + (data.dateEtablissement ? new Date(data.dateEtablissement).toLocaleDateString('fr-FR') : ''), { align: 'right' })
        .moveDown(3)
        .text('Le Juge', { align: 'right' })
        .moveDown(2)
        .text('Cachet et signature', { align: 'right', color: '#999' });
      
      // Finaliser le document
      doc.end();
    } catch (error) {
      logger.error('Erreur lors de la génération du PDF de divorce', { error });
      reject(error);
    }
  });
};

/**
 * Génère un PDF pour un engagement de concubinage
 * @param {Object} data - Les données de l'engagement de concubinage
 * @returns {Promise<Buffer>} - Le buffer du PDF généré
 */
const generateEngagementConcubinagePdf = async (data) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, bufferPages: true });
      const buffers = [];
      
      // Collecter les chunks de données
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      // En-tête du document
      generateHeader(doc);
      
      // Titre du document
      doc
        .fontSize(16)
        .font('Helvetica-Bold')
        .text('DÉCLARATION DE CONCUBINAGE', { align: 'center', underline: true })
        .moveDown(2);
      
      // Informations de l'acte
      doc
        .fontSize(12)
        .font('Helvetica')
        .text(`Numéro d'acte: ${data.numeroActe}`, { align: 'left' })
        .text(`Date d'établissement: ${new Date(data.dateEtablissement).toLocaleDateString('fr-FR')}`, { align: 'left' })
        .text(`Lieu d'établissement: ${data.lieuEtablissement}`, { align: 'left' })
        .moveDown();
      
      // Informations des concubins
      if (data.concubin1) {
        generatePersonneSection(doc, 'Premier concubin', data.concubin1);
      }
      
      if (data.concubin2) {
        generatePersonneSection(doc, 'Second concubin', data.concubin2);
      }
      
      // Déclaration de concubinage
      doc
        .font('Helvetica-Bold')
        .text('DÉCLARATION DE CONCUBINAGE:', { underline: true })
        .moveDown(0.3);
      
      doc
        .font('Helvetica')
        .text('Les soussignés déclarent sur l\'honneur vivre en concubinage depuis le ' + 
              (data.dateDebutConcubinage ? new Date(data.dateDebutConcubinage).toLocaleDateString('fr-FR') : 'N/A') + 
              ' à ' + (data.adresseCommune || 'N/A') + '.', 
              { align: 'justify' })
        .moveDown();
      
      // Enfants communs
      if (data.enfants && data.enfants.length > 0) {
        doc
          .font('Helvetica-Bold')
          .text('ENFANTS COMMUNS:', { underline: true })
          .moveDown(0.3);
        
        data.enfants.forEach((enfant, index) => {
          doc
            .font('Helvetica')
            .text(`${index + 1}. ${enfant.prenom} ${enfant.nom}, né(e) le ${new Date(enfant.dateNaissance).toLocaleDateString('fr-FR')} à ${enfant.lieuNaissance || 'N/A'}`);
        });
        
        doc.moveDown();
      }
      
      // Signature
      doc
        .moveDown(2)
        .text('Fait à ' + (data.lieuEtablissement || 'N/A') + ', le ' + (data.dateEtablissement ? new Date(data.dateEtablissement).toLocaleDateString('fr-FR') : ''), { align: 'right' })
        .moveDown(3);
      
      // Signatures des concubins
      doc
        .text('Signature du premier concubin', 100, doc.y, { width: 200, align: 'center' })
        .text('Signature du second concubin', 300, doc.y, { width: 200, align: 'center' })
        .moveDown(5)
        .text('Cachet et signature de l\'officier d\'état civil', { align: 'right', color: '#999' });
      
      // Finaliser le document
      doc.end();
    } catch (error) {
      logger.error('Erreur lors de la génération du PDF d\'engagement de concubinage', { error });
      reject(error);
    }
  });
};

/**
 * Génère un PDF pour un acte de naissance
 * @param {Object} data - Les données de l'acte de naissance
 * @returns {Promise<Buffer>} - Le buffer du PDF généré
 */
const generateNaissancePdf = async (data) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ 
        margin: 50,
        bufferPages: true,
        size: 'A4'
      });
      
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('error', (error) => {
        logger.error('Erreur lors de la génération du PDF', { error });
        reject(error);
      });
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      // 1. En-tête avec drapeau
      generateHeader(doc);
      
      // 2. Titre du document
      doc
        .fontSize(18)
        .font('Helvetica-Bold')
        .text('ACTE DE NAISSANCE', { align: 'center' })
        .moveDown(0.5);
        
      // 3. Informations administratives dans un cadre
      const adminInfoY = doc.y;
      doc
        .roundedRect(50, adminInfoY, 500, 60, 5)
        .stroke('#CCCCCC')
        .fill('#F8F9FA');
        
      doc
        .font('Helvetica-Bold')
        .fontSize(12)
        .fillColor('#002689')
        .text('INFORMATIONS ADMINISTRATIVES', 60, adminInfoY + 10)
        .font('Helvetica')
        .fontSize(10)
        .fillColor('#333333')
        .text(`N°: ${data.numeroActe || 'N/A'}`, 60, adminInfoY + 30, { width: 150 })
        .text(`Mairie de: ${data.mairie || 'N/A'}`, 220, adminInfoY + 30, { width: 150 })
        .text(`Date: ${data.dateEtablissement ? new Date(data.dateEtablissement).toLocaleDateString('fr-FR') : 'N/A'}`, 380, adminInfoY + 30, { width: 150 })
        .moveDown(4);

      // 4. Informations de l'enfant
      const enfantInfoY = doc.y;
      doc
        .roundedRect(50, enfantInfoY, 500, 120, 5)
        .stroke('#CCCCCC')
        .fill('#E6F3FF');
        
      doc
        .font('Helvetica-Bold')
        .fontSize(14)
        .fillColor('#002689')
        .text('INFORMATIONS DE L\'ENFANT', 60, enfantInfoY + 10)
        .font('Helvetica')
        .fontSize(11)
        .fillColor('#333333')
        .text(`Nom: ${data.nomEnfant || 'N/A'}`, 60, enfantInfoY + 35)
        .text(`Prénoms: ${data.prenomsEnfant || 'N/A'}`, 60, enfantInfoY + 55)
        .text(`Date de naissance: ${data.dateNaissance ? new Date(data.dateNaissance).toLocaleDateString('fr-FR') : 'N/A'}`, 60, enfantInfoY + 75)
        .text(`Heure de naissance: ${data.heureNaissance || 'N/A'}`, 300, enfantInfoY + 75)
        .text(`Lieu de naissance: ${data.lieuNaissance || 'N/A'}`, 60, enfantInfoY + 95)
        .text(`Sexe: ${data.sexe === 'M' ? 'Masculin' : data.sexe === 'F' ? 'Féminin' : 'N/A'}`, 300, enfantInfoY + 95)
        .moveDown(1);

      // 5. Informations des parents
      const parentsInfoY = doc.y + 20;
      doc
        .roundedRect(50, parentsInfoY, 500, 180, 5)
        .stroke('#CCCCCC')
        .fill('#FFF9E6');
        
      doc
        .font('Helvetica-Bold')
        .fontSize(14)
        .fillColor('#002689')
        .text('FILIATION', 60, parentsInfoY + 10)
        .font('Helvetica-Bold')
        .fontSize(12)
        .fillColor('#333333')
        .text('PÈRE:', 60, parentsInfoY + 40)
        .font('Helvetica')
        .text(`Nom: ${data.nomPere || 'N/A'}`, 90, parentsInfoY + 40)
        .text(`Prénoms: ${data.prenomsPere || 'N/A'}`, 90, parentsInfoY + 60);
        
      if (data.dateNaissancePere) {
        doc.text(`Date de naissance: ${new Date(data.dateNaissancePere).toLocaleDateString('fr-FR')}`, 90, parentsInfoY + 80);
      }
      if (data.lieuNaissancePere) {
        doc.text(`Lieu de naissance: ${data.lieuNaissancePere}`, 90, parentsInfoY + 100);
      }
      if (data.professionPere) {
        doc.text(`Profession: ${data.professionPere}`, 90, parentsInfoY + 120);
      }
      
      // Mère
      doc
        .font('Helvetica-Bold')
        .text('MÈRE:', 300, parentsInfoY + 40)
        .font('Helvetica')
        .text(`Nom: ${data.nomMere || 'N/A'}`, 330, parentsInfoY + 40)
        .text(`Prénoms: ${data.prenomsMere || 'N/A'}`, 330, parentsInfoY + 60);
        
      if (data.dateNaissanceMere) {
        doc.text(`Date de naissance: ${new Date(data.dateNaissanceMere).toLocaleDateString('fr-FR')}`, 330, parentsInfoY + 80);
      }
      if (data.lieuNaissanceMere) {
        doc.text(`Lieu de naissance: ${data.lieuNaissanceMere}`, 330, parentsInfoY + 100);
      }
      if (data.professionMere) {
        doc.text(`Profession: ${data.professionMere}`, 330, parentsInfoY + 120);
      }
      
      // 6. Informations du déclarant (si disponible)
      if (data.nomDeclarant || data.prenomsDeclarant) {
        const declarantY = doc.y + 30;
        doc
          .roundedRect(50, declarantY, 500, 100, 5)
          .stroke('#CCCCCC')
          .fill('#F5F5F5');
          
        doc
          .font('Helvetica-Bold')
          .fontSize(12)
          .fillColor('#002689')
          .text('INFORMATIONS DU DÉCLARANT', 60, declarantY + 10)
          .font('Helvetica')
          .fontSize(11)
          .fillColor('#333333')
          .text(`Nom: ${data.nomDeclarant || 'N/A'}`, 60, declarantY + 35)
          .text(`Prénoms: ${data.prenomsDeclarant || 'N/A'}`, 60, declarantY + 55);
          
        if (data.lienDeclarant) {
          doc.text(`Lien avec l'enfant: ${data.lienDeclarant}`, 60, declarantY + 75);
        }
        if (data.adresseDeclarant) {
          doc.text(`Adresse: ${data.adresseDeclarant}`, 300, declarantY + 75);
        }
        
        doc.moveDown(2);
      }
      
      // 7. Observations (si disponibles)
      if (data.observations) {
        const obsY = doc.y + 20;
        doc
          .roundedRect(50, obsY, 500, 80, 5)
          .stroke('#CCCCCC')
          .fill('#F5F5F5');
          
        doc
          .font('Helvetica-Bold')
          .fontSize(12)
          .fillColor('#002689')
          .text('OBSERVATIONS', 60, obsY + 10)
          .font('Helvetica')
          .fontSize(11)
          .fillColor('#333333')
          .text(data.observations, { 
            x: 60, 
            y: obsY + 35, 
            width: 480,
            align: 'justify'
          });
        
        doc.moveDown(3);
      }
      
      // 8. Signature
      doc
        .moveDown(2)
        .text('Fait à ' + (data.mairie || 'N/A') + ', le ' + (data.dateEtablissement ? new Date(data.dateEtablissement).toLocaleDateString('fr-FR') : ''), { align: 'right' })
        .moveDown(3)
        .text('Le Maire', { align: 'right' })
        .moveDown(2)
        .text('Cachet et signature', { align: 'right', color: '#999' });
      
      // Finaliser le document
      doc.end();
    } catch (error) {
      logger.error('Erreur lors de la génération du PDF de naissance', { error });
      reject(error);
    }
  });
};

/**
 * Fonction principale pour générer un PDF en fonction du type
 * @param {string} type - Le type de document ('divorce', 'engagement-concubinage' ou 'naissance')
 * @param {Object} data - Les données du document
 * @returns {Promise<Buffer>} - Le buffer du PDF généré
 */
const generateMariagePdf = async (data) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ 
        margin: 50, 
        bufferPages: true,
        size: 'A4',
        layout: 'portrait'
      });
      
      const buffers = [];
      
      // Collecter les chunks de données
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      // En-tête avec drapeau du Tchad
      doc
        .image('public/images/flag-tchad.svg', 50, 40, { width: 60 })
        .fillColor('#000000')
        .fontSize(18)
        .font('Helvetica-Bold')
        .text('RÉPUBLIQUE DU TCHAD', 120, 50, { align: 'center' })
        .fontSize(14)
        .text('Unité - Travail - Progrès', 120, 75, { align: 'center' })
        .moveDown(1.5);
      
      // Titre du document
      doc
        .fontSize(18)
        .font('Helvetica-Bold')
        .text('ACTE DE MARIAGE', { 
          align: 'center', 
          underline: true,
          lineGap: 10
        })
        .moveDown(1);
      
      // Numéro et date d'enregistrement
      doc
        .fontSize(12)
        .font('Helvetica')
        .text(`Numéro d'acte: ${data.numeroActe || 'Non spécifié'}`, { align: 'left' })
        .text(`Enregistré le: ${data.dateEnregistrement ? new Date(data.dateEnregistrement).toLocaleDateString('fr-FR') : 'Non spécifié'}`, { align: 'left' })
        .text(`Mairie: ${data.mairie || 'Non spécifiée'}`, { align: 'left' })
        .moveDown(1);
      
      // Ligne de séparation
      doc
        .moveTo(50, doc.y)
        .lineTo(550, doc.y)
        .stroke('#000000', 0.5)
        .moveDown(1.5);
      
      // Section des époux
      doc
        .font('Helvetica-Bold')
        .fontSize(14)
        .text('LES ÉPOUX', { align: 'center' })
        .moveDown(1);
      
      // Grille à deux colonnes pour les époux
      const startY = doc.y;
      const column1 = 50;
      const column2 = 300;
      const lineHeight = 20;
      
      // Fonction pour afficher les informations d'une personne
      const renderPersonInfo = (x, y, title, person) => {
        if (!person) {
          doc
            .font('Helvetica-Bold')
            .fontSize(12)
            .text(`${title.toUpperCase()}:`, x, y, { underline: true })
            .font('Helvetica')
            .text('Aucune information disponible', x, y + lineHeight);
          return y + lineHeight * 2;
        }
        
        doc
          .font('Helvetica-Bold')
          .fontSize(12)
          .text(`${title.toUpperCase()}:`, x, y, { underline: true });
        
        y += lineHeight;
        
        // Vérifier si c'est un objet ou une chaîne simple
        const getValue = (value) => {
          if (!value) return 'Non spécifié';
          if (typeof value === 'object') return value.nom || 'Non spécifié';
          return value;
        };
        
        doc
          .font('Helvetica')
          .text(`Nom: ${getValue(person.nom)}`, x, y)
          .text(`Prénoms: ${getValue(person.prenom) || getValue(person.prenoms) || 'Non spécifié'}`, x, y + lineHeight)
          .text(`Date de naissance: ${person.dateNaissance ? new Date(person.dateNaissance).toLocaleDateString('fr-FR') : 'Non spécifiée'}`, x, y + (lineHeight * 2))
          .text(`Lieu de naissance: ${getValue(person.lieuNaissance)}`, x, y + (lineHeight * 3))
          .text(`Profession: ${getValue(person.profession)}`, x, y + (lineHeight * 4))
          .text(`Adresse: ${getValue(person.adresse) || getValue(person.residence) || 'Non spécifiée'}`, x, y + (lineHeight * 5), { width: 200, lineGap: 5 });
        
        // Informations d'identification
        if (person.typePieceIdentite || person.numeroPieceIdentite) {
          doc.text(`${person.typePieceIdentite || 'Pièce'}: ${person.numeroPieceIdentite || 'Non spécifié'}`, x, y + (lineHeight * 6));
        }
        
        // Informations des parents
        if (person.pere || person.mere) {
          doc
            .font('Helvetica-Bold')
            .text('Parents:', x, y + (lineHeight * 8))
            .font('Helvetica');
            
          if (person.pere) {
            const pere = typeof person.pere === 'string' ? person.pere : 
                       (person.pere.nom ? `${person.pere.prenom || ''} ${person.pere.nom}`.trim() : 'Non spécifié');
            doc.text(`Père: ${pere}`, x + 20, y + (lineHeight * 9));
          }
          
          if (person.mere) {
            const mere = typeof person.mere === 'string' ? person.mere : 
                       (person.mere.nom ? `${person.mere.prenom || ''} ${person.mere.nom}`.trim() : 'Non spécifiée');
            doc.text(`Mère: ${mere}`, x + 20, y + (lineHeight * 10));
          }
        }
        
        return y + (lineHeight * 12);
      };
      
      // Époux (colonne de gauche)
      const conjoint1 = data.conjoint1_details || data.epoux || {};
      const epouxY = doc.y;
      const newEpouxY = renderPersonInfo(column1, doc.y, 'Époux', {
        nom: data.conjoint1 || data.epouxNom || conjoint1.nom,
        prenoms: data.conjoint1Prenom || data.epouxPrenom || conjoint1.prenom || conjoint1.prenoms,
        dateNaissance: data.dateNaissanceConjoint1 || data.epouxDateNaissance || conjoint1.dateNaissance,
        lieuNaissance: data.lieuNaissanceConjoint1 || data.epouxLieuNaissance || conjoint1.lieuNaissance,
        profession: data.professionConjoint1 || data.epouxProfession || conjoint1.profession,
        adresse: data.adresseConjoint1 || data.epouxAdresse || conjoint1.adresse,
        typePieceIdentite: data.typePieceIdentiteConjoint1 || conjoint1.typePieceIdentite,
        numeroPieceIdentite: data.numeroPieceIdentiteConjoint1 || conjoint1.numeroPieceIdentite,
        nationalite: data.nationaliteConjoint1 || conjoint1.nationalite || 'Tchadienne',
        pere: data.pereConjoint1 || conjoint1.pere,
        mere: data.mereConjoint1 || conjoint1.mere
      });
      
      // Épouse (colonne de droite)
      const conjoint2 = data.conjoint2_details || data.epouse || {};
      renderPersonInfo(column2, epouxY, 'Épouse', {
        nom: data.conjointe2 || data.conjoint2Nom || data.epouseNom || conjoint2.nom,
        prenoms: data.conjoint2Prenom || data.epousePrenom || conjoint2.prenom || conjoint2.prenoms,
        dateNaissance: data.dateNaissanceConjointe2 || data.conjoint2DateNaissance || data.epouseDateNaissance || conjoint2.dateNaissance,
        lieuNaissance: data.lieuNaissanceConjointe2 || data.conjoint2LieuNaissance || data.epouseLieuNaissance || conjoint2.lieuNaissance,
        profession: data.professionConjointe2 || data.conjoint2Profession || data.epouseProfession || conjoint2.profession,
        adresse: data.adresseConjointe2 || data.conjoint2Adresse || data.epouseAdresse || conjoint2.adresse,
        typePieceIdentite: data.typePieceIdentiteConjointe2 || data.conjoint2TypePieceIdentite || conjoint2.typePieceIdentite,
        numeroPieceIdentite: data.numeroPieceIdentiteConjointe2 || data.conjoint2NumeroPieceIdentite || conjoint2.numeroPieceIdentite,
        nationalite: data.nationaliteConjointe2 || data.conjoint2Nationalite || conjoint2.nationalite || 'Tchadienne',
        pere: data.pereConjointe2 || data.conjoint2Pere || conjoint2.pere,
        mere: data.mereConjointe2 || data.conjoint2Mere || conjoint2.mere
      });
      
      // Ajuster la position Y pour la suite du document
      doc.y = Math.max(newEpouxY, doc.y) + 20;
      
      // Position Y après les colonnes
      doc.y = Math.max(
        doc.y,
        startY + 300
      ) + 40;
      
      // Détails du mariage
      doc
        .font('Helvetica-Bold')
        .fontSize(14)
        .text('DÉTAILS DU MARIAGE', { align: 'center' })
        .moveDown(1);
      
      doc
        .font('Helvetica')
        .text(`Date du mariage: ${data.dateMariage ? new Date(data.dateMariage).toLocaleDateString('fr-FR') : 'Non spécifiée'}`)
        .text(`Lieu du mariage: ${data.lieuMariage || 'Non spécifié'}`)
        .text(`Régime matrimonial: ${data.regimeMatrimonial || 'Communauté réduite aux acquêts'}`)
        .text(`Contrat de mariage: ${data.contratMariage || 'Non'}`)
        .moveDown(1);
      
      // Témoins
      if (data.temoins && data.temoins.length > 0) {
        doc
          .font('Helvetica-Bold')
          .fontSize(14)
          .text('TÉMOINS', { align: 'center' })
          .moveDown(0.5);
        
        data.temoins.forEach((temoin, index) => {
          doc
            .font('Helvetica')
            .text(`Témoin ${index + 1}: ${temoin.nom || 'Non spécifié'} ${temoin.prenom || ''}`, { indent: 20 })
            .text(`   Profession: ${temoin.profession || 'Non spécifiée'}`)
            .text(`   Adresse: ${temoin.adresse || temoin.residence || 'Non spécifiée'}`);
        });
        
        doc.moveDown(1);
      }
      
      // Observations
      if (data.observations) {
        doc
          .font('Helvetica-Bold')
          .text('OBSERVATIONS:', { underline: true })
          .moveDown(0.3);
        
        doc
          .font('Helvetica')
          .text(data.observations, { align: 'justify' })
          .moveDown(2);
      }
      
      // Signature
      doc
        .moveDown(3)
        .font('Helvetica')
        .text(`Fait à ${data.mairie || 'N/A'}, le ${data.dateEnregistrement ? new Date(data.dateEnregistrement).toLocaleDateString('fr-FR') : ''}`, { align: 'right' })
        .moveDown(3)
        .text('L\'officier d\'état civil', { align: 'right' })
        .moveDown(2)
        .text('Cachet et signature', { align: 'right', color: '#999' });
      
      // Pied de page avec le numéro de page
      const pageNumber = doc.bufferedPageRange().count;
      for (let i = 0; i < pageNumber; i++) {
        doc.switchToPage(i);
        
        // Ajouter le numéro de page
        doc
          .fontSize(10)
          .text(
            `Page ${i + 1} sur ${pageNumber}`,
            doc.page.width - 50,
            doc.page.height - 30
          );
      }
      
      // Finaliser le document
      doc.end();
    } catch (error) {
      console.error('Erreur lors de la génération du PDF de mariage:', error);
      logger.error('Erreur lors de la génération du PDF de mariage', { 
        error: error.message || 'Erreur inconnue',
        stack: error.stack 
      });
      reject(error);
    }
  });
};

const generatePdf = async (type, data) => {
  try {
    switch (type.toLowerCase()) {
      case 'divorce':
        return await generateDivorcePdf(data);
      case 'engagement-concubinage':
        return await generateEngagementConcubinagePdf(data);
      case 'naissance':
        return await generateNaissancePdf(data);
      case 'mariage':
        return await generateMariagePdf(data);
      default:
        throw new Error('Type de document non pris en charge');
    }
  } catch (error) {
    logger.error('Erreur lors de la génération du PDF', { error, type });
    throw error;
  }
};

// Exporter les fonctions
module.exports = {
  generateDivorcePdf,
  generateEngagementConcubinagePdf,
  generateNaissancePdf,
  generateMariagePdf,
  generatePdf,
  generateHeader,
  generatePersonneSection
};
