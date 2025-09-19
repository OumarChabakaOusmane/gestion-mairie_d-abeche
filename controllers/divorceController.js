const Divorce = require('../models/Divorce');
const { validationResult } = require('express-validator');
const fs = require('fs');
const path = require('path');

// Afficher le formulaire de création d'un acte de divorce
exports.showCreateForm = (req, res) => {
  try {
    // Rendu du formulaire avec le token CSRF
    res.render('divorce', { 
      title: 'Nouvel acte de divorce',
      csrfToken: res.locals.csrfToken
    });
  } catch (error) {
    console.error('Erreur lors de l\'affichage du formulaire de divorce:', error);
    res.status(500).send('Erreur lors du chargement du formulaire');
  }
};

// Créer un nouvel acte de divorce
exports.createDivorce = async (req, res) => {
  try {
    console.log('Début de la création d\'un acte de divorce');
    console.log('Données reçues:', JSON.stringify(req.body, null, 2));
    
    // Validation des données
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.error('Erreurs de validation:', errors.array());
      return res.status(400).json({ 
        success: false,
        message: 'Erreurs de validation',
        errors: errors.array() 
      });
    }

    // Création du nouvel acte
    const newDivorce = new Divorce({
      ...req.body,
      createdBy: req.user.id,
      dateEtablissement: new Date(),
      statut: 'validé' // Ajout d'un statut par défaut
    });

    console.log('Nouvel acte créé:', newDivorce);

    // Sauvegarde dans la base de données
    const savedDivorce = await newDivorce.save();
    console.log('Acte enregistré avec succès:', savedDivorce);
    
    res.status(201).json({
      success: true,
      message: 'Acte de divorce créé avec succès',
      data: savedDivorce
    });
  } catch (error) {
    console.error('Erreur lors de la création de l\'acte de divorce:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de l\'acte de divorce',
      error: error.message
    });
  }
};

// Récupérer tous les actes de divorce
exports.getAllDivorces = async (req, res) => {
  try {
    console.log('Récupération des actes de divorce avec les paramètres:', req.query);
    
    const { page = 1, limit = 10, search = '' } = req.query;
    const query = {};

    // Filtre de recherche
    if (search) {
      query.$or = [
        { numeroActe: { $regex: search, $options: 'i' } },
        { 'epoux.nom': { $regex: search, $options: 'i' } },
        { 'epoux.prenoms': { $regex: search, $options: 'i' } },
        { 'epouse.nom': { $regex: search, $options: 'i' } },
        { 'epouse.prenoms': { $regex: search, $options: 'i' } }
      ];
      console.log('Requête de recherche:', JSON.stringify(query, null, 2));
    }

    // Pagination
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { dateEtablissement: -1 },
      populate: {
        path: 'createdBy',
        select: 'nom prenoms email'
      },
      select: '-__v'
    };

    console.log('Options de pagination:', JSON.stringify(options, null, 2));
    
    const divorces = await Divorce.paginate(query, options);
    console.log(`Total de ${divorces.totalDocs} actes trouvés, page ${divorces.page} sur ${divorces.totalPages}`);

    res.status(200).json({
      success: true,
      data: divorces
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des actes de divorce:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des actes de divorce',
      error: error.message
    });
  }
};

// Récupérer un acte de divorce par son ID
exports.getDivorceById = async (req, res) => {
  try {
    const divorce = await Divorce.findById(req.params.id)
      .populate('createdBy', 'name email')
      .select('-__v');

    if (!divorce) {
      return res.status(404).json({
        success: false,
        message: 'Acte de divorce non trouvé'
      });
    }

    res.status(200).json({
      success: true,
      data: divorce
    });
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'acte de divorce:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de l\'acte de divorce',
      error: error.message
    });
  }
};

// Mettre à jour un acte de divorce
exports.updateDivorce = async (req, res) => {
  try {
    // Validation des données
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const updates = req.body;

    // Vérifier si l'acte existe
    const existingDivorce = await Divorce.findById(id);
    if (!existingDivorce) {
      return res.status(404).json({
        success: false,
        message: 'Acte de divorce non trouvé'
      });
    }

    // Mise à jour de l'acte
    const updatedDivorce = await Divorce.findByIdAndUpdate(
      id,
      { ...updates, updatedAt: new Date() },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Acte de divorce mis à jour avec succès',
      data: updatedDivorce
    });
  } catch (error) {
    console.error('Erreur lors de la mise à jour de l\'acte de divorce:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour de l\'acte de divorce',
      error: error.message
    });
  }
};

