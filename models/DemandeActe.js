const mongoose = require('mongoose');

const demandeActeSchema = new mongoose.Schema({
  // Informations sur le demandeur
  demandeur: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  nom: {
    type: String,
    required: true,
    trim: true,
    uppercase: true
  },
  prenom: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  telephone: {
    type: String,
    trim: true
  },
  adresse: {
    type: String,
    required: true,
    trim: true
  },

  // Détails de la demande
  typeActe: {
    type: String,
    enum: ['naissance', 'mariage', 'deces'],
    required: true
  },
  typeDocument: {
    type: String,
    enum: ['copie-integrale', 'extrait-avec-filiation', 'extrait-sans-filiation'],
    required: true
  },
  
  // Informations sur l'acte demandé (selon le type d'acte)
  detailsActe: {
    // Commun à tous les types d'actes
    nom: {
      type: String,
      trim: true,
      uppercase: true
    },
    prenom: {
      type: String,
      trim: true
    },
    dateEvenement: Date,
    lieuEvenement: String,
    
    // Pour les actes de naissance
    nomsParents: {
      pere: String,
      mere: String
    },
    
    // Pour les actes de mariage
    nomsConjoints: {
      epoux: String,
      epouse: String
    },
    dateMariage: Date
  },
  
  // Justificatifs
  piecesJointes: [{
    nomFichier: String,
    cheminFichier: String,
    type: String, // 'piece-identite', 'justificatif-domicile', etc.
    dateUpload: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Suivi de la demande
  statut: {
    type: String,
    enum: ['en-attente', 'en-cours', 'pret-a-recuperer', 'recupere', 'rejete'],
    default: 'en-attente'
  },
  motifRejet: {
    type: String,
    trim: true
  },
  
  // Suivi administratif
  numeroDossier: {
    type: String,
    unique: true,
    trim: true
  },
  dateTraitement: Date,
  agentTraitant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Documents générés
  documentsGeneres: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document'
  }],
  
  // Métadonnées
  dateCreation: {
    type: Date,
    default: Date.now
  },
  dateModification: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: {
    createdAt: 'dateCreation',
    updatedAt: 'dateModification'
  },
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index pour les recherches courantes
demandeActeSchema.index({ 'demandeur': 1, 'statut': 1 });
demandeActeSchema.index({ 'typeActe': 1, 'dateCreation': -1 });

// Middleware pour générer un numéro de dossier unique avant la sauvegarde
demandeActeSchema.pre('save', async function(next) {
  if (!this.numeroDossier) {
    const count = await this.constructor.countDocuments();
    const date = new Date();
    const annee = date.getFullYear();
    const mois = String(date.getMonth() + 1).padStart(2, '0');
    const seq = String(count + 1).padStart(4, '0');
    this.numeroDossier = `DEM-${annee}${mois}-${seq}`;
  }
  next();
});

// Méthode pour formater l'objet JSON
demandeActeSchema.method('toJSON', function() {
  const { __v, _id, ...object } = this.toObject();
  object.id = _id;
  return object;
});

const DemandeActe = mongoose.model('DemandeActe', demandeActeSchema);

module.exports = DemandeActe;
