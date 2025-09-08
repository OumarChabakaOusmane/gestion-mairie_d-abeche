const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

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
  pere: {
    nom: { type: String, trim: true },
    prenom: { type: String, trim: true },
    profession: { type: String, trim: true },
    decede: { type: Boolean, default: false }
  },
  mere: {
    nom: { type: String, trim: true },
    prenom: { type: String, trim: true },
    profession: { type: String, trim: true },
    decedee: { type: Boolean, default: false }
  }
});

const temoinSchema = new mongoose.Schema({
  nom: {
    type: String,
    required: [true, 'Le nom du témoin est requis'],
    trim: true
  },
  prenom: {
    type: String,
    required: [true, 'Le prénom du témoin est requis'],
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
  lien: {
    type: String,
    trim: true
  }
});

const mariageSchema = new mongoose.Schema({
  // Informations générales
  numeroActe: {
    type: String,
    unique: true,
    trim: true,
    index: true
  },
  dateEtablissement: {
    type: Date,
    default: Date.now
  },
  officierEtatCivil: {
    type: String,
    required: [true, 'Le nom de l\'officier d\'état civil est requis'],
    trim: true
  },
  
  // Informations sur le mariage
  dateMariage: {
    type: Date,
    required: [true, 'La date du mariage est requise']
  },
  lieuMariage: {
    type: String,
    required: [true, 'Le lieu du mariage est requis'],
    trim: true
  },
  regimeMatrimonial: {
    type: String,
    enum: ['communauté réduite aux acquêts', 'séparation de biens', 'participation aux acquêts', 'communauté universelle'],
    default: 'communauté réduite aux acquêts'
  },
  contratMariage: {
    type: Boolean,
    default: false
  },
  notaire: {
    type: String,
    trim: true
  },
  
  // Informations sur les époux
  epoux: {
    type: personneSchema,
    required: true
  },
  epouse: {
    type: personneSchema,
    required: true
  },
  
  // Témoins (entre 2 et 4)
  temoins: {
    type: [temoinSchema],
    validate: [
      {
        validator: function(v) {
          return v.length >= 2 && v.length <= 4;
        },
        message: 'Il doit y avoir entre 2 et 4 témoins'
      }
    ]
  },
  
  // Documents fournis
  documents: [{
    type: String,
    trim: true
  }],
  
  // Informations complémentaires
  observations: {
    type: String,
    trim: true
  },
  
  // Références et métadonnées
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  status: {
    type: String,
    enum: ['brouillon', 'validé', 'annulé'],
    default: 'brouillon'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Génération automatique du numéro d'acte
mariageSchema.pre('save', async function(next) {
  if (!this.isNew) return next();
  
  try {
    const count = await this.constructor.countDocuments();
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    
    this.numeroActe = `M-${year}${month}${day}-${count + 1}-${randomNum}`;
    next();
  } catch (error) {
    next(error);
  }
});

// Ajout de la pagination
mariageSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('Mariage', mariageSchema);
