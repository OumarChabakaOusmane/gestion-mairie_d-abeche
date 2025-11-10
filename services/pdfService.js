const PDFDocument = require('pdfkit');

// Fonction simple pour formater les dates
const formatDate = (date) => {
  if (!date) return '--/--/----';
  
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '--/--/----';
    
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
    
  } catch (e) {
    console.error('Erreur de formatage de date:', { 
      input: date, 
      type: typeof date,
      error: e.message 
    });
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

// Fonction pour générer un PDF d'acte de naissance
const generateNaissancePdf = (data) => {
  console.log('UTILISATION DU FICHIER pdfService.js MIS À JOUR');
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: {
          top: 40,
          bottom: 40,
          left: 50,
          right: 50
        },
        bufferPages: true
      });
      
      const buffers = [];
      
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });
      
      // Configuration des polices
      doc.font('Times-Roman');
      const smallFontSize = 9;
      const normalFontSize = 10;
      const titleFontSize = 12;
      const headerFontSize = 14;

      // Configuration des marges et espacements
      const margin = { top: 70, right: 50, bottom: 50, left: 50 };
      const lineHeight = 18;
      const labelWidth = 150;
      let y = margin.top;
      
      // En-tête centré
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
      
      // Ligne de séparation
      doc.lineWidth(0.5);
      doc.moveTo(margin.left, y).lineTo(doc.page.width - margin.right, y).stroke();
      y += 15;
      
      // Titre et numéro d'acte
      doc.font('Times-Bold').fontSize(12).text('EXTRAT D\'ACTE DE NAISSANCE', {
        align: 'center',
        y: y
      });
      
      // Afficher le numéro d'acte à droite du titre
      doc.font('Times-Roman').fontSize(10).text(
        `N° ${data.numeroActe || '.../MAT-SG/DGAT/DLP/...'}`,
        margin.left + 200,  // Position X ajustée
        y,                 // Même hauteur que le titre
        {
          width: doc.page.width - margin.right - 200,
          align: 'right'
        }
      );
      y += 25;
      
      // Fonction pour écrire une ligne avec label et valeur
      const writeLine = (label, value, yPos) => {
        const currentY = yPos || y;
        
        // Afficher le label en gras
        doc.font('Times-Bold').fontSize(10).text(label, margin.left, currentY);
        
        // Gérer les valeurs manquantes ou vides
        const displayValue = (value === undefined || value === null || value === '') ? '......................................' : value;
        
        // Afficher la valeur en police normale
        doc.font('Times-Roman').fontSize(10).text(displayValue, margin.left + labelWidth, currentY);
        
        return currentY + lineHeight;
      };
      
      // Ajouter un log des données reçues pour le débogage
      console.log('Données reçues pour la génération du PDF:', JSON.stringify({
        numeroActe: data.numeroActe,
        nom: data.nom,
        prenoms: data.prenoms,
        dateNaissance: data.dateNaissance,
        lieuNaissance: data.lieuNaissance,
        sexe: data.sexe,
        pere: data.pere,
        mere: data.mere,
        adresse: data.adresse
      }, null, 2));
      
      // Contenu principal - exactement comme sur l'image
      y = writeLine('NOM :', (data.nom || '').toUpperCase());
      y = writeLine('Prénoms :', data.prenoms || '');
      y = writeLine('Date de naissance :', data.dateNaissance ? formatDate(data.dateNaissance) : '');
      y = writeLine('Lieu de naissance :', data.lieuNaissance || '');
      y = writeLine('Sexe :', data.sexe || '');
      
      // Section parents
      y += 10;
      doc.font('Times-Bold').fontSize(11).text('INFORMATIONS SUR LES PARENTS', {
        x: margin.left,
        y: y,
        width: doc.page.width - margin.left - margin.right,
        align: 'center'
      });
      y += lineHeight;
      
      // Informations sur les parents
      y = writeLine('Père :', data.pere?.nom ? `${data.pere.prenoms || ''} ${data.pere.nom || ''}`.toUpperCase() : '');
      y = writeLine('Mère :', data.mere?.nom ? `${data.mere.prenoms || ''} ${data.mere.nom || ''}`.toUpperCase() : '');
      
      // Domicile
      y = writeLine('Domicile :', data.adresse || '');
      
      // Pied de page
      const signatureY = Math.max(y + 50, 650);
      
      // Date
      const dateText = `Fait à Abéché, le ${data.dateEtablissement ? formatDate(data.dateEtablissement) : formatDate(new Date())}`;
      doc.font('Times-Roman').fontSize(9).text(dateText, {
        align: 'right',
        y: signatureY,
        width: doc.page.width - margin.right * 2
      });
      
      // Signature
      const lineY = signatureY + 25;
      doc.lineWidth(0.5);
      doc.moveTo(doc.page.width / 2 - 80, lineY).lineTo(doc.page.width / 2 + 80, lineY).stroke();
      
      doc.font('Times-Roman').fontSize(9).text('L\'officier d\'état civil', {
        align: 'center',
        y: lineY + 3,
        width: doc.page.width - margin.right * 2
      });
      
      // Cachet
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
      console.error('Erreur dans generateNaissancePdf:', error);
      reject(new Error(`Erreur lors de la génération du PDF de naissance: ${error.message}`));
    }
  });
};

