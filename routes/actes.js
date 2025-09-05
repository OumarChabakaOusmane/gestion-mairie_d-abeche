const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Acte = require('../models/Acte');
const { check, validationResult } = require('express-validator');
const PDFDocument = require('pdfkit');

// Validation des actes
const validateActe = (type, details) => {
  const errors = [];
  const requiredFields = {
    naissance: ['nom', 'prenom', 'sexe', 'dateNaissance', 'lieuNaissance', 'pere', 'mere'],
    mariage: ['conjoint1', 'conjointe2', 'dateMariage', 'lieuMariage'],
    deces: ['nom', 'prenom', 'dateDeces', 'lieuDeces']
  };

  if (!requiredFields[type]) {
    throw new Error('Type d\'acte non valide');
  }

  requiredFields[type].forEach(field => {
    if (!details[field]) {
      errors.push(`Le champ ${field} est obligatoire`);
    }
  });

  if (errors.length > 0) {
    throw new Error(errors.join(', '));
  }
};

// Middleware de validation
const validateActeInput = [
  check('type').isIn(['naissance', 'mariage', 'deces']),
  check('details').isObject(),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        errors: errors.array() 
      });
    }
    next();
  }
];

// Créer un acte
router.post('/', validateActeInput, async (req, res) => {
  try {
    const { type, details, mairie } = req.body;
    validateActe(type, details);
    
    const acte = new Acte({ 
      type, 
      details,
      mairie,
      createdBy: req.user._id,
      lastModifiedBy: req.user._id
    });
    
    await acte.save();
    
    res.status(201).json({ 
      success: true,
      message: 'Acte enregistré avec succès',
      data: acte
    });
  } catch (err) {
    res.status(400).json({ 
      success: false,
      error: err.message 
    });
  }
});

// Lister les actes avec pagination
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10)); // Max 100 items
    const skip = (page - 1) * limit;

    // Éviter les requêtes trop coûteuses
    if (skip > 10000) {
      return res.status(400).json({
        success: false,
        error: 'Pagination trop élevée. Utilisez des filtres pour affiner votre recherche.'
      });
    }

    const [actes, total] = await Promise.all([
      Acte.find()
        .sort({ dateEnregistrement: -1 })
        .skip(skip)
        .limit(limit)
        .lean(), // Optimisation mémoire
      Acte.countDocuments()
    ]);

    res.json({
      success: true,
      data: actes,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('Erreur liste actes:', err);
    res.status(500).json({ 
      success: false,
      error: 'Erreur serveur' 
    });
  }
});

// Obtenir un acte spécifique
router.get('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        error: 'ID invalide'
      });
    }

    const acte = await Acte.findById(req.params.id);
    if (!acte) {
      return res.status(404).json({
        success: false,
        error: 'Acte non trouvé'
      });
    }

    res.json({
      success: true,
      data: acte
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
});

