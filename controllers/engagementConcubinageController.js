const EngagementConcubinage = require('../models/EngagementConcubinage');
const { generatePdf } = require('../services/pdfService');
const { logger } = require('../config/logger');

/**
 * Créer un nouvel engagement de concubinage
 */
exports.createEngagement = async (req, res) => {
    try {
        const engagementData = req.body;
        
        // Vérifier si un engagement similaire existe déjà
        const existingEngagement = await EngagementConcubinage.findOne({
            'concubin1.numeroPieceIdentite': engagementData.concubin1.numeroPieceIdentite,
            'concubin2.numeroPieceIdentite': engagementData.concubin2.numeroPieceIdentite,
            statut: 'actif'
        });

        if (existingEngagement) {
            return res.status(400).json({
                success: false,
                message: 'Un engagement de concubinage actif existe déjà entre ces deux personnes'
            });
        }

        const engagement = new EngagementConcubinage({
            ...engagementData,
            createdBy: req.user.id
        });
        
        await engagement.save();
        
        logger.info('Engagement de concubinage créé avec succès', { 
            engagementId: engagement._id, 
            userId: req.user.id 
        });
        
        res.status(201).json({
            success: true,
            message: 'Engagement de concubinage créé avec succès',
            data: engagement
        });
    } catch (error) {
        logger.error('Erreur lors de la création de l\'engagement de concubinage', {
            error: error.message,
            stack: error.stack,
            userId: req.user?.id
        });
        
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la création de l\'engagement de concubinage',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur serveur'
        });
    }
};

/**
 * Récupérer un engagement de concubinage par son ID
 */
exports.getEngagementById = async (req, res) => {
    try {
        const engagement = await EngagementConcubinage.findById(req.params.id)
            .populate('createdBy', 'nom prenom')
            .populate('updatedBy', 'nom prenom')
            .lean();
            
        if (!engagement) {
            return res.status(404).json({
                success: false,
                message: 'Engagement de concubinage non trouvé'
            });
        }
        
        res.json({
            success: true,
            data: engagement
        });
    } catch (error) {
        logger.error('Erreur lors de la récupération de l\'engagement de concubinage', {
            error: error.message,
            engagementId: req.params.id,
            userId: req.user?.id
        });
        
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération de l\'engagement de concubinage',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur serveur'
        });
    }
};

/**
 * Mettre à jour un engagement de concubinage
 */
exports.updateEngagement = async (req, res) => {
    try {
        const updates = req.body;
        
        // Ne pas permettre de modifier le statut directement via cette route
        if (updates.statut || updates.dateFin || updates.motifFin) {
            return res.status(400).json({
                success: false,
                message: 'Utilisez les routes spécifiques pour modifier le statut de l\'engagement'
            });
        }
        
        const engagement = await EngagementConcubinage.findByIdAndUpdate(
            req.params.id,
            { $set: updates },
            { new: true, runValidators: true }
        );
        
        if (!engagement) {
            return res.status(404).json({
                success: false,
                message: 'Engagement de concubinage non trouvé'
            });
        }
        
        logger.info('Engagement de concubinage mis à jour avec succès', { 
            engagementId: engagement._id, 
            userId: req.user.id 
        });
        
        res.json({
            success: true,
            message: 'Engagement de concubinage mis à jour avec succès',
            data: engagement
        });
    } catch (error) {
        logger.error('Erreur lors de la mise à jour de l\'engagement de concubinage', {
            error: error.message,
            engagementId: req.params.id,
            userId: req.user?.id
        });
        
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la mise à jour de l\'engagement de concubinage',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur serveur'
        });
    }
};

/**
 * Rompre un engagement de concubinage
 */
exports.rompreEngagement = async (req, res) => {
    try {
        const { motif } = req.body;
        
        if (!motif) {
            return res.status(400).json({
                success: false,
                message: 'Le motif de la rupture est requis'
            });
        }
        
        const engagement = await EngagementConcubinage.findById(req.params.id);
        
        if (!engagement) {
            return res.status(404).json({
                success: false,
                message: 'Engagement de concubinage non trouvé'
            });
        }
        
        if (engagement.statut !== 'actif') {
            return res.status(400).json({
                success: false,
                message: `L'engagement n'est pas actif (statut actuel: ${engagement.statut})`
            });
        }
        
        engagement.statut = 'rompu';
        engagement.dateFin = new Date();
        engagement.motifFin = motif;
        engagement.updatedBy = req.user.id;
        
        await engagement.save();
        
        logger.info('Engagement de concubinage rompu avec succès', { 
            engagementId: engagement._id, 
            userId: req.user.id 
        });
        
        res.json({
            success: true,
            message: 'Engagement de concubinage rompu avec succès',
            data: engagement
        });
    } catch (error) {
        logger.error('Erreur lors de la rupture de l\'engagement de concubinage', {
            error: error.message,
            engagementId: req.params.id,
            userId: req.user?.id
        });
        
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la rupture de l\'engagement de concubinage',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur serveur'
        });
    }
};

/**
 * Convertir un engagement en mariage
 */