// Fonction pour générer un PDF d'acte de mariage
const generateMariagePdf = (data) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: {
          top: 40,
          bottom: 40,
          left: 50,
          right: 50
        },
        bufferPages: true
      });
      
      const buffers = [];
      
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      // Configuration des polices
      doc.font('Times-Roman');
      const smallFontSize = 9;
      const normalFontSize = 10;
      const titleFontSize = 12;
      const headerFontSize = 14;

      // Configuration des marges et espacements
      const margin = { top: 60, right: 50, bottom: 50, left: 40 };
      const lineHeight = 20;
      const labelWidth = 150;
      let y = margin.top;
      
      // En-tête centré
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
      
      // Titre du document centré
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
      
      // Fonction pour écrire une ligne avec label et valeur
      const writeLine = (label, value, yPos) => {
        // Position Y par défaut si non spécifiée
        const currentY = yPos || y;
        
        // Écrire le label en gras
        doc.font('Times-Bold').fontSize(10).text(label, margin.left, currentY);
        
        // Si pas de valeur, écrire juste le label
        if (!value) {
          return currentY + lineHeight;
        }
        
        // Écrire la valeur en police normale avec des points de suite
        doc.font('Times-Roman').fontSize(10).text(value, margin.left + labelWidth, currentY);
        
        // Retourner la prochaine position Y
        return currentY + lineHeight;
      };
      
      // Récupérer les détails des conjoints
      const conjoint1 = data.details?.conjoint1_details || {};
      const conjoint2 = data.details?.conjoint2_details || {};
      
      // Section Époux
      y = writeLine('NOM :', conjoint1.nom?.toUpperCase() || '');
      y = writeLine('Prénoms :', conjoint1.prenom || '');
      y = writeLine('Né(e) le :', conjoint1.dateNaissance ? formatDate(conjoint1.dateNaissance) : '');
      y = writeLine('À :', conjoint1.lieuNaissance || '');
      y = writeLine('Nationalité :', conjoint1.nationalite || '');
      y = writeLine('Profession :', conjoint1.profession || '');
      y = writeLine('Situation antérieure :', conjoint1.situationAnterieure || '');
      y = writeLine('Domicile :', conjoint1.adresse || '');
      y = writeLine('Fils de :', conjoint1.pere ? `${conjoint1.pere} et de ${conjoint1.mere || ''}` : '');
      
      // Section Épouse
      y += 10;
      doc.font('Times-Bold').fontSize(11).text('ÉPOUSE', { 
        x: margin.left, 
        y: y,
        width: doc.page.width - margin.left - margin.right,
        align: 'center'
      });
      y += lineHeight - 5;
      
      y = writeLine('NOM :', conjoint2.nom?.toUpperCase() || '');
      y = writeLine('Prénoms :', conjoint2.prenom || '');
      y = writeLine('Né(e) le :', conjoint2.dateNaissance ? formatDate(conjoint2.dateNaissance) : '');
      y = writeLine('À :', conjoint2.lieuNaissance || '');
      y = writeLine('Nationalité :', conjoint2.nationalite || '');
      y = writeLine('Profession :', conjoint2.profession || '');
      y = writeLine('Situation antérieure :', conjoint2.situationAnterieure || '');
      y = writeLine('Domicile :', conjoint2.adresse || '');
      y = writeLine('Fille de :', conjoint2.pere ? `${conjoint2.pere} et de ${conjoint2.mere || ''}` : '');
      
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
          y = writeLine(`Témoin ${index + 1} :`, `${temoins.nom || ''} (${temoins.profession || ''})`);
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
      
      y = writeLine('Date du mariage :', data.details?.dateMariage ? formatDate(data.details.dateMariage) : '');
      y = writeLine('Lieu du mariage :', data.details?.lieuMariage || '');
      y = writeLine('Heure du mariage :', data.details?.heureMariage || '');
      y = writeLine('Type de cérémonie :', data.details?.typeCeremonie || '');
      y = writeLine('Régime matrimonial :', data.details?.regimeMatrimonial || '');
      y = writeLine('Contrat de mariage :', data.details?.contratMariage || 'Non');
      
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
      
      // Cadre pour le cachet en haut à droite de la signature
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