// Générer et télécharger un PDF d'acte
router.get('/:id/pdf', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        error: 'ID invalide'
      });
    }

    const acte = await Acte.findById(req.params.id);
    if (!acte) {
      return res.status(404).json({
        success: false,
        error: 'Acte non trouvé'
      });
    }

    // Créer le document PDF
    const doc = new PDFDocument({ margin: 50 });
    
    // Configuration des headers pour le téléchargement
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="acte-${acte.type}-${acte.numeroActe}.pdf"`);
    
    // Pipe le PDF vers la réponse
    doc.pipe(res);

    // Générer le contenu selon le type d'acte
    if (acte.type === 'naissance') {
      generateNaissancePDF(doc, acte);
    } else if (acte.type === 'mariage') {
      generateMariagePDF(doc, acte);
    } else if (acte.type === 'deces') {
      generateDecesPDF(doc, acte);
    }

    // Finaliser le PDF
    doc.end();

  } catch (err) {
    console.error('Erreur génération PDF:', err);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la génération du PDF'
    });
  }
});

// Fonction pour générer un PDF d'acte de naissance
function generateNaissancePDF(doc, acte) {
  const details = acte.details;
  
  // === DRAPEAU DU TCHAD VISIBLE ===
  // Fond blanc pour le drapeau
  doc.rect(50, 30, 90, 60).fillColor('#FFFFFF').fill().strokeColor('#000000').stroke();
  
  // Bandes du drapeau
  doc.rect(50, 30, 30, 60).fillColor('#002689').fill(); // Bleu
  doc.rect(80, 30, 30, 60).fillColor('#FFD100').fill(); // Jaune  
  doc.rect(110, 30, 30, 60).fillColor('#CE1126').fill(); // Rouge
  
  // Contour du drapeau
  doc.rect(50, 30, 90, 60).fillColor('transparent').strokeColor('#000000').lineWidth(2).stroke();
  
  // === EN-TÊTE OFFICIEL ===
  doc.fillColor('#000000').lineWidth(1);
  doc.fontSize(16).font('Helvetica-Bold')
     .text('RÉPUBLIQUE DU TCHAD', 160, 35);
  doc.fontSize(12).font('Helvetica-Oblique')
     .text('Unité - Travail - Progrès', 160, 55);
  doc.fontSize(11).font('Helvetica')
     .text('MINISTÈRE DE L\'INTÉRIEUR ET DE LA SÉCURITÉ PUBLIQUE', 160, 75);
  
  // Ligne de séparation
  doc.moveTo(50, 110).lineTo(doc.page.width - 50, 110).strokeColor('#000000').lineWidth(1).stroke();
  
  // === TITRE PRINCIPAL ===
  doc.fontSize(20).font('Helvetica-Bold')
     .text('ACTE DE NAISSANCE', 0, 130, { align: 'center' });
  
  // Ligne décorative sous le titre
  doc.moveTo(150, 155).lineTo(doc.page.width - 150, 155).strokeColor('#CE1126').lineWidth(2).stroke();
  
  // === INFORMATIONS ADMINISTRATIVES ===
  let y = 180;
  
  // Cadre élégant pour les infos admin
  doc.roundedRect(50, y, doc.page.width - 100, 60, 5)
     .fillColor('#f8f9fa').fill()
     .strokeColor('#dee2e6').lineWidth(1).stroke();
  
  doc.fillColor('#000000').fontSize(11).font('Helvetica');
  doc.text(`N° d'acte: ${acte.numeroActe || 'En cours de génération'}`, 70, y + 15);
  doc.text(`Mairie: ${acte.mairie || 'Non renseigné'}`, 70, y + 30);
  doc.text(`Date d'enregistrement: ${new Date(acte.dateEnregistrement).toLocaleDateString('fr-FR')}`, 70, y + 45);
  
  y += 80;
  
  // === DÉCLARATION OFFICIELLE ===
  doc.fontSize(12).font('Helvetica')
     .text('Nous, Officier de l\'État Civil, certifions que:', 50, y);
  
  y += 30;
  
  // === INFORMATIONS DE L'ENFANT ===
  doc.roundedRect(50, y, doc.page.width - 100, 140, 5)
     .fillColor('#ffffff').fill()
     .strokeColor('#002689').lineWidth(2).stroke();
  
  // Titre de section avec fond coloré
  doc.rect(50, y, doc.page.width - 100, 25)
     .fillColor('#002689').fill();
  doc.fillColor('#ffffff').fontSize(12).font('Helvetica-Bold')
     .text('ENFANT', 0, y + 8, { align: 'center' });
  
  doc.fillColor('#000000').fontSize(11).font('Helvetica');
  y += 35;
  
  // Informations en colonnes élégantes
  doc.text('Nom:', 70, y, { continued: true }).font('Helvetica-Bold').text(` ${details.nom || 'Non renseigné'}`);
  doc.font('Helvetica').text('Prénom:', 70, y + 18, { continued: true }).font('Helvetica-Bold').text(` ${details.prenom || 'Non renseigné'}`);
  
  const sexeText = details.sexe === 'M' ? 'Masculin' : details.sexe === 'F' ? 'Féminin' : 'Non renseigné';
  doc.font('Helvetica').text('Sexe:', 70, y + 36, { continued: true }).font('Helvetica-Bold').text(` ${sexeText}`);
  
  const dateNaissance = details.dateNaissance ? new Date(details.dateNaissance).toLocaleDateString('fr-FR') : 'Non renseigné';
  doc.font('Helvetica').text('Né(e) le:', 70, y + 54, { continued: true }).font('Helvetica-Bold').text(` ${dateNaissance}`);
  
  const heureNaissance = details.heureNaissance ? `à ${details.heureNaissance}` : '';
  if (heureNaissance) {
    doc.font('Helvetica').text('Heure:', 300, y + 54, { continued: true }).font('Helvetica-Bold').text(` ${details.heureNaissance}`);
  }
  
  doc.font('Helvetica').text('Lieu de naissance:', 70, y + 72, { continued: true }).font('Helvetica-Bold').text(` ${details.lieuNaissance || 'Non renseigné'}`);
  
  y += 120;
  
  // === FILIATION ===
  doc.roundedRect(50, y, doc.page.width - 100, 180, 5)
     .fillColor('#ffffff').fill()
     .strokeColor('#FFD100').lineWidth(2).stroke();
  
  // Titre de section
  doc.rect(50, y, doc.page.width - 100, 25)
     .fillColor('#FFD100').fill();
  doc.fillColor('#000000').fontSize(12).font('Helvetica-Bold')
     .text('FILIATION', 0, y + 8, { align: 'center' });
  
  doc.fontSize(11).font('Helvetica');
  y += 35;
  
  // === INFORMATIONS DU PÈRE ===
  doc.fontSize(11).font('Helvetica-Bold').text('PÈRE:', 70, y);
  y += 15;
  
  const nomPere = `${details.prenomPere || ''} ${details.pere || details.nomPere || 'Non renseigné'}`.trim();
  doc.font('Helvetica').text('Nom et prénom:', 90, y, { continued: true }).font('Helvetica-Bold').text(` ${nomPere}`);
  
  if (details.dateNaissancePere) {
    const dateNaissancePere = new Date(details.dateNaissancePere).toLocaleDateString('fr-FR');
    doc.font('Helvetica').text('Né le:', 90, y + 15, { continued: true }).font('Helvetica-Bold').text(` ${dateNaissancePere}`);
  }
  
  if (details.lieuNaissancePere) {
    doc.font('Helvetica').text('Lieu de naissance:', 90, y + 30, { continued: true }).font('Helvetica-Bold').text(` ${details.lieuNaissancePere}`);
  }
  
  if (details.professionPere) {
    doc.font('Helvetica').text('Profession:', 90, y + 45, { continued: true }).font('Helvetica-Bold').text(` ${details.professionPere}`);
  }
  
  y += 70;
  
  // === INFORMATIONS DE LA MÈRE ===
  doc.fontSize(11).font('Helvetica-Bold').text('MÈRE:', 70, y);
  y += 15;
  
  const nomMere = `${details.prenomMere || ''} ${details.mere || details.nomMere || 'Non renseigné'}`.trim();
  doc.font('Helvetica').text('Nom et prénom:', 90, y, { continued: true }).font('Helvetica-Bold').text(` ${nomMere}`);
  
  if (details.dateNaissanceMere) {
    const dateNaissanceMere = new Date(details.dateNaissanceMere).toLocaleDateString('fr-FR');
    doc.font('Helvetica').text('Née le:', 90, y + 15, { continued: true }).font('Helvetica-Bold').text(` ${dateNaissanceMere}`);
  }
  
  if (details.lieuNaissanceMere) {
    doc.font('Helvetica').text('Lieu de naissance:', 90, y + 30, { continued: true }).font('Helvetica-Bold').text(` ${details.lieuNaissanceMere}`);
  }
  
  if (details.professionMere) {
    doc.font('Helvetica').text('Profession:', 90, y + 45, { continued: true }).font('Helvetica-Bold').text(` ${details.professionMere}`);
  }
  
  y += 65;
  
  // Adresse commune des parents
  if (details.adresse) {
    doc.font('Helvetica').text('Domicile des parents:', 70, y, { continued: true }).font('Helvetica-Bold').text(` ${details.adresse}`);
  }
  
  y += 35;
  
  // === FORMULE DE CLÔTURE ===
  y += 20;
  doc.fontSize(11).font('Helvetica-Oblique')
     .text(`En foi de quoi, nous avons dressé le présent acte le ${new Date().toLocaleDateString('fr-FR')}.`, 50, y, { align: 'justify' });
  
  // === SIGNATURE ===
  y += 40;
  
  // Cadre pour signature
  doc.roundedRect(doc.page.width - 220, y, 170, 80, 5)
     .fillColor('#f8f9fa').fill()
     .strokeColor('#CE1126').lineWidth(1).stroke();
  
  doc.fillColor('#000000').fontSize(11).font('Helvetica-Bold')
     .text('L\'Officier de l\'État Civil', doc.page.width - 210, y + 15);
  
  doc.fontSize(10).font('Helvetica')
     .text('Signature et cachet officiel', doc.page.width - 210, y + 55);
  
  // Ligne pour signature
  doc.moveTo(doc.page.width - 210, y + 45).lineTo(doc.page.width - 70, y + 45).strokeColor('#000000').lineWidth(1).stroke();
}

