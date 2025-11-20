const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { authenticate } = require('../../middleware/auth');
const DemandeActe = require('../../models/DemandeActe');
const User = require('../../models/User');
const { sendEmail } = require('../../services/emailService');
const fs = require('fs');
const { promisify } = require('util');

const unlinkAsync = promisify(fs.unlink);

// Configuration de Multer pour le stockage temporaire
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../../uploads/temp');
    require('fs').mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// Créer une nouvelle demande d'acte
router.post('/', 
  authenticate,
  upload.fields([
    { name: 'pieceIdentite', maxCount: 1 },
    { name: 'justificatifDomicile', maxCount: 1 },
    { name: 'documentsComplementaires', maxCount: 5 }
  ]),
  async (req, res) => {
    try {
      const userId = req.user._id;
      const { type, details, mairie } = req.body;
      
      // Vérifier que le type est valide
      if (!['naissance', 'mariage', 'deces'].includes(type)) {
        return res.status(400).json({
          success: false,
          message: 'Type d\'acte invalide'
        });
      }

      // Récupérer l'utilisateur
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Utilisateur non trouvé'
        });
      }

      // Préparer les pièces jointes
      const piecesJointes = [];
      if (req.files) {
        if (req.files.pieceIdentite) {
          piecesJointes.push({
            nomFichier: req.files.pieceIdentite[0].originalname,
            cheminFichier: req.files.pieceIdentite[0].path,
            type: 'pieceIdentite'
          });
        }
        if (req.files.justificatifDomicile) {
          piecesJointes.push({
            nomFichier: req.files.justificatifDomicile[0].originalname,
            cheminFichier: req.files.justificatifDomicile[0].path,
            type: 'justificatifDomicile'
          });
        }
        if (req.files.documentsComplementaires) {
          req.files.documentsComplementaires.forEach(file => {
            piecesJointes.push({
              nomFichier: file.originalname,
              cheminFichier: file.path,
              type: 'documentComplementaire'
            });
          });
        }
      }

      // Préparer les données de la demande
      const demandeData = {
        demandeur: userId,
        nom: details.nom || user.nom,
        prenom: details.prenom || user.prenom,
        email: details.email || user.email,
        telephone: details.telephone || user.telephone,
        adresse: details.adresse || user.adresse,
        typeActe: type,
        typeDocument: details.typeDocument || 'copie-integrale', // Valeur par défaut
        piecesJointes: piecesJointes,
        statut: 'en-attente',
        detailsActe: {}
      };

      // Ajouter les détails spécifiques au type d'acte
      if (type === 'deces') {
        demandeData.detailsActe = {
          nom: details.nomDefunt,
          prenom: details.prenomDefunt,
          dateEvenement: details.dateDeces,
          lieuEvenement: details.lieuDeces,
          deces: {
            dateDeces: details.dateDeces,
            heureDeces: details.heureDeces,
            typeLieuDeces: details.typeLieuDeces,
            lieuDeces: details.lieuDeces,
            communeDeces: details.communeDeces,
            typeCauseDeces: details.typeCauseDeces,
            ...(details.typeLieuDeces === 'domicile' && { adresseDeces: details.adresseDeces }),
            ...(details.typeLieuDeces === 'hopital' && { hopitalDeces: details.hopitalDeces }),
            ...(details.typeLieuDeces === 'autre' && { detailsAutreLieu: details.detailsAutreLieu })
          }
        };
      }
      // Ajouter d'autres conditions pour les autres types d'actes si nécessaire

      // Créer la demande
      const nouvelleDemande = new DemandeActe(demandeData);
      
      // Valider la demande
      const validationError = nouvelleDemande.validateSync();
      if (validationError) {
        // Supprimer les fichiers uploadés en cas d'erreur
        await Promise.all(piecesJointes.map(file => 
          unlinkAsync(file.cheminFichier).catch(console.error)
        ));
        
        const errors = [];
        for (const field in validationError.errors) {
          errors.push(validationError.errors[field].message);
        }
        
        return res.status(400).json({
          success: false,
          message: 'Erreur de validation',
          errors: errors
        });
      }

      // Sauvegarder la demande
      const demandeSauvegardee = await nouvelleDemande.save();

      // Envoyer un email de confirmation
      try {
        await sendEmail({
          to: user.email,
          subject: 'Confirmation de votre demande d\'acte de décès',
          template: 'confirmation-demande-deces',
          context: {
            nom: user.prenom,
            numeroDossier: demandeSauvegardee.numeroDossier,
            dateDemande: new Date().toLocaleDateString('fr-FR')
          }
        });
      } catch (emailError) {
        console.error('Erreur lors de l\'envoi de l\'email de confirmation:', emailError);
      }

      // Répondre avec succès
      res.status(201).json({
        success: true,
        message: 'Demande enregistrée avec succès',
        data: {
          numeroActe: demandeSauvegardee.numeroDossier,
          dateCreation: demandeSauvegardee.dateCreation
        }
      });

    } catch (error) {
      console.error('Erreur lors de la création de la demande:', error);
      
      // Supprimer les fichiers uploadés en cas d'erreur
      if (req.files) {
        const files = [];
        if (req.files.pieceIdentite) files.push(req.files.pieceIdentite[0].path);
        if (req.files.justificatifDomicile) files.push(req.files.justificatifDomicile[0].path);
        if (req.files.documentsComplementaires) {
          req.files.documentsComplementaires.forEach(file => files.push(file.path));
        }
        await Promise.all(files.map(file => unlinkAsync(file).catch(console.error)));
      }

      res.status(500).json({
        success: false,
        message: 'Une erreur est survenue lors de l\'enregistrement de la demande',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

module.exports = router;