// Fonction pour générer un PDF d'acte de décès
const generateDecesPdf = (data) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: {
          top: 40,
          bottom: 40,
          left: 50,
          right: 50
        },
        bufferPages: true
      });
      
      const buffers = [];
      
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      // Configuration des polices
      doc.font('Times-Roman');
      const smallFontSize = 9;
      const normalFontSize = 10;
      const titleFontSize = 12;
      const headerFontSize = 14;

      // Configuration des marges et espacements
      const margin = { top: 60, right: 50, bottom: 50, left: 40 };
      const lineHeight = 20;
      const labelWidth = 150;
      let y = margin.top;
      
      // En-tête centré
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
      
      // Titre du document centré
      doc.font('Times-Bold').fontSize(12).text('EXTRAIT D\'ACTE DE DÉCÈS', { 
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
      
      // Fonction pour écrire une ligne avec label et valeur
      const writeLine = (label, value, yPos) => {
        // Position Y par défaut si non spécifiée
        const currentY = yPos || y;
        
        // Écrire le label en gras
        doc.font('Times-Bold').fontSize(10).text(label, margin.left, currentY);
        
        // Si pas de valeur, écrire juste le label
        if (!value) {
          return currentY + lineHeight;
        }
        
        // Écrire la valeur en police normale
        doc.font('Times-Roman').fontSize(10).text(value, margin.left + labelWidth, currentY);
        
        // Retourner la prochaine position Y
        return currentY + lineHeight;
      };
      
      // Récupérer les détails du défunt
      const defunt = data.details || data;
      
      // Section Décès
      y = writeLine('Décédé(e) le :', defunt.dateDeces ? formatDate(defunt.dateDeces) : '');
      y = writeLine('À :', defunt.lieuDeces || '');
      y = writeLine('Heure du décès :', defunt.heureDeces || '');
      
      // Section Identité du défunt
      y += 10;
      doc.font('Times-Bold').fontSize(11).text('IDENTITÉ DU DÉFUNT', { 
        x: margin.left, 
        y: y,
        width: doc.page.width - margin.left - margin.right,
        align: 'center'
      });
      y += lineHeight - 5;
      
      y = writeLine('NOM :', defunt.nom?.toUpperCase() || '');
      y = writeLine('Prénoms :', defunt.prenoms || '');
      y = writeLine('Sexe :', defunt.sexe || '');
      y = writeLine('Né(e) le :', defunt.dateNaissance ? formatDate(defunt.dateNaissance) : '');
      y = writeLine('À :', defunt.lieuNaissance || '');
      y = writeLine('Âge :', defunt.age || '');
      y = writeLine('Profession :', defunt.profession || '');
      y = writeLine('Domicile :', defunt.adresse || '');
      y = writeLine('Nationalité :', defunt.nationalite || '');
      
      // Section Situation familiale
      if (defunt.situationMatrimoniale || defunt.nomConjoint) {
        y += 10;
        doc.font('Times-Bold').fontSize(11).text('SITUATION FAMILIALE', { 
          x: margin.left, 
          y: y,
          width: doc.page.width - margin.left - margin.right,
          align: 'center'
        });
        y += lineHeight - 5;
        
        y = writeLine('Situation matrimoniale :', defunt.situationMatrimoniale || '');
        if (defunt.nomConjoint) {
          y = writeLine('Époux/Épouse :', defunt.nomConjoint);
        }
      }
      
      // Section Parents
      if (defunt.pere || defunt.mere) {
        y += 10;
        doc.font('Times-Bold').fontSize(11).text('PARENTS', { 
          x: margin.left, 
          y: y,
          width: doc.page.width - margin.left - margin.right,
          align: 'center'
        });
        y += lineHeight - 5;
        
        y = writeLine('Père :', defunt.pere || '');
        y = writeLine('Mère :', defunt.mere || '');
      }
      
      // Section Déclaration
      if (defunt.declarant) {
        y += 10;
        doc.font('Times-Bold').fontSize(11).text('DÉCLARATION', { 
          x: margin.left, 
          y: y,
          width: doc.page.width - margin.left - margin.right,
          align: 'center'
        });
        y += lineHeight - 5;
        
        y = writeLine('Déclaré par :', defunt.declarant.nom ? 
          `${defunt.declarant.prenom || ''} ${defunt.declarant.nom}`.trim() : '');
        y = writeLine('Lien avec le défunt :', defunt.declarant.lien || '');
        y = writeLine('Adresse du déclarant :', defunt.declarant.adresse || '');
      }
      
      // Section Médecin
      if (defunt.medecin) {
        y += 10;
        doc.font('Times-Bold').fontSize(11).text('CERTIFICAT MÉDICAL', { 
          x: margin.left, 
          y: y,
          width: doc.page.width - margin.left - margin.right,
          align: 'center'
        });
        y += lineHeight - 5;
        
        y = writeLine('Médecin :', defunt.medecin.nom ? 
          `${defunt.medecin.prenom || ''} ${defunt.medecin.nom}`.trim() : '');
        y = writeLine('N° d\'ordre :', defunt.medecin.numeroOrdre || '');
      }
      
      // Section Cause du décès
      if (defunt.causeDeces) {
        y += 10;
        doc.font('Times-Bold').fontSize(11).text('CAUSE DU DÉCÈS', { 
          x: margin.left, 
          y: y,
          width: doc.page.width - margin.left - margin.right,
          align: 'center'
        });
        y += lineHeight - 5;
        
        doc.font('Times-Roman').fontSize(10).text(defunt.causeDeces, {
          x: margin.left,
          y: y,
          width: doc.page.width - margin.left - margin.right,
          align: 'left',
          lineGap: 5
        });
        y += 60; // Ajuster selon la taille du texte
      }
      
      // Section Observations
      if (defunt.observations) {
        y += 10;
        doc.font('Times-Bold').fontSize(11).text('OBSERVATIONS', { 
          x: margin.left, 
          y: y,
          width: doc.page.width - margin.left - margin.right,
          align: 'center'
        });
        y += lineHeight - 5;
        
        doc.font('Times-Roman').fontSize(10).text(defunt.observations, {
          x: margin.left,
          y: y,
          width: doc.page.width - margin.left - margin.right,
          align: 'left',
          lineGap: 5
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
      
      // Cadre pour le cachet en haut à droite de la signature
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
      console.error('Erreur dans generateDecesPdf:', error);
      reject(new Error(`Erreur lors de la génération du PDF de décès: ${error.message}`));
    }
  });
};

// Fonction pour générer un PDF d'acte de divorce
const generateDivorcePdf = (data) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: {
          top: 40,
          bottom: 40,
          left: 50,
          right: 50
        },
        bufferPages: true
      });
      
      const buffers = [];
      
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      // Configuration des polices
      doc.font('Times-Roman');
      const smallFontSize = 9;
      const normalFontSize = 10;
      const titleFontSize = 12;
      const headerFontSize = 14;

      // Configuration des marges et espacements
      const margin = { top: 60, right: 50, bottom: 50, left: 40 };
      const lineHeight = 20;
      const labelWidth = 150;
      let y = margin.top;
      
      // En-tête centré
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
      
      doc.font('Times-Bold').fontSize(12).text('TRIBUNAL DE PREMIÈRE INSTANCE D\'ABÉCHÉ', { 
        align: 'center', 
        y: y
      });
      y += 25;
      
      // Ligne de séparation fine
      doc.lineWidth(0.3);
      doc.moveTo(margin.left, y).lineTo(doc.page.width - margin.right, y).stroke();
      y += 20;
      
      // Titre du document centré
      doc.font('Times-Bold').fontSize(12).text('EXTRAIT DE JUGEMENT DE DIVORCE', { 
        align: 'center',
        y: y
      });
      
      // Numéro d'acte aligné à droite
      doc.font('Times-Roman').fontSize(10).text(
        `N° ${data.numeroActe || '.../TPI-ABE/...'}`, 
        { 
          align: 'right',
          y: y - 15,
          width: doc.page.width - margin.right * 2
        }
      );
      y += 30;
      
      // Fonction pour écrire une ligne avec label et valeur
      const writeLine = (label, value, yPos) => {
        // Position Y par défaut si non spécifiée
        const currentY = yPos || y;
        
        // Écrire le label en gras
        doc.font('Times-Bold').fontSize(10).text(label, margin.left, currentY);
        
        // Si pas de valeur, écrire juste le label
        if (!value) {
          return currentY + lineHeight;
        }
        
        // Écrire la valeur en police normale
        doc.font('Times-Roman').fontSize(10).text(value, margin.left + labelWidth, currentY);
        
        // Retourner la prochaine position Y
        return currentY + lineHeight;
      };
      
      // Récupérer les détails du divorce
      const divorce = data.details || data;
      const epoux = divorce.epoux || {};
      const epouse = divorce.epouse || {};
      
      // Section Informations sur le mariage
      y = writeLine('Date du mariage :', divorce.dateMariage ? formatDate(divorce.dateMariage) : '');
      y = writeLine('Lieu du mariage :', divorce.lieuMariage || '');
      y = writeLine('Régime matrimonial :', divorce.regimeMatrimonial || '');
      y = writeLine('Date du jugement :', divorce.dateDivorce ? formatDate(divorce.dateDivorce) : '');
      y = writeLine('Numéro du jugement :', divorce.numeroJugement || '');
      
      // Section Demandeur (époux)
      y += 10;
      doc.font('Times-Bold').fontSize(11).text('DEMANDEUR', { 
        x: margin.left, 
        y: y,
        width: doc.page.width - margin.left - margin.right,
        align: 'center'
      });
      y += lineHeight - 5;
      
      y = writeLine('NOM :', epoux.nom?.toUpperCase() || '');
      y = writeLine('Prénoms :', epoux.prenoms || '');
      y = writeLine('Né(e) le :', epoux.dateNaissance ? formatDate(epoux.dateNaissance) : '');
      y = writeLine('À :', epoux.lieuNaissance || '');
      y = writeLine('Profession :', epoux.profession || '');
      y = writeLine('Domicile :', epoux.adresse || '');
      y = writeLine('Nationalité :', epoux.nationalite || '');
      
      // Section Défendeur (épouse)
      y += 10;
      doc.font('Times-Bold').fontSize(11).text('DÉFENDEUR', { 
        x: margin.left, 
        y: y,
        width: doc.page.width - margin.left - margin.right,
        align: 'center'
      });
      y += lineHeight - 5;
      
      y = writeLine('NOM :', epouse.nom?.toUpperCase() || '');
      y = writeLine('Prénoms :', epouse.prenoms || '');
      y = writeLine('Né(e) le :', epouse.dateNaissance ? formatDate(epouse.dateNaissance) : '');
      y = writeLine('À :', epouse.lieuNaissance || '');
      y = writeLine('Profession :', epouse.profession || '');
      y = writeLine('Domicile :', epouse.adresse || '');
      y = writeLine('Nationalité :', epouse.nationalite || '');
      
      // Section Enfants
      if (divorce.enfants && divorce.enfants.length > 0) {
        y += 10;
        doc.font('Times-Bold').fontSize(11).text('ENFANTS ISSUS DU MARIAGE', { 
          x: margin.left, 
          y: y,
          width: doc.page.width - margin.left - margin.right,
          align: 'center'
        });
        y += lineHeight - 5;
        
        divorce.enfants.forEach((enfant, index) => {
          y = writeLine(`Enfant ${index + 1} :`, 
            `${enfant.prenom || ''} ${enfant.nom || ''} (${enfant.dateNaissance ? formatDate(enfant.dateNaissance) : ''})`
          );
        });
      }
      
      // Section Décision
      y += 10;
      doc.font('Times-Bold').fontSize(11).text('DÉCISION', { 
        x: margin.left, 
        y: y,
        width: doc.page.width - margin.left - margin.right,
        align: 'center'
      });
      y += lineHeight - 5;
      
      // Motifs du divorce
      if (divorce.motifs) {
        y = writeLine('Motifs :', '');
        doc.font('Times-Roman').fontSize(10).text(divorce.motifs, {
          x: margin.left + 20,
          y: y,
          width: doc.page.width - margin.left - margin.right - 20,
          align: 'left',
          lineGap: 5
        });
        y += 40; // Ajuster selon la taille du texte
      }
      
      // Garde des enfants
      if (divorce.gardeEnfants) {
        y = writeLine('Garde des enfants :', divorce.gardeEnfants);
      }
      
      // Pension alimentaire
      if (divorce.pensionAlimentaire) {
        y = writeLine('Pension alimentaire :', divorce.pensionAlimentaire);
      }
      
      // Autres décisions
      if (divorce.autresDecisions) {
        y = writeLine('Autres décisions :', '');
        doc.font('Times-Roman').fontSize(10).text(divorce.autresDecisions, {
          x: margin.left + 20,
          y: y,
          width: doc.page.width - margin.left - margin.right - 20,
          align: 'left',
          lineGap: 5
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
      doc.font('Times-Roman').fontSize(9).text('Le Président du Tribunal', { 
        align: 'center',
        y: lineY + 2,
        width: doc.page.width - margin.right * 2
      });
      
      // Cadre pour le cachet en haut à droite de la signature
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
      console.error('Erreur dans generateDivorcePdf:', error);
      reject(new Error(`Erreur lors de la génération du PDF de divorce: ${error.message}`));
    }
  });
};