// Fonction pour générer un PDF d'acte de mariage
function generateMariagePDF(doc, acte) {
  const details = acte.details;
  
  // En-tête officiel
  doc.fontSize(20).font('Helvetica-Bold')
     .text('RÉPUBLIQUE DU TCHAD', { align: 'center' });
  doc.fontSize(16)
     .text('MINISTÈRE DE L\'INTÉRIEUR ET DE LA SÉCURITÉ PUBLIQUE', { align: 'center' });
  doc.fontSize(14)
     .text(acte.mairie || 'MAIRIE', { align: 'center' });
  
  doc.moveDown(2);
  
  // Titre de l'acte
  doc.fontSize(18).font('Helvetica-Bold')
     .text('ACTE DE MARIAGE', { align: 'center' });
  
  doc.moveDown(1);
  
  // Numéro d'acte
  doc.fontSize(12).font('Helvetica')
     .text(`N° ${acte.numeroActe}`, { align: 'right' });
  
  doc.moveDown(1);
  
  // Corps de l'acte
  doc.fontSize(12).font('Helvetica');
  
  const dateMariage = new Date(details.dateMariage).toLocaleDateString('fr-FR');
  const dateEnregistrement = new Date(acte.dateEnregistrement).toLocaleDateString('fr-FR');
  
  const texte = `L'an ${new Date().getFullYear()}, le ${dateEnregistrement}, par devant nous, Officier de l'État Civil de ${acte.mairie}, ont été unis par les liens du mariage :

ÉPOUX : ${details.conjoint1 || 'Non renseigné'}
ÉPOUSE : ${details.conjointe2 || 'Non renseigné'}

Le mariage a été célébré le ${dateMariage}
à ${details.lieuMariage || 'Non renseigné'}

Dressé le ${dateEnregistrement} et signé par nous, Officier de l'État Civil.`;

  doc.text(texte, { align: 'justify', lineGap: 5 });
  
  doc.moveDown(3);
  
  // Signature
  doc.text('L\'Officier de l\'État Civil', { align: 'right' });
  doc.moveDown(3);
  doc.text('Signature et cachet', { align: 'right' });
}

