const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const gardeEnfantSchema = new mongoose.Schema({
  nom: {
    type: String,
    required: [true, 'Le nom de l\'enfant est requis'],
    trim: true
  },
  prenom: {
    type: String,
    required: [true, 'Le prénom de l\'enfant est requis'],
    trim: true
  },
  dateNaissance: {
    type: Date,
    required: [true, 'La date de naissance de l\'enfant est requise']
  },
  garde: {
    type: String,
    enum: ['père', 'mère', 'garde alternée', 'autre'],
    required: [true, 'Le type de garde est requis']
  },
  details: {
    type: String,
    trim: true
  }
});

const personneSchema = new mongoose.Schema({
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

const divorceSchema = new mongoose.Schema({
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
  
  // Informations sur le mariage
  dateMariage: {
    type: Date,
    required: [true, 'La date de mariage est requise']
  },
  lieuMariage: {
    type: String,
    required: [true, 'Le lieu de mariage est requis'],
    trim: true
  },
  
  // Informations sur le divorce
  dateDivorce: {
    type: Date,
    required: [true, 'La date de divorce est requise']
  },
  typeDivorce: {
    type: String,
    enum: ['par consentement mutuel', 'pour faute', 'pour altération définitive du lien conjugal'],
    required: [true, 'Le type de divorce est requis']
  },
  regimeMatrimonial: {
    type: String,
    required: [true, 'Le régime matrimonial est requis'],
    trim: true
  },
  motifs: {
    type: String,
    required: [true, 'Les motifs du divorce sont requis'],
    trim: true
  },
  
  // Informations sur les époux
  epoux: {
    type: personneSchema,
    required: [true, 'Les informations sur l\'époux sont requises']
  },
  
  epouse: {
    type: personneSchema,
    required: [true, 'Les informations sur l\'épouse sont requises']
  },
  
  // Garde des enfants
  gardeEnfants: [gardeEnfantSchema],
  
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
  statut: {
    type: String,
    enum: ['en_attente', 'validé', 'rejeté', 'annulé'],
    default: 'en_attente'
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

// Ajout du plugin de pagination au schéma
divorceSchema.plugin(mongoosePaginate);

// Index pour les recherches fréquentes
divorceSchema.index({ 
  'epoux.nom': 'text', 
  'epoux.prenoms': 'text', 
  'epouse.nom': 'text', 
  'epouse.prenoms': 'text',
  numeroActe: 'text',
  'gardeEnfants.nom': 'text',
  'gardeEnfants.prenom': 'text'
});

// Middleware pour générer le numéro d'acte avant la sauvegarde
divorceSchema.pre('save', async function(next) {
  if (!this.isNew) return next();
  
  try {
    const count = await this.constructor.countDocuments();
    this.numeroActe = `DIV-${new Date().getFullYear()}-${(count + 1).toString().padStart(5, '0')}`;
    next();
  } catch (error) {
    next(error);
  }
});

// Middleware pour enregistrer l'utilisateur qui a effectué la modification
divorceSchema.pre('save', function(next) {
  if (this.isModified()) {
    this.updatedBy = this._req?.user?.id;
  }
  next();
});

const Divorce = mongoose.model('Divorce', divorceSchema);

module.exports = Divorce;
