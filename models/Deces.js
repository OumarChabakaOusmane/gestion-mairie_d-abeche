const mongoose = require('mongoose');

const decesSchema = new mongoose.Schema({
  // Informations du défunt
  defunt: {
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
    dateNaissance: {
      type: Date,
      required: true
    },
    lieuNaissance: {
      type: String,
      required: true,
      trim: true
    },
    profession: {
      type: String,
      trim: true
    },
    adresse: {
      type: String,
      trim: true
    },
    nationalite: {
      type: String,
      trim: true
    },
    sexe: {
      type: String,
      enum: ['M', 'F'],
      required: true
    }
  },

  // Informations sur le décès
  dateDeces: {
    type: Date,
    required: true
  },
  heureDeces: {
    type: String,
    required: true
  },
  lieuDeces: {
    type: String,
    required: true,
    trim: true
  },
  causeDeces: {
    type: String,
    trim: true
  },

  // Informations des parents (pour identification)
  pere: {
    nom: {
      type: String,
      trim: true,
      uppercase: true
    },
    prenoms: {
      type: String,
      trim: true
    },
    decede: {
      type: Boolean,
      default: false
    }
  },
  mere: {
    nom: {
      type: String,
      trim: true,
      uppercase: true
    },
    prenoms: {
      type: String,
      trim: true
    },
    decedee: {
      type: Boolean,
      default: false
    }
  },

  // Informations du déclarant
  declarant: {
    nom: {
      type: String,
      trim: true,
      uppercase: true
    },
    prenoms: {
      type: String,
      trim: true
    },
    qualite: {
      type: String,
      trim: true
    },
    adresse: {
      type: String,
      trim: true
    },
    dateDeclaration: {
      type: Date,
      default: Date.now
    }
  },

  // Informations administratives
  numeroActe: {
    type: String,
    unique: true,
    trim: true
  },
  statut: {
    type: String,
    enum: ['brouillon', 'validé', 'rejeté'],
    default: 'brouillon'
  },
  observations: {
    type: String,
    trim: true
  },
  
  // Métadonnées
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
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
  }
});

// Index pour les recherches courantes
decesSchema.index({ 'defunt.nom': 1, 'defunt.prenom': 1 });
decesSchema.index({ 'defunt.dateNaissance': 1 });
decesSchema.index({ dateDeces: 1 });

// Méthode pour formater l'objet JSON
decesSchema.method('toJSON', function() {
  const { __v, _id, ...object } = this.toObject();
  object.id = _id;
  return object;
});

const Deces = mongoose.model('Deces', decesSchema);

module.exports = Deces;
