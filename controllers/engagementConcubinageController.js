const mongoose = require('mongoose');
const EngagementConcubinage = require('../models/EngagementConcubinage');
const { generatePdf } = require('../services/pdfService');
const logger = require('../config/logger');

/**
 * Termine un engagement de concubinage
 * @route POST /api/engagements/:id/terminer
 * @access Privé (Admin, Officier d'état civil)
 */
exports.terminateEngagement = async (req, res) => {
    try {
        const { id } = req.params;
        const { motif, dateFin } = req.body;
        
        // Vérifier que l'engagement existe
        const engagement = await EngagementConcubinage.findById(id);
        if (!engagement) {
            return res.status(404).json({
                success: false,
                message: 'Engagement non trouvé'
            });
        }
        
        // Vérifier que l'engagement n'est pas déjà terminé
        if (engagement.statut === 'termine') {
            return res.status(400).json({
                success: false,
                message: 'Cet engagement est déjà terminé'
            });
        }
        
        // Mettre à jour l'engagement
        engagement.statut = 'termine';
        engagement.dateFin = dateFin ? new Date(dateFin) : new Date();
        engagement.motifRupture = motif;
        engagement.updatedAt = new Date();
        engagement.updatedBy = req.user.id;
        
        await engagement.save();
        
        res.json({
            success: true,
            message: 'Engagement terminé avec succès',
            data: engagement
        });
        
    } catch (error) {
        logger.error('Erreur lors de la terminaison de l\'engagement:', {
            error: error.message,
            stack: error.stack,
            requestId: req.id
        });
        
        res.status(500).json({
            success: false,
            message: 'Une erreur est survenue lors de la terminaison de l\'engagement',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Supprime un engagement de concubinage
 * @route DELETE /api/engagements/:id
 * @access Privé (Admin, Officier d'état civil)
 */
exports.deleteEngagement = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Vérifier que l'engagement existe
        const engagement = await EngagementConcubinage.findById(id);
        if (!engagement) {
            return res.status(404).json({
                success: false,
                message: 'Engagement non trouvé'
            });
        }
        
        // Supprimer l'engagement
        await engagement.remove();
        
        res.json({
            success: true,
            message: 'Engagement supprimé avec succès'
        });
        
    } catch (error) {
        logger.error('Erreur lors de la suppression de l\'engagement:', {
            error: error.message,
            stack: error.stack,
            requestId: req.id
        });
        
        res.status(500).json({
            success: false,
            message: 'Une erreur est survenue lors de la suppression de l\'engagement',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Récupère un engagement par son ID
 * @route GET /api/engagements/:id
 * @access Privé
 */
exports.getEngagementById = async (req, res) => {
    try {
        const engagement = await EngagementConcubinage.findById(req.params.id)
            .populate('concubin1 concubin2 temoins.createdBy', 'nom prenoms')
            .lean();
            
        if (!engagement) {
            return res.status(404).json({
                success: false,
                message: 'Engagement non trouvé'
            });
        }
        
        res.json({
            success: true,
            data: engagement
        });
        
    } catch (error) {
        logger.error('Erreur lors de la récupération de l\'engagement:', {
            error: error.message,
            stack: error.stack,
            requestId: req.id
        });
        
        res.status(500).json({
            success: false,
            message: 'Une erreur est survenue lors de la récupération de l\'engagement',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Met à jour un engagement existant
 * @route PUT /api/engagements/:id
 * @access Privé (Admin, Officier d'état civil)
 */
exports.updateEngagement = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        
        // Vérifier que l'engagement existe
        const engagement = await EngagementConcubinage.findById(id);
        if (!engagement) {
            return res.status(404).json({
                success: false,
                message: 'Engagement non trouvé'
            });
        }
        
        // Mettre à jour les champs
        Object.keys(updates).forEach(key => {
            if (key !== '_id' && key !== '__v') {
                engagement[key] = updates[key];
            }
        });
        
        // Marquer les champs modifiés
        engagement.updatedAt = new Date();
        engagement.updatedBy = req.user.id;
        
        // Sauvegarder les modifications
        const updatedEngagement = await engagement.save();
        
        res.json({
            success: true,
            message: 'Engagement mis à jour avec succès',
            data: updatedEngagement
        });
        
    } catch (error) {
        logger.error('Erreur lors de la mise à jour de l\'engagement:', {
            error: error.message,
            stack: error.stack,
            requestId: req.id
        });
        
        res.status(500).json({
            success: false,
            message: 'Une erreur est survenue lors de la mise à jour de l\'engagement',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Récupère la liste des engagements de concubinage avec pagination
 * @route GET /api/engagements
 * @access Privé
 */
exports.listEngagements = async (req, res) => {
    try {
        const { page = 1, limit = 10, sort = '-dateEtablissement', ...filters } = req.query;
        
        // Construction de la requête avec les filtres
        const query = {};
        
        // Filtrage par statut si fourni
        if (filters.statut) {
            query.statut = filters.statut;
        }
        
        // Filtrage par date si fourni
        if (filters.dateDebut) {
            query.dateEtablissement = {
                ...query.dateEtablissement,
                $gte: new Date(filters.dateDebut)
            };
        }
        
        if (filters.dateFin) {
            query.dateEtablissement = {
                ...query.dateEtablissement,
                $lte: new Date(filters.dateFin)
            };
        }
        
        // Exécution de la requête avec pagination
        const engagements = await EngagementConcubinage.find(query)
            .sort(sort)
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit))
            .populate('concubin1 concubin2', 'nom prenoms dateNaissance lieuNaissance')
            .lean();
            
        const total = await EngagementConcubinage.countDocuments(query);
        
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
        logger.error('Erreur lors de la récupération des engagements:', {
            error: error.message,
            stack: error.stack,
            requestId: req.id
        });
        
        res.status(500).json({
            success: false,
            message: 'Une erreur est survenue lors de la récupération des engagements',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Récupère les statistiques des engagements
 * @route GET /api/engagements/stats
 * @access Privé
 */
exports.getEngagementStats = async (req, res) => {
    try {
        const stats = await EngagementConcubinage.aggregate([
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    actifs: {
                        $sum: {
                            $cond: [{ $eq: ['$statut', 'actif'] }, 1, 0]
                        }
                    },
                    termines: {
                        $sum: {
                            $cond: [{ $eq: ['$statut', 'termine'] }, 1, 0]
                        }
                    },
                    parMois: {
                        $push: {
                            mois: { $dateToString: { format: "%Y-%m", date: "$dateEtablissement" } },
                            count: 1
                        }
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    total: 1,
                    actifs: 1,
                    termines: 1,
                    parMois: {
                        $reduce: {
                            input: "$parMois",
                            initialValue: [],
                            in: {
                                $let: {
                                    vars: {
                                        existing: {
                                            $filter: {
                                                input: "$$value",
                                                as: "item",
                                                cond: { $eq: ["$$item.mois", "$$this.mois"] }
                                            }
                                        }
                                    },
                                    in: {
                                        $cond: [
                                            { $gt: [{ $size: "$$existing" }, 0] },
                                            {
                                                $map: {
                                                    input: "$$value",
                                                    as: "item",
                                                    in: {
                                                        $cond: [
                                                            { $eq: ["$$item.mois", "$$this.mois"] },
                                                            { mois: "$$item.mois", count: { $add: ["$$item.count", 1] } },
                                                            "$$item"
                                                        ]
                                                    }
                                                }
                                            },
                                            { $concatArrays: ["$$value", [{ mois: "$$this.mois", count: 1 }]] }
                                        ]
                                    }
                                }
                            }
                        }
                    }
                }
            }
        ]);
        
        res.json({
            success: true,
            data: stats[0] || { total: 0, actifs: 0, termines: 0, parMois: [] }
        });
        
    } catch (error) {
        logger.error('Erreur lors de la récupération des statistiques des engagements:', {
            error: error.message,
            stack: error.stack,
            requestId: req.id
        });
        
        res.status(500).json({
            success: false,
            message: 'Une erreur est survenue lors de la récupération des statistiques',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Crée un nouvel engagement de concubinage
 * @route POST /api/engagements
 * @access Privé (Admin, Officier d'état civil)
 */
exports.createEngagement = async (req, res) => {
    try {
        const { 
            concubin1, 
            concubin2, 
            dateDebutConcubinage, 
            adresseCommune, 
            regimeBiens,
            detailsRegimeBiens,
            observations,
            temoins = [],
            documentsFournis = []
        } = req.body;

        // Vérification des concubins
        if (!concubin1 || !concubin2) {
            return res.status(400).json({
                success: false,
                message: 'Les informations des deux concubins sont requises'
            });
        }

        // Génération du numéro d'acte
        const count = await EngagementConcubinage.countDocuments();
        const numeroActe = `ENG-${new Date().getFullYear()}-${(count + 1).toString().padStart(4, '0')}`;

        // Création de l'engagement
        const nouvelEngagement = new EngagementConcubinage({
            numeroActe,
            concubin1: {
                ...concubin1,
                createdBy: req.user.id
            },
            concubin2: {
                ...concubin2,
                createdBy: req.user.id
            },
            dateDebutConcubinage: new Date(dateDebutConcubinage),
            adresseCommune,
            regimeBiens,
            detailsRegimeBiens,
            observations,
            temoins: temoins.map(temoin => ({
                ...temoin,
                createdBy: req.user.id
            })),
            documentsFournis,
            createdBy: req.user.id,
            statut: 'actif',
            dateEtablissement: new Date(),
            lieuEtablissement: process.env.MAIRIE_VILLE || 'Abéché'
        });

        // Sauvegarde de l'engagement
        const engagementEnregistre = await nouvelEngagement.save();

        res.status(201).json({
            success: true,
            message: 'Engagement de concubinage enregistré avec succès',
            data: engagementEnregistre
        });

    } catch (error) {
        logger.error('Erreur lors de la création de l\'engagement de concubinage:', {
            error: error.message,
            stack: error.stack,
            requestId: req.id
        });

        res.status(500).json({
            success: false,
            message: 'Une erreur est survenue lors de la création de l\'engagement',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Génère un PDF pour un engagement de concubinage
 * @route GET /api/engagements-concubinage/:id/pdf
 * @access Privé
 */
exports.generateEngagementPdf = async (req, res) => {
    const startTime = Date.now();
    const { id } = req.params;

    try {
        // Validation de l'ID
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'ID d\'engagement invalide',
                requestId: req.id
            });
        }

        // Récupération de l'engagement
        const engagement = await EngagementConcubinage.findById(id)
            .populate('concubin1 concubin2 temoins.createdBy')
            .lean();

        if (!engagement) {
            return res.status(404).json({
                success: false,
                message: 'Engagement de concubinage non trouvé',
                requestId: req.id
            });
        }

        // Préparation des données pour le PDF
        const pdfData = {
            // Informations administratives
            numeroActe: engagement.numeroActe,
            dateDebutConcubinage: engagement.dateDebutConcubinage,
            dateEtablissement: engagement.dateEtablissement || new Date(),
            lieuEtablissement: engagement.lieuEtablissement || 'Non spécifié',
            officierEtatCivil: req.user?.nomComplet || 'Officier d\'état civil',
            adresseCommune: engagement.adresseCommune || 'Non spécifiée',
            regimeBiens: engagement.regimeBiens || 'Non spécifié',
            detailsRegimeBiens: engagement.detailsRegimeBiens,
            observations: engagement.observations,
            statut: engagement.statut || 'actif',
            
            // Informations du premier concubin
            concubin1: {
                nom: engagement.concubin1?.nom || 'Non spécifié',
                prenoms: engagement.concubin1?.prenoms || 'Non spécifié',
                dateNaissance: engagement.concubin1?.dateNaissance || new Date(),
                lieuNaissance: engagement.concubin1?.lieuNaissance || 'Non spécifié',
                profession: engagement.concubin1?.profession || 'Sans profession',
                adresse: engagement.concubin1?.adresse || 'Non spécifiée',
                nationalite: engagement.concubin1?.nationalite || 'Tchadienne',
                typePieceIdentite: engagement.concubin1?.typePieceIdentite || 'CNI',
                numeroPieceIdentite: engagement.concubin1?.numeroPieceIdentite || 'Non spécifié',
                situationMatrimoniale: engagement.concubin1?.situationMatrimoniale || 'Célibataire',
                nomPere: engagement.concubin1?.nomPere || 'Non spécifié',
                prenomPere: engagement.concubin1?.prenomPere || '',
                nomMere: engagement.concubin1?.nomMere || 'Non spécifiée',
                prenomMere: engagement.concubin1?.prenomMere || '',
                domicileParents: engagement.concubin1?.domicileParents || 'Non spécifié'
            },
            
            // Informations du deuxième concubin
            concubin2: {
                nom: engagement.concubin2?.nom || 'Non spécifié',
                prenoms: engagement.concubin2?.prenoms || 'Non spécifié',
                dateNaissance: engagement.concubin2?.dateNaissance || new Date(),
                lieuNaissance: engagement.concubin2?.lieuNaissance || 'Non spécifié',
                profession: engagement.concubin2?.profession || 'Sans profession',
                adresse: engagement.concubin2?.adresse || 'Non spécifiée',
                nationalite: engagement.concubin2?.nationalite || 'Tchadienne',
                typePieceIdentite: engagement.concubin2?.typePieceIdentite || 'CNI',
                numeroPieceIdentite: engagement.concubin2?.numeroPieceIdentite || 'Non spécifié',
                situationMatrimoniale: engagement.concubin2?.situationMatrimoniale || 'Célibataire',
                nomPere: engagement.concubin2?.nomPere || 'Non spécifié',
                prenomPere: engagement.concubin2?.prenomPere || '',
                nomMere: engagement.concubin2?.nomMere || 'Non spécifiée',
                prenomMere: engagement.concubin2?.prenomMere || '',
                domicileParents: engagement.concubin2?.domicileParents || 'Non spécifié'
            },
            
            // Témoins (si disponibles)
            temoins: engagement.temoins?.map(temoin => ({
                nom: temoin.nom || 'Non spécifié',
                prenoms: temoin.prenoms || '',
                dateNaissance: temoin.dateNaissance || new Date(),
                profession: temoin.profession || 'Non spécifiée',
                adresse: temoin.adresse || 'Non spécifiée',
                typePieceIdentite: temoin.typePieceIdentite || 'CNI',
                numeroPieceIdentite: temoin.numeroPieceIdentite || 'Non spécifié',
                lieuNaissance: temoin.lieuNaissance || 'Non spécifié',
                nationalite: temoin.nationalite || 'Tchadienne',
                telephone: temoin.telephone || '',
                email: temoin.email || ''
            })) || [],
            
            // Mentions marginales (si disponibles)
            mentionsMarginales: engagement.mentionsMarginales?.map(mention => ({
                date: mention.date || new Date(),
                texte: mention.texte || 'Mention sans texte',
                type: mention.type || 'divers',
                reference: mention.reference || ''
            })) || []
        };

        // Validation des champs obligatoires
        const requiredFields = [
            'concubin1.nom', 'concubin1.prenoms', 'concubin1.dateNaissance', 'concubin1.lieuNaissance',
            'concubin2.nom', 'concubin2.prenoms', 'concubin2.dateNaissance', 'concubin2.lieuNaissance',
            'dateDebutConcubinage', 'lieuEtablissement', 'officierEtatCivil',
            'adresseCommune', 'regimeBiens'
        ];

        const missingFields = requiredFields.filter(field => {
            const value = field.split('.').reduce((obj, key) => 
                obj && obj[key] !== undefined ? obj[key] : undefined, pdfData
            );
            return value === undefined || value === null || value === '';
        });

        if (missingFields.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Champs manquants: ${missingFields.join(', ')}`,
                missingFields,
                requestId: req.id
            });
        }

        // Génération du PDF
        const pdfBuffer = await generatePdf('engagement-concubinage', pdfData);

        // Configuration des en-têtes de réponse
        const safeFileName = `engagement-${pdfData.numeroActe || 'sans-numero'}.pdf`
            .toLowerCase()
            .replace(/[^a-z0-9.-]/g, '-')
            .replace(/-+/g, '-');

        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="${safeFileName}"`,
            'Content-Length': pdfBuffer.length,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            'X-Request-ID': req.id
        });

        return res.send(pdfBuffer);

    } catch (error) {
        const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        logger.error(`[${errorId}] Erreur dans generateEngagementPdf`, {
            error: error.message,
            stack: error.stack,
            engagementId: id,
            requestId: req.id,
            duration: Date.now() - startTime
        });

        if (!res.headersSent) {
            return res.status(500).json({
                success: false,
                message: 'Une erreur est survenue lors de la génération du PDF',
                errorId,
                requestId: req.id
            });
        }
    }
};
