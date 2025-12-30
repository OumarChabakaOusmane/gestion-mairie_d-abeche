const mongoose = require('mongoose');

// Schéma pour les événements du calendrier
const calendarEventSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    title: {
      type: String,
      required: [true, 'Le titre est obligatoire'],
      trim: true
    },
    description: {
      type: String,
      trim: true,
      default: ''
    },
    location: {
      type: String,
      trim: true,
      default: ''
    },
    type: {
      type: String,
      enum: ['naissance', 'mariage', 'deces', 'autre'],
      default: 'autre'
    },
    start: {
      type: Date,
      required: [true, 'La date de début est obligatoire']
    },
    end: {
      type: Date,
      default: null
    },
    allDay: {
      type: Boolean,
      default: false
    },
    color: {
      type: String,
      default: '#3498db'
    },
    backgroundColor: {
      type: String,
      default: '#3498db'
    },
    borderColor: {
      type: String,
      default: '#0d6efd'
    },
    textColor: {
      type: String,
      default: '#ffffff'
    },
    isPublic: {
      type: Boolean,
      default: false
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Index pour améliorer les performances
calendarEventSchema.index({ userId: 1, start: 1 });
calendarEventSchema.index({ start: 1, end: 1 });

module.exports = mongoose.model('CalendarEvent', calendarEventSchema);
