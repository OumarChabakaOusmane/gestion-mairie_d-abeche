const mongoose = require('mongoose');

const naissanceSchema = new mongoose.Schema({
  // Informations de l'enfant
  nomEnfant: {
    type: String,
    required: true,
    trim: true
  },
  prenomsEnfant: {
    type: String,
    required: true,
    trim: true
  },
  dateNaissance: {
    type: Date,
    required: true
  },
  heureNaissance: {
    type: String,
    required: true
  },
  lieuNaissance: {
    type: String,
    required: true,
    trim: true
  },
  sexe: {
    type: String,
    enum: ['M', 'F'],
    required: true
  },

  // Informations du père
  nomPere: {
    type: String,
    required: true,
    trim: true
  },
  prenomsPere: {
    type: String,
    required: true,
    trim: true
  },
  dateNaissancePere: Date,
  lieuNaissancePere: String,
  professionPere: String,
  domicilePere: String,

  // Informations de la mère
  nomMere: {
    type: String,
    required: true,
    trim: true
  },
  prenomsMere: {
    type: String,
    required: true,
    trim: true
  },
  nomJeuneFilleMere: String,
  dateNaissanceMere: Date,
  lieuNaissanceMere: String,
  professionMere: String,
  domicileMere: String,

  // Informations du déclarant
  declarant: {
    nom: String,
    prenoms: String,
    qualite: String,
    domicile: String
  },

  // Informations administratives
  numeroActe: {
    type: String,
    required: true,
    unique: true
  },
  dateEtablissement: {
    type: Date,
    default: Date.now
  },
  mairie: {
    type: String,
    required: true
  },
  officierEtatCivil: {
    type: String,
    required: true
  },
  mentionsMarginales: [{
    type: String,
    trim: true
  }],

  // Références et métadonnées
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  statut: {
    type: String,
    enum: ['brouillon', 'validé', 'annulé'],
    default: 'brouillon'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index pour les recherches fréquentes
naissanceSchema.index({ numeroActe: 1 });
naissanceSchema.index({ nomEnfant: 1, prenomsEnfant: 1 });
naissanceSchema.index({ 'dateNaissance': 1 });
naissanceSchema.index({ nomPere: 1, prenomsPere: 1 });
naissanceSchema.index({ nomMere: 1, prenomsMere: 1 });

// Méthodes personnalisées
naissanceSchema.methods.toJSON = function() {
  const naissance = this.toObject();
  delete naissance.__v;
  return naissance;
};

const Naissance = mongoose.model('Naissance', naissanceSchema);

module.exports = Naissance;
