const DemandeActe = require('../models/DemandeActe');
const Document = require('../models/Document');
const User = require('../models/User');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const { sendEmail } = require('../services/emailService');

const unlinkAsync = promisify(fs.unlink);

exports.createDemande = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

        const piecesJointes = [];
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        piecesJointes.push({
          nomFichier: file.originalname,
          cheminFichier: file.path,
          type: file.fieldname // 'pieceIdentite', 'justificatifDomicile', etc.
        });
      });
    }

        const nouvelleDemande = new DemandeActe({
      demandeur: userId,
      nom: req.body.nom || user.nom,
      prenom: req.body.prenom || user.prenom,
      email: req.body.email || user.email,
      telephone: req.body.telephone || user.telephone,
      adresse: req.body.adresse || user.adresse,
      typeActe: req.body.typeActe,
      typeDocument: req.body.typeDocument,
      detailsActe: req.body.detailsActe,
      piecesJointes: piecesJointes,
      statut: 'en-attente'
    });

    const demandeSauvegardee = await nouvelleDemande.save();

    // Envoyer un email de confirmation
    try {
      await sendEmail({
        to: user.email,
        subject: 'Confirmation de votre demande d\'acte',
        template: 'confirmation-demande-acte',
        context: {
          nom: user.prenom,
          numeroDossier: demandeSauvegardee.numeroDossier,
          typeActe: demandeSauvegardee.typeActe,
          typeDocument: demandeSauvegardee.typeDocument,
          dateDemande: new Date().toLocaleDateString('fr-FR')
        }
      });
    } catch (emailError) {
      console.error('Erreur lors de l\'envoi de l\'email de confirmation:', emailError);
      // Ne pas échouer la requête si l'email échoue
    }

    res.status(201).json({
      success: true,
      data: demandeSauvegardee
    });
  } catch (error) {
    console.error('Erreur lors de la création de la demande:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de la demande',
      error: error.message
    });
  }
};

// Récupérer les demandes d'un utilisateur
exports.getMesDemandes = async (req, res) => {
  try {
    const demandes = await DemandeActe.find({ demandeur: req.user._id })
      .sort({ dateCreation: -1 })
      .populate('documentsGeneres', 'nomFichier cheminFichier');

    res.status(200).json({
      success: true,
      count: demandes.length,
      data: demandes
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des demandes',
      error: error.message
    });
  }
};

// Récupérer une demande spécifique
exports.getDemande = async (req, res) => {
  try {
    const demande = await DemandeActe.findOne({
      _id: req.params.id,
      $or: [
        { demandeur: req.user._id },
        { agentTraitant: req.user._id }
      ]
    }).populate('documentsGeneres');

    if (!demande) {
      return res.status(404).json({
        success: false,
        message: 'Demande non trouvée ou accès non autorisé'
      });
    }

    res.status(200).json({
      success: true,
      data: demande
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de la demande',
      error: error.message
    });
  }
};

// Annuler une demande (pour l'utilisateur)
exports.annulerDemande = async (req, res) => {
  try {
    const demande = await DemandeActe.findOneAndUpdate(
      {
        _id: req.params.id,
        demandeur: req.user._id,
        statut: { $in: ['en-attente', 'en-cours'] }
      },
      { 
        statut: 'annule',
        dateModification: Date.now()
      },
      { new: true, runValidators: true }
    );

    if (!demande) {
      return res.status(404).json({
        success: false,
        message: 'Demande non trouvée, déjà traitée ou annulation impossible'
      });
    }

    // Envoyer une notification d'annulation
    try {
      await sendEmail({
        to: req.user.email,
        subject: 'Annulation de votre demande d\'acte',
        template: 'annulation-demande-acte',
        context: {
          nom: req.user.prenom,
          numeroDossier: demande.numeroDossier,
          dateAnnulation: new Date().toLocaleDateString('fr-FR')
        }
      });
    } catch (emailError) {
      console.error('Erreur lors de l\'envoi de l\'email d\'annulation:', emailError);
    }

    res.status(200).json({
      success: true,
      data: demande
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'annulation de la demande',
      error: error.message
    });
  }
};

// Télécharger un document généré
exports.downloadDocument = async (req, res) => {
  try {
    const demande = await DemandeActe.findOne({
      _id: req.params.demandeId,
      demandeur: req.user._id
    }).populate('documentsGeneres');

    if (!demande) {
      return res.status(404).json({
        success: false,
        message: 'Demande non trouvée ou accès non autorisé'
      });
    }

    const document = demande.documentsGeneres.find(
      doc => doc._id.toString() === req.params.documentId
    );

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document non trouvé'
      });
    }

    const filePath = path.join(__dirname, '..', document.cheminFichier);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'Fichier non trouvé sur le serveur'
      });
    }

    // En-têtes pour forcer le téléchargement avec encodage UTF-8
    const encodedFilename = encodeURIComponent(document.nomFichier);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${document.nomFichier}"; filename*=UTF-8''${encodedFilename}`);
    
    // Envoyer le fichier
    res.sendFile(filePath);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors du téléchargement du document',
      error: error.message
    });
  }
};

// Administration