// Fonction principale de génération de PDF
const generatePdf = async (type, data) => {
  try {
    console.log('=== DÉBUT GÉNÉRATION PDF ===');
    console.log('Type de document:', type);
    console.log('Données reçues:', JSON.stringify(data, null, 2));
    
    let result;
    
    switch (type) {
      case 'naissance':
        // Vérifier si les données sont déjà dans le format attendu (cas où on appelle directement generateNaissancePdf)
        if (data.nom || data.prenoms) {
          console.log('Données déjà formatées pour la naissance');
          result = await generateNaissancePdf(data);
        } 
        // Sinon, formater les données depuis la structure details
        else {
          console.log('Formatage des données pour la naissance depuis la structure details');
          const naissanceData = {
            // Informations de base
            numeroActe: data.numeroActe || '.../MAT-SG/DGAT/DLP/...',
            dateEtablissement: data.dateEtablissement || new Date().toISOString(),
            
            // Informations de l'enfant
            nom: data.details?.nom || data.nomEnfant || '',
            prenoms: data.details?.prenom || data.prenomsEnfant || '',
            dateNaissance: data.details?.dateNaissance || data.dateNaissance || '',
            lieuNaissance: data.details?.lieuNaissance || data.lieuNaissance || '',
            sexe: data.details?.sexe || data.sexe || '',
            
            // Informations des parents
            pere: {
              nom: data.details?.pere || data.pere?.nom || data.nomPere || '',
              prenoms: data.details?.prenomPere || data.pere?.prenoms || data.prenomPere || ''
            },
            
            mere: {
              nom: data.details?.mere || data.mere?.nom || data.nomMere || '',
              prenoms: data.details?.prenomMere || data.mere?.prenoms || data.prenomMere || ''
            },
            
            // Adresse
            adresse: data.details?.adresse || data.adresse || data.adresseDeclarant || ''
          };
          
          console.log('Données formatées pour la naissance:', JSON.stringify(naissanceData, null, 2));
          result = await generateNaissancePdf(naissanceData);
        }
        break;
        
      case 'mariage':
        result = await generateMariagePdf(data);
        break;
        
      case 'deces':
        result = await generateDecesPdf(data);
        break;
        
      case 'divorce':
        result = await generateDivorcePdf(data);
        break;
        
      default:
        throw new PdfGenerationError('Type de document non pris en charge', 'UNSUPPORTED_DOCUMENT_TYPE');
    }
    
    console.log('=== FIN GÉNÉRATION PDF ===');
    return result;
    
  } catch (error) {
    console.error('Erreur dans generatePdf:', {
      message: error.message,
      stack: error.stack,
      type,
      data: JSON.stringify(data, null, 2)
    });
    
    if (error instanceof PdfGenerationError) throw error;
    throw new PdfGenerationError(
      'Erreur lors de la génération du PDF', 
      'GENERATION_ERROR', 
      { error: error.message }
    );
  }
};

module.exports = {
  generatePdf,
  PdfGenerationError
};
