const Divorce = require('../models/Divorce');
const { validationResult } = require('express-validator');
const fs = require('fs');
const path = require('path');

// Créer un nouvel acte de divorce
exports.createDivorce = async (req, res) => {
  try {
    // Validation des données
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Création du nouvel acte
    const newDivorce = new Divorce({
      ...req.body,
      createdBy: req.user.id,
      dateEtablissement: new Date()
    });

    // Sauvegarde dans la base de données
    const savedDivorce = await newDivorce.save();
    
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
    }

    // Pagination
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { dateEtablissement: -1 },
      populate: 'createdBy',
      select: '-__v'
    };

    const divorces = await Divorce.paginate(query, options);

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
    const divorce = await Divorce.findById(id);

    if (!divorce) {
      return res.status(404).json({
        success: false,
        message: 'Acte de divorce non trouvé'
      });
    }

    // Ici, vous devrez implémenter la logique de génération du PDF
    // en utilisant une bibliothèque comme pdfkit ou puppeteer
    // Pour l'instant, on renvoie simplement les données
    
    res.status(200).json({
      success: true,
      message: 'PDF généré avec succès',
      data: divorce // À remplacer par le flux PDF réel
    });
  } catch (error) {
    console.error('Erreur lors de la génération du PDF:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la génération du PDF',
      error: error.message
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