// Récupérer toutes les demandes (admin)
exports.getAllDemandes = async (req, res) => {
  try {
    const { statut, typeActe, dateDebut, dateFin, page = 1, limit = 10 } = req.query;
    
    const query = {};
    if (statut) query.statut = statut;
    if (typeActe) query.typeActe = typeActe;
    
    if (dateDebut || dateFin) {
      query.dateCreation = {};
      if (dateDebut) query.dateCreation.$gte = new Date(dateDebut);
      if (dateFin) {
        const fin = new Date(dateFin);
        fin.setHours(23, 59, 59, 999);
        query.dateCreation.$lte = fin;
      }
    }
    
    const options = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      sort: { dateCreation: -1 },
      populate: [
        { path: 'demandeur', select: 'nom prenom email' },
        { path: 'agentTraitant', select: 'nom prenom' },
        { path: 'documentsGeneres', select: 'nomFichier cheminFichier' }
      ]
    };
    
    const result = await DemandeActe.paginate(query, options);
    
    res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des demandes',
      error: error.message
    });
  }
};

// Mettre à jour le statut d'une demande (admin)
exports.updateStatutDemande = async (req, res) => {
  try {
    const { statut, motifRejet, commentaire } = req.body;
    
    const updateData = {
      statut,
      dateModification: Date.now(),
      agentTraitant: req.user._id
    };
    
    if (statut === 'rejete') {
      if (!motifRejet) {
        return res.status(400).json({
          success: false,
          message: 'Un motif de rejet est requis'
        });
      }
      updateData.motifRejet = motifRejet;
    }
    
    if (commentaire) {
      updateData.$push = {
        historique: {
          date: new Date(),
          auteur: req.user._id,
          action: 'Mise à jour du statut',
          commentaire: commentaire,
          nouveauStatut: statut
        }
      };
    }
    
    const demande = await DemandeActe.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!demande) {
      return res.status(404).json({
        success: false,
        message: 'Demande non trouvée'
      });
    }
    
    // Envoyer une notification de mise à jour
    try {
      const destinataire = await User.findById(demande.demandeur);
      if (destinataire && destinataire.email) {
        await sendEmail({
          to: destinataire.email,
          subject: `Mise à jour de votre demande d'acte #${demande.numeroDossier}`,
          template: 'mise-a-jour-demande',
          context: {
            nom: destinataire.prenom,
            numeroDossier: demande.numeroDossier,
            ancienStatut: demande.statut,
            nouveauStatut: statut,
            motifRejet: motifRejet || 'Non spécifié',
            dateMiseAJour: new Date().toLocaleDateString('fr-FR')
          }
        });
      }
    } catch (emailError) {
      console.error('Erreur lors de l\'envoi de l\'email de notification:', emailError);
    }
    
    res.status(200).json({
      success: true,
      data: demande
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du statut',
      error: error.message
    });
  }
};

// Ajouter un document à une demande (admin)
exports.ajouterDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Aucun fichier téléchargé'
      });
    }
    
    const document = new Document({
      nomFichier: req.file.originalname,
      cheminFichier: req.file.path,
      type: 'acte-officiel',
      uploadedBy: req.user._id,
      metadata: {
        typeActe: req.body.typeActe,
        numeroDossier: req.body.numeroDossier
      }
    });
    
    const documentSauvegarde = await document.save();
    
    const demande = await DemandeActe.findByIdAndUpdate(
      req.params.id,
      {
        $push: { documentsGeneres: documentSauvegarde._id },
        $set: { dateModification: Date.now() },
        $push: {
          historique: {
            date: new Date(),
            auteur: req.user._id,
            action: 'Document ajouté',
            commentaire: req.body.commentaire || 'Document ajouté par un agent',
            fichier: documentSauvegarde._id
          }
        }
      },
      { new: true, runValidators: true }
    );
    
    if (!demande) {
      // Supprimer le document si la mise à jour de la demande échoue
      await Document.findByIdAndDelete(documentSauvegarde._id);
      await unlinkAsync(documentSauvegarde.cheminFichier);
      
      return res.status(404).json({
        success: false,
        message: 'Demande non trouvée'
      });
    }
    
    // Envoyer une notification au demandeur
    try {
      const destinataire = await User.findById(demande.demandeur);
      if (destinataire && destinataire.email) {
        await sendEmail({
          to: destinataire.email,
          subject: `Document disponible pour votre demande #${demande.numeroDossier}`,
          template: 'document-disponible',
          context: {
            nom: destinataire.prenom,
            numeroDossier: demande.numeroDossier,
            typeDocument: document.metadata.typeActe || 'document',
            dateAjout: new Date().toLocaleDateString('fr-FR')
          }
        });
      }
    } catch (emailError) {
      console.error('Erreur lors de l\'envoi de l\'email de notification:', emailError);
    }
    
    res.status(201).json({
      success: true,
      data: {
        demande,
        document: documentSauvegarde
      }
    });
  } catch (error) {
    // Supprimer le fichier en cas d'erreur
    if (req.file && req.file.path) {
      await unlinkAsync(req.file.path).catch(console.error);
    }
    
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'ajout du document',
      error: error.message
    });
  }
};