// Fonction pour générer un PDF d'acte de décès
function generateDecesPDF(doc, acte) {
  const details = acte.details;
  
  // En-tête officiel
  doc.fontSize(20).font('Helvetica-Bold')
     .text('RÉPUBLIQUE DU TCHAD', { align: 'center' });
  doc.fontSize(16)
     .text('MINISTÈRE DE L\'INTÉRIEUR ET DE LA SÉCURITÉ PUBLIQUE', { align: 'center' });
  doc.fontSize(14)
     .text(acte.mairie || 'MAIRIE', { align: 'center' });
  
  doc.moveDown(2);
  
  // Titre de l'acte
  doc.fontSize(18).font('Helvetica-Bold')
     .text('ACTE DE DÉCÈS', { align: 'center' });
  
  doc.moveDown(1);
  
  // Numéro d'acte
  doc.fontSize(12).font('Helvetica')
     .text(`N° ${acte.numeroActe}`, { align: 'right' });
  
  doc.moveDown(1);
  
  // Corps de l'acte
  doc.fontSize(12).font('Helvetica');
  
  const dateDeces = new Date(details.dateDeces).toLocaleDateString('fr-FR');
  const dateEnregistrement = new Date(acte.dateEnregistrement).toLocaleDateString('fr-FR');
  
  const texte = `L'an ${new Date().getFullYear()}, le ${dateEnregistrement}, par devant nous, Officier de l'État Civil de ${acte.mairie}, a été dressé l'acte de décès de :

${details.prenom || ''} ${details.nom || ''}

décédé(e) le ${dateDeces}
à ${details.lieuDeces || 'Non renseigné'}

Dressé le ${dateEnregistrement} et signé par nous, Officier de l'État Civil.`;

  doc.text(texte, { align: 'justify', lineGap: 5 });
  
  doc.moveDown(3);
  
  // Signature
  doc.text('L\'Officier de l\'État Civil', { align: 'right' });
  doc.moveDown(3);
  doc.text('Signature et cachet', { align: 'right' });
}

