const mongoose = require('mongoose');

const temoinSchema = new mongoose.Schema({
  nom: {
    type: String,
    required: [true, 'Le nom du témoin est requis'],
    trim: true
  },
  prenoms: {
    type: String,
    required: [true, 'Les prénoms du témoin sont requis'],
    trim: true
  },
  dateNaissance: {
    type: Date,
    required: [true, 'La date de naissance du témoin est requise']
  },
  profession: {
    type: String,
    trim: true
  },
  adresse: {
    type: String,
    required: [true, 'L\'adresse du témoin est requise'],
    trim: true
  },
  typePieceIdentite: {
    type: String,
    enum: ['CNI', 'Passeport', 'Acte de naissance', 'Autre'],
    required: [true, 'Le type de pièce d\'identité du témoin est requis']
  },
  numeroPieceIdentite: {
    type: String,
    trim: true
  }
});

const concubinSchema = new mongoose.Schema({
  nom: {
    type: String,
    required: [true, 'Le nom est requis'],
    trim: true,
    uppercase: true
  },
  prenoms: {
    type: String,
    required: [true, 'Les prénoms sont requis'],
    trim: true
  },
  dateNaissance: {
    type: Date,
    required: [true, 'La date de naissance est requise']
  },
  lieuNaissance: {
    type: String,
    required: [true, 'Le lieu de naissance est requis'],
    trim: true
  },
  profession: {
    type: String,
    trim: true
  },
  adresse: {
    type: String,
    required: [true, 'L\'adresse est requise'],
    trim: true
  },
  nationalite: {
    type: String,
    required: [true, 'La nationalité est requise'],
    trim: true
  },
  typePieceIdentite: {
    type: String,
    enum: ['CNI', 'Passeport', 'Acte de naissance', 'Autre'],
    required: [true, 'Le type de pièce d\'identité est requis']
  },
  numeroPieceIdentite: {
    type: String,
    required: [true, 'Le numéro de pièce d\'identité est requis'],
    trim: true
  },
  situationMatrimoniale: {
    type: String,
    enum: ['célibataire', 'marié(e)', 'divorcé(e)', 'veuf(ve)', 'séparé(e) de corps'],
    default: 'célibataire'
  },
  nomConjoint: {
    type: String,
    trim: true
  },
  dateMariage: {
    type: Date
  }
});

const engagementConcubinageSchema = new mongoose.Schema({
  // Informations générales
  numeroActe: {
    type: String,
    unique: true,
    trim: true,
    index: true
  },
  dateEtablissement: {
    type: Date,
    required: [true, 'La date d\'établissement est requise'],
    default: Date.now
  },
  lieuEtablissement: {
    type: String,
    required: [true, 'Le lieu d\'établissement est requis'],
    trim: true
  },
  officierEtatCivil: {
    type: String,
    required: [true, 'Le nom de l\'officier d\'état civil est requis'],
    trim: true
  },
  
  // Informations sur le concubinage
  dateDebutConcubinage: {
    type: Date,
    required: [true, 'La date de début du concubinage est requise']
  },
  adresseCommune: {
    type: String,
    required: [true, 'L\'adresse commune est requise'],
    trim: true
  },
  regimeBiens: {
    type: String,
    enum: ['séparation de biens', 'indivision', 'autre'],
    required: [true, 'Le régime des biens est requis']
  },
  detailsRegimeBiens: {
    type: String,
    trim: true
  },
  observations: {
    type: String,
    trim: true
  },
  
  // Informations sur les concubins
  concubin1: {
    type: concubinSchema,
    required: [true, 'Les informations sur le premier concubin sont requises']
  },
  
  concubin2: {
    type: concubinSchema,
    required: [true, 'Les informations sur le deuxième concubin sont requises']
  },
  
  // Témoins
  temoins: [temoinSchema],
  
  // Documents associés
  documents: [{
    nom: String,
    url: String,
    type: String,
    dateAjout: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Statut et historique
  statut: {
    type: String,
    enum: ['actif', 'rompu', 'converti_en_mariage'],
    default: 'actif'
  },
  dateFin: {
    type: Date
  },
  motifFin: {
    type: String,
    trim: true
  },
  
  // Métadonnées
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'L\'utilisateur qui a créé l\'acte est requis']
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  commentaires: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    texte: {
      type: String,
      required: true,
      trim: true
    },
    date: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index pour les recherches fréquentes
engagementConcubinageSchema.index({ 
  'concubin1.nom': 'text', 
  'concubin1.prenoms': 'text', 
  'concubin2.nom': 'text', 
  'concubin2.prenoms': 'text',
  numeroActe: 'text',
  'temoins.nom': 'text',
  'temoins.prenoms': 'text'
});

// Middleware pour générer le numéro d'acte avant la sauvegarde
engagementConcubinageSchema.pre('save', async function(next) {
  if (!this.isNew) return next();
  
  try {
    const count = await this.constructor.countDocuments();
    this.numeroActe = `CONC-${new Date().getFullYear()}-${(count + 1).toString().padStart(5, '0')}`;
    next();
  } catch (error) {
    next(error);
  }
});

// Middleware pour enregistrer l'utilisateur qui a effectué la modification
engagementConcubinageSchema.pre('save', function(next) {
  if (this.isModified()) {
    this.updatedBy = this._req?.user?.id;
  }
  next();
});

const EngagementConcubinage = mongoose.model('EngagementConcubinage', engagementConcubinageSchema);

module.exports = EngagementConcubinage;
