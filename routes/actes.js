const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const Acte = require('../models/Acte');
const { check, validationResult } = require('express-validator');
const { generatePdf } = require('../services/pdfService');
const PDFDocument = require('pdfkit');
const { authenticate } = require('../middleware/auth');
const decesController = require('../controllers/decesController');

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
router.post('/', authenticate, validateActeInput, async (req, res) => {
  try {
    console.log('Requête reçue pour créer un acte:', JSON.stringify(req.body, null, 2));
    
    const { type, details, mairie } = req.body;
    
    try {
      validateActe(type, details);
    } catch (validationError) {
      console.error('Erreur de validation:', validationError.message);
      return res.status(400).json({
        success: false,
        error: `Erreur de validation: ${validationError.message}`,
        validationError: validationError.message,
        receivedData: { type, details, mairie }
      });
    }
    
    try {
      const acte = new Acte({ 
        type, 
        details,
        mairie,
        createdBy: req.user?._id || 'system',
        lastModifiedBy: req.user?._id || 'system'
      });
      
      await acte.save();
      
      console.log('Acte enregistré avec succès:', acte._id);
      
      res.status(201).json({ 
        success: true,
        message: 'Acte enregistré avec succès',
        data: acte
      });
    } catch (dbError) {
      console.error('Erreur lors de l\'enregistrement en base de données:', dbError);
      return res.status(400).json({
        success: false,
        error: `Erreur lors de l'enregistrement: ${dbError.message}`,
        dbError: dbError.message,
        receivedData: { type, details, mairie }
      });
    }
  } catch (err) {
    console.error('Erreur inattendue:', err);
    res.status(500).json({ 
      success: false,
      error: `Erreur serveur: ${err.message}`,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
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

// ====================================
// ROUTE DE RECHERCHE - DOIT ÊTRE AVANT LA ROUTE /:id
// ====================================
router.get('/search', authenticate, async (req, res) => {
  // Début du suivi des performances
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substr(2, 9);
  
  console.log(`[${new Date().toISOString()}] [${requestId}] Requête de recherche reçue`, {
    query: req.query,
    user: req.user ? req.user._id : 'non authentifié',
    ip: req.ip
  });
  
  try {
    // Vérifier le terme de recherche
    let searchTerm = req.query.q;
    
    if (!searchTerm || searchTerm.trim() === '') {
      console.log(`[${requestId}] Erreur: Terme de recherche manquant`);
      return res.status(400).json({ 
        success: false, 
        error: 'Le terme de recherche est requis' 
      });
    }

    // Nettoyer le terme de recherche (retirer les préfixes de champ comme 'MAHAMAT:1')
    searchTerm = searchTerm.split(':')[0].trim();
    
    if (searchTerm.length < 2) {
      console.log(`[${requestId}] Erreur: Terme de recherche trop court: "${searchTerm}"`);
      return res.status(400).json({
        success: false,
        error: 'Le terme de recherche doit contenir au moins 2 caractères'
      });
    }
    
    console.log(`[${requestId}] Recherche du terme: "${searchTerm}"`);
    
    // Créer une expression régulière insensible à la casse avec échappement des caractères spéciaux
    const escapedTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedTerm, 'i');

    // Construire la requête de recherche
    const query = {
      $or: [
        { 'details.nom': { $regex: regex } },
        { 'details.prenom': { $regex: regex } },
        { 'details.lieuNaissance': { $regex: regex } },
        { 'details.lieuDeces': { $regex: regex } },
        { 'details.lieuMariage': { $regex: regex } },
        { 'details.numeroActe': { $regex: regex } },
        { 'details.pere': { $regex: regex } },
        { 'details.mere': { $regex: regex } },
        { 'details.conjoint1': { $regex: regex } },
        { 'details.conjointe2': { $regex: regex } }
      ]
    };

    console.log(`[${requestId}] Exécution de la requête:`, JSON.stringify(query));
    
    // Exécuter la requête avec un timeout
    const results = await Promise.race([
      Acte.find(query)
        .sort({ dateEnregistrement: -1 })
        .limit(50)
        .lean()
        .exec(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('La requête a pris trop de temps')), 15000)
      )
    ]);

    const duration = Date.now() - startTime;
    console.log(`[${requestId}] Recherche terminée en ${duration}ms - ${results.length} résultats`);

    // Envoyer la réponse
    return res.status(200).json({
      success: true,
      data: results,
      meta: {
        count: results.length,
        searchTerm: searchTerm,
        duration: duration
      }
    });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[${requestId}] Erreur après ${duration}ms:`, error);
    
    // Gérer les erreurs spécifiques
    let statusCode = 500;
    let errorMessage = 'Erreur lors de la recherche des actes';
    
    if (error.message.includes('trop de temps')) {
      statusCode = 504; // Gateway Timeout
      errorMessage = 'La recherche a pris trop de temps. Veuillez essayer avec un terme plus spécifique.';
    } else if (error.name === 'MongoError') {
      errorMessage = 'Erreur de base de données. Veuillez réessayer plus tard.';
    }
    
    return res.status(statusCode).json({ 
      success: false, 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      requestId: requestId
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
    const acte = await Acte.findById(req.params.id);
    
    if (!acte) {
      return res.status(404).json({ error: 'Acte non trouvé' });
    }
    
    // Préparer les données pour le PDF dans le format attendu
    const pdfData = {
      numeroActe: acte.numeroActe,
      dateEnregistrement: acte.dateEnregistrement,
      mairie: acte.mairie,
      ...acte.details
    };

    // Générer le PDF en utilisant le service
    const pdfBuffer = await generatePdf(acte.type, pdfData);

    // Configurer les en-têtes de la réponse
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="acte-${acte.type}-${acte.numeroActe}.pdf"`,
      'Content-Length': pdfBuffer.length
    });

    // Envoyer le PDF
    res.send(pdfBuffer);

  } catch (err) {
    console.error('Erreur génération PDF:', err);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la génération du PDF',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Fonction pour générer un PDF d'acte de décès
function generateDecesPDF(doc, acte) {
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
     .text('ACTE DE DÉCÈS', 0, 130, { align: 'center' });
  
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
     .text('Nous, Officier de l\'État Civil, déclarons que:', 50, y);
  
  y += 30;
  
  // === INFORMATIONS DU DÉFUNT ===
  doc.roundedRect(50, y, doc.page.width - 100, 200, 5)
     .fillColor('#ffffff').fill()
     .strokeColor('#002689').lineWidth(2).stroke();
  
  // Titre de section avec fond coloré
  doc.rect(50, y, doc.page.width - 100, 25)
     .fillColor('#002689').fill();
  doc.fillColor('#ffffff').fontSize(12).font('Helvetica-Bold')
     .text('DÉFUNT', 0, y + 8, { align: 'center' });
  
  doc.fillColor('#000000').fontSize(11).font('Helvetica');
  y += 35;
  
  // Informations du défunt
  doc.text('Nom:', 70, y, { continued: true }).font('Helvetica-Bold').text(` ${details.nomDefunt || 'Non renseigné'}`);
  doc.font('Helvetica').text('Prénoms:', 300, y, { continued: true }).font('Helvetica-Bold').text(` ${details.prenomsDefunt || 'Non renseigné'}`);
  
  y += 20;
  doc.font('Helvetica').text('Date de naissance:', 70, y, { continued: true }).font('Helvetica-Bold')
     .text(` ${details.dateNaissanceDefunt ? new Date(details.dateNaissanceDefunt).toLocaleDateString('fr-FR') : 'Non renseignée'}`);
  doc.font('Helvetica').text('Lieu de naissance:', 300, y, { continued: true }).font('Helvetica-Bold')
     .text(` ${details.lieuNaissanceDefunt || 'Non renseigné'}`);
  
  y += 20;
  doc.font('Helvetica').text('Profession:', 70, y, { continued: true }).font('Helvetica-Bold')
     .text(` ${details.professionDefunt || 'Non renseignée'}`);
  doc.font('Helvetica').text('Domicile:', 300, y, { continued: true }).font('Helvetica-Bold')
     .text(` ${details.domicileDefunt || 'Non renseigné'}`);
  
  y += 20;
  doc.font('Helvetica').text('Date du décès:', 70, y, { continued: true }).font('Helvetica-Bold')
     .text(` ${details.dateDeces ? new Date(details.dateDeces).toLocaleDateString('fr-FR') : 'Non renseignée'}`);
  doc.font('Helvetica').text('Heure du décès:', 300, y, { continued: true }).font('Helvetica-Bold')
     .text(` ${details.heureDeces || 'Non spécifiée'}`);
  
  y += 20;
  doc.font('Helvetica').text('Lieu du décès:', 70, y, { continued: true }).font('Helvetica-Bold')
     .text(` ${details.lieuDeces || 'Non renseigné'}`);
  
  y += 20;
  doc.font('Helvetica').text('Cause du décès:', 70, y, { continued: true }).font('Helvetica-Bold')
     .text(` ${details.causeDeces || 'Non spécifiée'}`);
  
  y += 40;
  
  // === INFORMATIONS DU DÉCLARANT ===
  doc.roundedRect(50, y, doc.page.width - 100, 120, 5)
     .fillColor('#ffffff').fill()
     .strokeColor('#002689').lineWidth(2).stroke();
  
  // Titre de section avec fond coloré
  doc.rect(50, y, doc.page.width - 100, 25)
     .fillColor('#002689').fill();
  doc.fillColor('#ffffff').fontSize(12).font('Helvetica-Bold')
     .text('DÉCLARANT', 0, y + 8, { align: 'center' });
  
  doc.fillColor('#000000').fontSize(11).font('Helvetica');
  y += 35;
  
  // Informations du déclarant
  doc.text('Nom:', 70, y, { continued: true }).font('Helvetica-Bold').text(` ${details.nomDeclarant || 'Non renseigné'}`);
  doc.font('Helvetica').text('Prénoms:', 300, y, { continued: true }).font('Helvetica-Bold').text(` ${details.prenomsDeclarant || 'Non renseigné'}`);
  
  y += 20;
  doc.font('Helvetica').text('Date de naissance:', 70, y, { continued: true }).font('Helvetica-Bold')
     .text(` ${details.dateNaissanceDeclarant ? new Date(details.dateNaissanceDeclarant).toLocaleDateString('fr-FR') : 'Non renseignée'}`);
  doc.font('Helvetica').text('Lieu de naissance:', 300, y, { continued: true }).font('Helvetica-Bold')
     .text(` ${details.lieuNaissanceDeclarant || 'Non renseigné'}`);
  
  y += 20;
  doc.font('Helvetica').text('Profession:', 70, y, { continued: true }).font('Helvetica-Bold')
     .text(` ${details.professionDeclarant || 'Non renseignée'}`);
  doc.font('Helvetica').text('Domicile:', 300, y, { continued: true }).font('Helvetica-Bold')
     .text(` ${details.domicileDeclarant || 'Non renseigné'}`);
  
  y += 20;
  doc.font('Helvetica').text('Lien avec le défunt:', 70, y, { continued: true }).font('Helvetica-Bold')
     .text(` ${details.lienDeclarant || 'Non spécifié'}`);
  
  y += 40;
  
  // === SIGNATURE ===
  doc.moveTo(100, y).lineTo(500, y).strokeColor('#CCCCCC').lineWidth(0.5).stroke();
  
  // Texte de signature
  doc.font('Helvetica').fontSize(10)
     .fillColor('#333333')
     .text(`Fait à ${acte.mairie || 'N/A'}, le ${acte.dateEnregistrement ? new Date(acte.dateEnregistrement).toLocaleDateString('fr-FR') : ''}`, 300, y + 10, { align: 'right' })
     .moveDown(2)
     .font('Helvetica-Bold')
     .text('Le Maire', 400, y + 30, { align: 'right' })
     .moveDown(3)
     .font('Helvetica')
     .fontSize(9)
     .fillColor('#999999')
     .text('Cachet et signature', 400, y + 50, { align: 'right' });
}

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
  
  // Fonction pour formater les informations d'une personne
  const formatPersonne = (prefix) => {
    return `- Nom: ${details[`${prefix}Nom`] || 'Non renseigné'}
- Prénoms: ${details[`${prefix}Prenom`] || 'Non renseigné'}
- Date de naissance: ${details[`${prefix}DateNaissance`] ? new Date(details[`${prefix}DateNaissance`]).toLocaleDateString('fr-FR') : 'Non renseigné'}
- Lieu de naissance: ${details[`${prefix}LieuNaissance`] || 'Non renseigné'}
- Profession: ${details[`${prefix}Profession`] || 'Non renseigné'}
- Adresse: ${details[`${prefix}Adresse`] || 'Non renseigné'}
- Nationalité: ${details[`${prefix}Nationalite`] || 'Tchadienne'}
- Pièce d'identité: ${details[`${prefix}TypePiece`] || 'CNI'} n°${details[`${prefix}NumeroPiece`] || 'Non renseigné'}`;
  };

  const texte = `L'an ${new Date().getFullYear()}, le ${dateEnregistrement}, par devant nous, Officier de l'État Civil de ${acte.mairie}, ont été unis par les liens du mariage :

ÉPOUX :
${formatPersonne('conjoint1')}

ÉPOUSE :
${formatPersonne('conjoint2')}

Témoin 1: ${details.temoin1Nom || 'Non renseigné'}
Témoin 2: ${details.temoin2Nom || 'Non renseigné'}

Le mariage a été célébré le ${dateMariage}
à ${details.lieuMariage || 'Non renseigné'}

Régime matrimonial: ${details.regimeMatrimonial || 'Communauté réduite aux acquêts'}
Contrat de mariage: ${details.contratMariage || 'Non'}

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


// ====================================
// ROUTE POUR UN ACTE SPÉCIFIQUE PAR ID
// ====================================
router.get('/:id', authenticate, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        error: 'ID invalide'
      });
    }
    
    const acte = await Acte.findById(req.params.id).lean();
    
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
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'acte:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération de l\'acte',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Récupérer les actes récents
router.get('/recent', authenticate, async (req, res) => {
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
router.put('/:id', validateActeInput, authenticate, async (req, res) => {
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

// Télécharger un PDF d'acte de décès
router.get('/deces/:id/pdf', decesController.generateDecesPdf);

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