// Supprimer un acte de divorce
exports.deleteDivorce = async (req, res) => {
  try {
    const { id } = req.params;

    // Vérifier si l'acte existe
    const divorce = await Divorce.findById(id);
    if (!divorce) {
      return res.status(404).json({
        success: false,
        message: 'Acte de divorce non trouvé'
      });
    }

    // Supprimer les fichiers associés si nécessaire
    if (divorce.documentsAnnexes && divorce.documentsAnnexes.length > 0) {
      divorce.documentsAnnexes.forEach(file => {
        const filePath = path.join(__dirname, '../uploads', file);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });
    }

    // Supprimer l'acte de la base de données
    await Divorce.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Acte de divorce supprimé avec succès'
    });
  } catch (error) {
    console.error('Erreur lors de la suppression de l\'acte de divorce:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression de l\'acte de divorce',
      error: error.message
    });
  }
};

// Générer un PDF pour un acte de divorce
exports.generateDivorcePdf = async (req, res) => {
  try {
    const { id } = req.params;
    const divorce = await Divorce.findById(id)
      .populate('createdBy', 'nom prenoms')
      .lean();

    if (!divorce) {
      return res.status(404).json({
        success: false,
        message: 'Acte de divorce non trouvé'
      });
    }

    // Préparer les données pour le PDF
    const pdfData = {
      // En-tête
      titre: 'ACTE DE DIVORCE',
      numeroActe: divorce.numeroActe,
      dateEtablissement: divorce.dateEtablissement.toLocaleDateString('fr-FR'),
      officierEtatCivil: divorce.officierEtatCivil,
      lieuEtablissement: divorce.lieuEtablissement,
      
      // Informations sur le mariage
      dateMariage: divorce.dateMariage.toLocaleDateString('fr-FR'),
      lieuMariage: divorce.lieuMariage,
      regimeMatrimonial: divorce.regimeMatrimonial,
      
      // Informations sur le divorce
      dateDivorce: divorce.dateDivorce.toLocaleDateString('fr-FR'),
      typeDivorce: divorce.typeDivorce,
      motifs: divorce.motifs,
      
      // Informations sur les époux
      epoux: {
        ...divorce.epoux,
        dateNaissance: new Date(divorce.epoux.dateNaissance).toLocaleDateString('fr-FR'),
        dateMariage: divorce.epoux.dateMariage ? new Date(divorce.epoux.dateMariage).toLocaleDateString('fr-FR') : 'Non spécifiée'
      },
      
      epouse: {
        ...divorce.epouse,
        dateNaissance: new Date(divorce.epouse.dateNaissance).toLocaleDateString('fr-FR'),
        dateMariage: divorce.epouse.dateMariage ? new Date(divorce.epouse.dateMariage).toLocaleDateString('fr-FR') : 'Non spécifiée'
      },
      
      // Garde des enfants
      gardeEnfants: divorce.gardeEnfants?.map(enfant => ({
        ...enfant,
        dateNaissance: new Date(enfant.dateNaissance).toLocaleDateString('fr-FR')
      })) || [],
      
      // Métadonnées
      statut: divorce.statut,
      creePar: divorce.createdBy ? `${divorce.createdBy.prenoms} ${divorce.createdBy.nom}` : 'Non spécifié',
      dateCreation: new Date(divorce.createdAt).toLocaleDateString('fr-FR')
    };

    // Utiliser le service de génération de PDF
    const pdfBuffer = await generatePdf('divorce', pdfData);
    
    // Envoyer le PDF en réponse
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="acte-divorce-${divorce.numeroActe}.pdf"`,
      'Content-Length': pdfBuffer.length
    });
    
    res.send(pdfBuffer);
    
  } catch (error) {
    console.error('Erreur lors de la génération du PDF:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la génération du PDF',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Statistiques sur les divorces
exports.getDivorceStats = async (req, res) => {
  try {
    const stats = await Divorce.aggregate([
      {
        $group: {
          _id: {
            year: { $year: '$dateDivorce' },
            month: { $month: '$dateDivorce' }
          },
          count: { $sum: 1 },
          types: { $push: '$typeDivorce' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques',
      error: error.message
    });
  }
};
