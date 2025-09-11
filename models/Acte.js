const mongoose = require('mongoose');

const ActeSchema = new mongoose.Schema({
  type: { 
    type: String, 
    enum: ['naissance', 'mariage', 'deces'], 
    required: true 
  },
  details: { 
    type: Object, 
    required: true 
  },
  dateEnregistrement: { 
    type: Date, 
    default: Date.now 
  },
  mairie: { 
    type: String, 
    required: true 
  },
  // Auteur de la création (utilisé par populate dans plusieurs contrôleurs)
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false,
  },
  numeroActe: {
  type: String,
  unique: true,
  
}
});

// Génération automatique du numéro d'acte avant sauvegarde
ActeSchema.pre('save', function(next) {
  if (!this.numeroActe) {
    const prefix = this.type === 'naissance' ? 'N' : 
                  this.type === 'mariage' ? 'M' : 'D';
    this.numeroActe = `${prefix}${Date.now().toString().slice(-6)}`;
  }
  next();
});

module.exports = mongoose.model('Acte', ActeSchema);