exports.convertirEnMariage = async (req, res) => {
    try {
        const engagement = await EngagementConcubinage.findById(req.params.id);
        
        if (!engagement) {
            return res.status(404).json({
                success: false,
                message: 'Engagement de concubinage non trouvé'
            });
        }
        
        if (engagement.statut !== 'actif') {
            return res.status(400).json({
                success: false,
                message: `L'engagement n'est pas actif (statut actuel: ${engagement.statut})`
            });
        }
        
        engagement.statut = 'converti_en_mariage';
        engagement.dateFin = new Date();
        engagement.updatedBy = req.user.id;
        
        await engagement.save();
        
        // Ici, vous pourriez appeler le service de création d'un acte de mariage
        // const mariage = await mariageService.creerDepuisEngagement(engagement, req.user.id);
        
        logger.info('Engagement de concubinage converti en mariage avec succès', { 
            engagementId: engagement._id, 
            userId: req.user.id 
        });
        
        res.json({
            success: true,
            message: 'Engagement de concubinage converti en mariage avec succès',
            data: {
                engagement,
                // mariageId: mariage?._id
            }
        });
    } catch (error) {
        logger.error('Erreur lors de la conversion de l\'engagement en mariage', {
            error: error.message,
            engagementId: req.params.id,
            userId: req.user?.id
        });
        
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la conversion de l\'engagement en mariage',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur serveur'
        });
    }
};

/**
 * Supprimer un engagement de concubinage
 */
exports.deleteEngagement = async (req, res) => {
    try {
        const engagement = await EngagementConcubinage.findByIdAndDelete(req.params.id);
        
        if (!engagement) {
            return res.status(404).json({
                success: false,
                message: 'Engagement de concubinage non trouvé'
            });
        }
        
        logger.info('Engagement de concubinage supprimé avec succès', { 
            engagementId: req.params.id, 
            userId: req.user.id 
        });
        
        res.json({
            success: true,
            message: 'Engagement de concubinage supprimé avec succès'
        });
    } catch (error) {
        logger.error('Erreur lors de la suppression de l\'engagement de concubinage', {
            error: error.message,
            engagementId: req.params.id,
            userId: req.user?.id
        });
        
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la suppression de l\'engagement de concubinage',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur serveur'
        });
    }
};

/**
 * Lister les engagements de concubinage avec pagination
 */
exports.listEngagements = async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '', statut } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        const query = {};
        
        // Filtre par statut si fourni
        if (statut) {
            query.statut = statut;
        }
        
        // Recherche par nom/prénom des concubins ou numéro d'acte
        if (search) {
            query.$or = [
                { 'concubin1.nom': { $regex: search, $options: 'i' } },
                { 'concubin1.prenoms': { $regex: search, $options: 'i' } },
                { 'concubin2.nom': { $regex: search, $options: 'i' } },
                { 'concubin2.prenoms': { $regex: search, $options: 'i' } },
                { numeroActe: { $regex: search, $options: 'i' } }
            ];
        }
        
        const [engagements, total] = await Promise.all([
            EngagementConcubinage.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            EngagementConcubinage.countDocuments(query)
        ]);
        
        res.json({
            success: true,
            data: engagements,
            pagination: {
                total,
                page: parseInt(page),
                totalPages: Math.ceil(total / parseInt(limit)),
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        logger.error('Erreur lors de la récupération de la liste des engagements', {
            error: error.message,
            userId: req.user?.id
        });
        
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération de la liste des engagements',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur serveur'
        });
    }
};

/**
 * Obtenir des statistiques sur les engagements de concubinage
 */
exports.getEngagementStats = async (req, res) => {
    try {
        const total = await EngagementConcubinage.countDocuments();
        const byStatus = await EngagementConcubinage.aggregate([
            { $group: { _id: '$statut', count: { $sum: 1 } } }
        ]);
        
        res.json({
            success: true,
            data: { total, byStatus }
        });
    } catch (error) {
        logger.error('Erreur lors de la récupération des statistiques:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des statistiques',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur serveur'
        });
    }
};

/**
 * Générer un PDF pour un engagement de concubinage
 */
exports.generateEngagementPdf = async (req, res) => {
    try {
        const engagement = await EngagementConcubinage.findById(req.params.id).lean();
        
        if (!engagement) {
            return res.status(404).json({
                success: false,
                message: 'Engagement de concubinage non trouvé'
            });
        }
        
        const pdfBuffer = await generatePdf('engagement-concubinage', engagement);
        
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="engagement-concubinage-${engagement.numeroActe}.pdf"`,
            'Content-Length': pdfBuffer.length
        });
        
        res.send(pdfBuffer);
        
        logger.info('PDF généré avec succès pour l\'engagement de concubinage', { 
            engagementId: engagement._id,
            userId: req.user?.id 
        });
    } catch (error) {
        logger.error('Erreur lors de la génération du PDF', {
            error: error.message,
            engagementId: req.params.id,
            userId: req.user?.id
        });
        
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la génération du PDF',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur serveur'
        });
    }
};