// Récupérer les actes récents
router.get('/recent', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    
    // Récupérer les actes récents de tous les types
    const recentActes = await Acte.find()
      .sort({ dateEnregistrement: -1 })
      .limit(limit)
      .select('type numeroActe nom prenom dateEnregistrement')
      .lean();

    // Formater la réponse
    const formattedActes = recentActes.map(acte => ({
      id: acte._id,
      type: acte.type,
      numeroActe: acte.numeroActe,
      nom: acte.nom,
      prenom: acte.prenom,
      date: acte.dateEnregistrement,
      timeAgo: formatTimeAgo(acte.dateEnregistrement)
    }));

    res.json({
      success: true,
      data: formattedActes
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des actes récents:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des actes récents',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Fonction utilitaire pour formater la date
function formatTimeAgo(date) {
  if (!date) return 'Inconnu';
  
  const now = new Date();
  const diffMs = now - new Date(date);
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffMins < 1) return 'À l\'instant';
  if (diffMins < 60) return `Il y a ${diffMins} minute${diffMins > 1 ? 's' : ''}`;
  if (diffHours < 24) return `Il y a ${diffHours} heure${diffHours > 1 ? 's' : ''}`;
  if (diffDays < 30) return `Il y a ${diffDays} jour${diffDays > 1 ? 's' : ''}`;
  
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `Il y a ${diffMonths} mois`;
  
  return `Il y a ${Math.floor(diffMonths / 12)} an${Math.floor(diffMonths / 12) > 1 ? 's' : ''}`;
}

// Mettre à jour un acte
router.put('/:id', validateActeInput, async (req, res) => {
  try {
    const { type, details, mairie } = req.body;
    validateActe(type, details);

    const acte = await Acte.findByIdAndUpdate(
      req.params.id,
      { 
        type, 
        details, 
        mairie,
        lastModifiedBy: req.user._id,
        lastModifiedAt: new Date()
      },
      { new: true, runValidators: true }
    );

    if (!acte) {
      return res.status(404).json({
        success: false,
        error: 'Acte non trouvé'
      });
    }

    res.json({
      success: true,
      message: 'Acte mis à jour',
      data: acte
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

// Supprimer un acte
router.delete('/:id', async (req, res) => {
  try {
    const acte = await Acte.findByIdAndDelete(req.params.id);
    
    if (!acte) {
      return res.status(404).json({
        success: false,
        error: 'Acte non trouvé'
      });
    }
    
    res.json({
      success: true,
      message: 'Acte supprimé'
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
});

module.exports = router;