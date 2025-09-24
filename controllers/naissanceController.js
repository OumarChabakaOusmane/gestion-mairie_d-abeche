const { validationResult } = require('express-validator');
const { logger } = require('../config/logger');
const Naissance = require('../models/Naissance');
const { generateNaissancePdf } = require('../services/pdfServiceNew');
const Acte = require('../models/Acte');
const { format } = require('date-fns');
const { fr } = require('date-fns/locale');

// Définition du contrôleur
const naissanceController = {};

/**
 * Génère un PDF pour un acte de naissance
 * @route GET /api/actes/naissances/:id/pdf
 * @access Privé
 */
naissanceController.generateNaissancePdf = async (req, res) => {
  const startTime = Date.now();
  const { id } = req.params;
  
  // Fonction utilitaire pour formater les dates
  const formatDate = (date) => {
    if (!date) return 'Non spécifiée';
    try {
      return format(new Date(date), 'dd MMMM yyyy', { locale: fr });
    } catch (e) {
      return date;
    }
  };

  try {
    // Utiliser le logger passé dans la requête ou le logger par défaut
    const log = req.log || ((message, data) => 
      console.log(`[${new Date().toISOString()}] ${message}`, data));
    
    log(`Début génération PDF pour l'acte de naissance: ${id}`);
    
    // Vérifier si l'ID est valide
    if (!require('mongoose').Types.ObjectId.isValid(id)) {
      const errorMsg = `ID d'acte invalide: ${id}`;
      log(errorMsg);
      return res.status(400).json({ 
        success: false,
        message: errorMsg
      });
    }

    // Récupérer l'acte de naissance avec les données associées
    log('Recherche de l\'acte dans la base de données...');
    const naissance = await Naissance.findById(id)
      .populate('enfant')
      .populate('pere')
      .populate('mere')
      .populate('declarant')
      .populate('mairie', 'nom ville')
      .lean()
      .maxTimeMS(10000); // Timeout de 10 secondes

    if (!naissance) {
      // Fallback: tenter avec la collection Acte (type naissance)
      log('Acte Naissance introuvable dans collection Naissance. Fallback vers Acte...');
      const acte = await Acte.findById(id).lean();
      if (!acte || acte.type !== 'naissance') {
        const errorMsg = `Acte de naissance non trouvé: ${id}`;
        log(errorMsg);
        return res.status(404).json({ 
          success: false,
          message: errorMsg
        });
      }

      // Adapter les données depuis Acte.details vers le format attendu par generateNaissancePdf
      const d = acte.details || {};
      const safe = (v) => (v === undefined || v === null ? '' : v);
      const pdfDataFromActe = {
        numeroActe: acte.numeroActe || 'En attente',
        dateEtablissement: formatDate(acte.dateEnregistrement),
        mairie: safe(acte.mairie) || 'Mairie non spécifiée',
        ville: '',
        nomEnfant: safe(d.nom),
        prenomsEnfant: safe(d.prenom),
        dateNaissance: formatDate(d.dateNaissance),
        heureNaissance: safe(d.heureNaissance),
        lieuNaissance: safe(d.lieuNaissance),
        sexe: safe(d.sexe),
        nomPere: safe(d.pere) || safe(d.nomPere),
        prenomsPere: safe(d.prenomPere),
        dateNaissancePere: formatDate(d.dateNaissancePere),
        lieuNaissancePere: safe(d.lieuNaissancePere),
        professionPere: safe(d.professionPere),
        nomMere: safe(d.mere) || safe(d.nomMere),
        prenomsMere: safe(d.prenomMere),
        dateNaissanceMere: formatDate(d.dateNaissanceMere),
        lieuNaissanceMere: safe(d.lieuNaissanceMere),
        professionMere: safe(d.professionMere),
        nomDeclarant: safe(d.nomDeclarant),
        prenomsDeclarant: safe(d.prenomsDeclarant),
        lienDeclarant: safe(d.lienDeclarant),
        adresseDeclarant: safe(d.adresseDeclarant),
        observations: safe(d.observations),
        createdAt: formatDate(acte.dateEnregistrement),
        createdBy: acte.createdBy ? (acte.createdBy.name || '') : 'Utilisateur inconnu'
      };

      log('Fallback Acte -> génération PDF via pdfServiceNew');
      const pdfBuffer = await generateNaissancePdf(pdfDataFromActe);

      if (!pdfBuffer || !(pdfBuffer instanceof Buffer)) {
        return res.status(500).json({ success: false, message: 'Erreur lors de la génération du PDF' });
      }

      const safeFileName = `acte-naissance-${(pdfDataFromActe.numeroActe || 'sans-numero')}
        `.toString().toLowerCase().replace(/[^a-z0-9-]/g, '-') + `-${Date.now()}.pdf`;

      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${safeFileName}"`,
        'Content-Length': pdfBuffer.length,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Generated-At': new Date().toISOString(),
        'X-Acte-ID': id
      });

      return res.send(pdfBuffer);
    }

    log('Acte de naissance trouvé', {
      _id: naissance._id,
      numeroActe: naissance.numeroActe,
      dateEtablissement: naissance.dateEtablissement
    });

    // Vérifier que les entités requises existent
    const requiredEntities = ['enfant', 'pere', 'mere', 'declarant'];
    const missingEntities = requiredEntities.filter(entity => !naissance[entity]);
    
    if (missingEntities.length > 0) {
      const errorMsg = `Données manquantes pour la génération du PDF: ${missingEntities.join(', ')}`;
      log(errorMsg);
      return res.status(400).json({
        success: false,
        message: errorMsg,
        missingEntities
      });
    }

    // Vérifier si on a un objet details (structure plate) ou des références
    const hasDetails = naissance.details && typeof naissance.details === 'object';
    
    // Préparer les données pour le PDF dans le format attendu
    const pdfData = {
      // Informations administratives
      numeroActe: naissance.numeroActe || 'En attente',
      dateEtablissement: formatDate(naissance.dateEtablissement || naissance.dateEnregistrement) || 'Non spécifiée',
      mairie: naissance.mairie || 'Mairie non spécifiée',
      ville: naissance.mairie || '',
      
      // Données de l'enfant
      nomEnfant: hasDetails ? naissance.details.nom : (naissance.enfant?.nom || 'Non renseigné'),
      prenomsEnfant: hasDetails ? naissance.details.prenom : (naissance.enfant?.prenom || 'Non renseigné'),
      dateNaissance: formatDate(hasDetails ? naissance.details.dateNaissance : (naissance.enfant?.dateNaissance)),
      heureNaissance: hasDetails ? naissance.details.heureNaissance : (naissance.enfant?.heureNaissance || 'Non spécifiée'),
      lieuNaissance: hasDetails ? naissance.details.lieuNaissance : (naissance.enfant?.lieuNaissance || 'Non renseigné'),
      sexe: hasDetails ? naissance.details.sexe : (naissance.enfant?.sexe || 'Non spécifié'),
      
      // Données du père
      nomPere: hasDetails ? naissance.details.pere : (naissance.pere?.nom || 'Non renseigné'),
      prenomsPere: hasDetails ? naissance.details.prenomPere : (naissance.pere?.prenom || 'Non renseigné'),
      dateNaissancePere: formatDate(hasDetails ? naissance.details.dateNaissancePere : naissance.pere?.dateNaissance),
      lieuNaissancePere: hasDetails ? naissance.details.lieuNaissancePere : (naissance.pere?.lieuNaissance || 'Non renseigné'),
      professionPere: hasDetails ? naissance.details.professionPere : (naissance.pere?.profession || 'Non renseignée'),
      nationalitePere: hasDetails ? naissance.details.nationalitePere : (naissance.pere?.nationalite || naissance.nationalitePere || ''),
      domicilePere: hasDetails ? naissance.details.domicilePere : (naissance.pere?.domicile || naissance.domicilePere || ''),
      
      // Données de la mère
      nomMere: hasDetails ? naissance.details.mere : (naissance.mere?.nom || 'Non renseigné'),
      prenomsMere: hasDetails ? naissance.details.prenomMere : (naissance.mere?.prenom || 'Non renseigné'),
      dateNaissanceMere: formatDate(hasDetails ? naissance.details.dateNaissanceMere : naissance.mere?.dateNaissance),
      lieuNaissanceMere: hasDetails ? naissance.details.lieuNaissanceMere : (naissance.mere?.lieuNaissance || 'Non renseigné'),
      professionMere: hasDetails ? naissance.details.professionMere : (naissance.mere?.profession || 'Non renseignée'),
      nationaliteMere: hasDetails ? naissance.details.nationaliteMere : (naissance.mere?.nationalite || naissance.nationaliteMere || ''),
      nomJeuneFilleMere: hasDetails ? naissance.details.nomJeuneFilleMere : (naissance.mere?.nomJeuneFille || naissance.nomJeuneFilleMere || ''),
      domicileMere: hasDetails ? naissance.details.domicileMere : (naissance.mere?.domicile || naissance.domicileMere || ''),
      
      // Informations du déclarant (structure imbriquée attendue par le service PDF)
      declarant: (function() {
        const d = {};
        const nom = hasDetails ? naissance.details.nomDeclarant : (naissance.declarant?.nom || naissance.nomDeclarant);
        const prenoms = hasDetails ? naissance.details.prenomsDeclarant : (naissance.declarant?.prenom || naissance.prenomsDeclarant);
        const qualite = hasDetails ? naissance.details.lienDeclarant : (naissance.lienDeclarant || naissance.declarant?.qualite);
        const domicile = hasDetails ? (naissance.details.adresseDeclarant || naissance.details.adresse) : (naissance.adresseDeclarant || naissance.declarant?.domicile);
        if (nom) d.nom = nom;
        if (prenoms) d.prenoms = prenoms;
        if (qualite) d.qualite = qualite;
        if (domicile) d.domicile = domicile;
        return Object.keys(d).length ? d : undefined;
      })(),
      
      // Observations
      observations: naissance.observations || 'Aucune observation',
      
      // Métadonnées
      createdAt: formatDate(naissance.createdAt || naissance.dateEnregistrement),
      createdBy: naissance.createdBy ? 
        (typeof naissance.createdBy === 'object' ? 
          `${naissance.createdBy.prenom || ''} ${naissance.createdBy.nom || ''}`.trim() : 
          String(naissance.createdBy)) : 
        'Utilisateur inconnu'
    };

    log('Données préparées pour la génération du PDF');
    
    // Générer le PDF
    try {
      log('Début de la génération du PDF...');
      const pdfBuffer = await generateNaissancePdf(pdfData);
      
      if (!pdfBuffer || !(pdfBuffer instanceof Buffer)) {
        const errorMsg = 'Le buffer du PDF est invalide';
        log(errorMsg, { 
          type: typeof pdfBuffer, 
          isBuffer: Buffer.isBuffer(pdfBuffer)
        });
        return res.status(500).json({
          success: false,
          message: errorMsg,
          requestId: req.id
        });
      }
      
      // Créer un nom de fichier sécurisé
      const safeFileName = `acte-naissance-${(pdfData.numeroActe || 'sans-numero')
        .toString()
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')}-${Date.now()}.pdf`;
      
      log('PDF généré avec succès', { 
        bufferSize: pdfBuffer.length,
        fileName: safeFileName
      });
      
      // Configurer les en-têtes de la réponse
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${safeFileName}"`,
        'Content-Length': pdfBuffer.length,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Generated-At': new Date().toISOString(),
        'X-Acte-ID': id
      });
      
      // Envoyer le PDF
      return res.send(pdfBuffer);
      
    } catch (error) {
      log('Erreur lors de la génération du PDF', {
        error: error.message,
        stack: error.stack
      });
      
      // Gestion spécifique des erreurs de police
      if (error.message.includes('font') || (error.stack && error.stack.includes('font'))) {
        log('ERREUR DE POLICE DÉTECTÉE - Vérifiez les polices système', {
          error: error.message
        });
      }
      
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la génération du PDF',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
        requestId: req.id,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    const errorId = Math.random().toString(36).substr(2, 9);
    const errorDetails = {
      errorId,
      timestamp: new Date().toISOString(),
      message: error.message,
      name: error.name,
      stack: error.stack,
      acteId: id,
      params: req.params,
      query: req.query,
      duration: Date.now() - startTime
    };
    
    // Utiliser le logger de la requête s'il existe, sinon utiliser le logger par défaut
    const errorLog = req.log || logger.error;
    errorLog(`[${errorId}] Erreur lors de la génération du PDF`, errorDetails);
    
    res.status(500).json({
      success: false,
      message: 'Une erreur est survenue lors de la génération du PDF',
      errorId,
      timestamp: errorDetails.timestamp
    });
  }
};

module.exports = naissanceController;
