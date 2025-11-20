const { generateDecesPdf } = require('./generateDecesPdf');
const PDFDocument = require('pdfkit');

// Helper: formater une date en FR
const formatDate = (date) => {
  if (!date) return '--/--/----';
  try {
    const d = new Date(date);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch (e) {
    return '--/--/----';
  }
};

class PdfGenerationError extends Error {
  constructor(message, code = 'PDF_GENERATION_ERROR', details = {}) {
    super(message);
    this.name = 'PdfGenerationError';
    this.code = code;
    this.details = details;
  }
}

// Fonction utilitaire pour écrire une ligne avec label et valeur
const writeLine = (doc, label, value, yPos, options = {}) => {
  const { margin = { left: 40 }, lineHeight = 20, labelWidth = 150 } = options;
  
  // Écrire le label en gras
  doc.font('Times-Bold').fontSize(10).text(label, margin.left, yPos);
  
  // Si pas de valeur, écrire juste le label
  if (value === undefined || value === null) {
    return yPos + lineHeight;
  }
  
  // Écrire la valeur en police normale
  doc.font('Times-Roman').fontSize(10).text(value, margin.left + labelWidth, yPos);
  
  return yPos + lineHeight;
};

// Fonction pour générer un PDF d'acte de naissance
const generateNaissancePdf = (data) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', bufferPages: true });
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      // Configuration des marges et espacements
      const margin = { top: 60, right: 50, bottom: 50, left: 40 };
      const lineHeight = 20;
      let y = margin.top;

      // En-tête
      doc.font('Times-Bold').fontSize(12).text('RÉPUBLIQUE DU TCHAD', { 
        align: 'center', 
        y: y
      });
      y += 15;

      doc.font('Times-Roman').fontSize(10).text('Unité - Travail - Progrès', { 
        align: 'center', 
        y: y
      });
      y += 15;

      doc.font('Times-Bold').fontSize(12).text('MAIRIE DE LA VILLE D\'ABÉCHÉ', { 
        align: 'center', 
        y: y
      });
      y += 25;

      // Ligne de séparation fine
      doc.lineWidth(0.3);
      doc.moveTo(margin.left, y).lineTo(doc.page.width - margin.right, y).stroke();
      y += 20;

      // Titre du document
      doc.font('Times-Bold').fontSize(12).text('EXTRAIT D\'ACTE DE NAISSANCE', { 
        align: 'center',
        y: y
      });
      y += 30;

      // Détails de l'acte de naissance
      y = writeLine(doc, 'N° d\'acte :', data.numeroActe || '', y);
      y = writeLine(doc, 'NOM :', (data.nom || '').toUpperCase(), y);
      y = writeLine(doc, 'Prénoms :', data.prenoms || '', y);
      y = writeLine(doc, 'Date de naissance :', data.dateNaissance ? formatDate(data.dateNaissance) : '', y);
      y = writeLine(doc, 'Lieu de naissance :', data.lieuNaissance || '', y);
      y = writeLine(doc, 'Sexe :', data.sexe || '', y);

      // Section Parents
      if (data.pere || data.mere) {
        y += 10;
        doc.font('Times-Bold').fontSize(11).text('PARENTS', { 
          x: margin.left, 
          y: y,
          width: doc.page.width - margin.left - margin.right,
          align: 'center'
        });
        y += lineHeight - 5;
        
        y = writeLine(doc, 'Père :', data.pere || '', y);
        y = writeLine(doc, 'Mère :', data.mere || '', y);
      }

      // Section Déclarant
      if (data.declarant) {
        y += 10;
        doc.font('Times-Bold').fontSize(11).text('DÉCLARATION', { 
          x: margin.left, 
          y: y,
          width: doc.page.width - margin.left - margin.right,
          align: 'center'
        });
        y += lineHeight - 5;
        
        y = writeLine(doc, 'Déclaré par :', data.declarant.nom ? 
          `${data.declarant.prenom || ''} ${data.declarant.nom}`.trim() : '', y);
        y = writeLine(doc, 'Lien avec l\'enfant :', data.declarant.lien || '', y);
        y = writeLine(doc, 'Adresse du déclarant :', data.declarant.adresse || '', y);
      }

      // Pied de page avec signature et cachet
      const signatureY = Math.max(y + 40, 650);
      
      // Date alignée à droite
      const dateText = `Fait à Abéché, le ${data.dateEtablissement ? formatDate(data.dateEtablissement) : formatDate(new Date())}`;
      doc.font('Times-Roman').fontSize(9).text(dateText, { 
        align: 'right',
        y: signatureY,
        width: doc.page.width - margin.right * 2
      });
      
      // Ligne de signature centrée
      const lineY = signatureY + 20;
      doc.lineWidth(0.3);
      doc.moveTo(doc.page.width / 2 - 80, lineY).lineTo(doc.page.width / 2 + 80, lineY).stroke();

      // Texte sous la ligne de signature
      doc.font('Times-Roman').fontSize(9).text('L\'officier d\'état civil', { 
        align: 'center',
        y: lineY + 2,
        width: doc.page.width - margin.right * 2
      });

      // Cadre pour le cachet
      const cachetSize = 65;
      const cachetX = doc.page.width - margin.right - cachetSize - 10;
      const cachetY = lineY - 10;

      // Dessiner le cadre du cachet
      doc.rect(cachetX, cachetY, cachetSize, cachetSize).stroke();

      // Texte à l'intérieur du cachet
      doc.font('Times-Roman').fontSize(8).text('CACHET ET', cachetX, cachetY + 18, { 
        align: 'center',
        width: cachetSize
      });
      doc.font('Times-Roman').fontSize(8).text('SIGNATURE', cachetX, cachetY + 30, { 
        align: 'center',
        width: cachetSize
      });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

// Fonction pour générer un PDF d'acte de mariage
const generateMariagePdf = (data) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', bufferPages: true });
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      // Configuration des marges et espacements
      const margin = { top: 60, right: 50, bottom: 50, left: 40 };
      const lineHeight = 20;
      let y = margin.top;

      // En-tête
      doc.font('Times-Bold').fontSize(12).text('RÉPUBLIQUE DU TCHAD', { 
        align: 'center', 
        y: y
      });
      y += 15;

      doc.font('Times-Roman').fontSize(10).text('Unité - Travail - Progrès', { 
        align: 'center', 
        y: y
      });
      y += 15;

      doc.font('Times-Bold').fontSize(12).text('MAIRIE DE LA VILLE D\'ABÉCHÉ', { 
        align: 'center', 
        y: y
      });
      y += 25;

      // Ligne de séparation fine
      doc.lineWidth(0.3);
      doc.moveTo(margin.left, y).lineTo(doc.page.width - margin.right, y).stroke();
      y += 20;

      // Titre du document
      doc.font('Times-Bold').fontSize(12).text('EXTRAIT D\'ACTE DE MARIAGE', { 
        align: 'center',
        y: y
      });

      // Numéro d'acte aligné à droite
      doc.font('Times-Roman').fontSize(10).text(
        `N° ${data.numeroActe || '.../MAT-SG/DGAT/DLP/...'}`, 
        { 
          align: 'right',
          y: y - 15,
          width: doc.page.width - margin.right * 2
        }
      );
      y += 30;

      // Récupérer les détails des conjoints
      const conjoint1 = data.details?.conjoint1_details || {};
      const conjoint2 = data.details?.conjoint2_details || {};

      // Section Époux
      y = writeLine(doc, 'NOM :', conjoint1.nom?.toUpperCase() || '', y);
      y = writeLine(doc, 'Prénoms :', conjoint1.prenom || '', y);
      y = writeLine(doc, 'Né(e) le :', conjoint1.dateNaissance ? formatDate(conjoint1.dateNaissance) : '', y);
      y = writeLine(doc, 'À :', conjoint1.lieuNaissance || '', y);
      y = writeLine(doc, 'Nationalité :', conjoint1.nationalite || '', y);
      y = writeLine(doc, 'Profession :', conjoint1.profession || '', y);
      y = writeLine(doc, 'Situation antérieure :', conjoint1.situationAnterieure || '', y);
      y = writeLine(doc, 'Domicile :', conjoint1.adresse || '', y);
      y = writeLine(doc, 'Fils de :', conjoint1.pere ? `${conjoint1.pere} et de ${conjoint1.mere || ''}` : '', y);

      // Section Épouse
      y += 10;
      doc.font('Times-Bold').fontSize(11).text('ÉPOUSE', { 
        x: margin.left, 
        y: y,
        width: doc.page.width - margin.left - margin.right,
        align: 'center'
      });
      y += lineHeight - 5;

      y = writeLine(doc, 'NOM :', conjoint2.nom?.toUpperCase() || '', y);
      y = writeLine(doc, 'Prénoms :', conjoint2.prenom || '', y);
      y = writeLine(doc, 'Né(e) le :', conjoint2.dateNaissance ? formatDate(conjoint2.dateNaissance) : '', y);
      y = writeLine(doc, 'À :', conjoint2.lieuNaissance || '', y);
      y = writeLine(doc, 'Nationalité :', conjoint2.nationalite || '', y);
      y = writeLine(doc, 'Profession :', conjoint2.profession || '', y);
      y = writeLine(doc, 'Situation antérieure :', conjoint2.situationAnterieure || '', y);
      y = writeLine(doc, 'Domicile :', conjoint2.adresse || '', y);
      y = writeLine(doc, 'Fille de :', conjoint2.pere ? `${conjoint2.pere} et de ${conjoint2.mere || ''}` : '', y);

      // Section Témoins
      if (data.details?.temoins && data.details.temoins.length > 0) {
        y += 10;
        doc.font('Times-Bold').fontSize(11).text('TÉMOINS', { 
          x: margin.left, 
          y: y,
          width: doc.page.width - margin.left - margin.right,
          align: 'center'
        });
        y += lineHeight - 5;
  
        data.details.temoins.forEach((temoins, index) => {
          y = writeLine(doc, `Témoin ${index + 1} :`, `${temoins.nom || ''} (${temoins.profession || ''})`, y);
        });
      }

      // Section Mariage
      y += 10;
      doc.font('Times-Bold').fontSize(11).text('MARIAGE', { 
        x: margin.left, 
        y: y,
        width: doc.page.width - margin.left - margin.right,
        align: 'center'
      });
      y += lineHeight - 5;

      y = writeLine(doc, 'Date du mariage :', data.details?.dateMariage ? formatDate(data.details.dateMariage) : '', y);
      y = writeLine(doc, 'Lieu du mariage :', data.details?.lieuMariage || '', y);
      y = writeLine(doc, 'Heure du mariage :', data.details?.heureMariage || '', y);
      y = writeLine(doc, 'Type de cérémonie :', data.details?.typeCeremonie || '', y);
      y = writeLine(doc, 'Régime matrimonial :', data.details?.regimeMatrimonial || '', y);
      y = writeLine(doc, 'Contrat de mariage :', data.details?.contratMariage || 'Non', y);

      // Observations
      if (data.details?.observations) {
        y += 10;
        doc.font('Times-Bold').fontSize(11).text('OBSERVATIONS', { 
          x: margin.left, 
          y: y,
          width: doc.page.width - margin.left - margin.right,
          align: 'center'
        });
        y += lineHeight - 5;
  
        doc.font('Times-Roman').fontSize(10).text(data.details.observations, {
          x: margin.left,
          y: y,
          width: doc.page.width - margin.left - margin.right,
          align: 'left'
        });
        y += 30; // Ajuster selon la taille du texte
      }

      // Pied de page avec signature et cachet
      const signatureY = Math.max(y + 40, 650);
      
      // Date alignée à droite
      const dateText = `Fait à Abéché, le ${data.dateEtablissement ? formatDate(data.dateEtablissement) : formatDate(new Date())}`;
      doc.font('Times-Roman').fontSize(9).text(dateText, { 
        align: 'right',
        y: signatureY,
        width: doc.page.width - margin.right * 2
      });
      
      // Ligne de signature centrée
      const lineY = signatureY + 20;
      doc.lineWidth(0.3);
      doc.moveTo(doc.page.width / 2 - 80, lineY).lineTo(doc.page.width / 2 + 80, lineY).stroke();

      // Texte sous la ligne de signature
      doc.font('Times-Roman').fontSize(9).text('L\'officier d\'état civil', { 
        align: 'center',
        y: lineY + 2,
        width: doc.page.width - margin.right * 2
      });

      // Cadre pour le cachet
      const cachetSize = 65;
      const cachetX = doc.page.width - margin.right - cachetSize - 10;
      const cachetY = lineY - 10;

      // Dessiner le cadre du cachet
      doc.rect(cachetX, cachetY, cachetSize, cachetSize).stroke();

      // Texte à l'intérieur du cachet
      doc.font('Times-Roman').fontSize(8).text('CACHET ET', cachetX, cachetY + 18, { 
        align: 'center',
        width: cachetSize
      });
      doc.font('Times-Roman').fontSize(8).text('SIGNATURE', cachetX, cachetY + 30, { 
        align: 'center',
        width: cachetSize
      });

      doc.end();
    } catch (error) {
      console.error('Erreur dans generateMariagePdf:', error);
      reject(new Error(`Erreur lors de la génération du PDF de mariage: ${error.message}`));
    }
  });
};

// Fonction principale de génération de PDF
const generatePdf = async (type, data) => {
  try {
    switch (type) {
      case 'naissance':
        return await generateNaissancePdf(data);
      case 'mariage':
        return await generateMariagePdf(data);
      case 'deces':
        return await generateDecesPdf(data);
      default:
        throw new PdfGenerationError(`Type de document non supporté: ${type}`);
    }
  } catch (err) {
    if (err instanceof PdfGenerationError) throw err;
    throw new PdfGenerationError(
      err.message || 'Erreur lors de la génération du PDF', 
      'GENERATION_ERROR', 
      { original: err }
    );
  }
};

module.exports = {
  generatePdf,
  PdfGenerationError
};
