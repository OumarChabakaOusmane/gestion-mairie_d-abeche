// routes/calendrier.js
const express = require('express');
const router = express.Router();
const logger = require('../config/logger');
const Naissance = require('../models/Naissance');
const Mariage = require('../models/Mariage');
const Deces = require('../models/Deces');
const CalendarEvent = require('../models/CalendarEvent');
const { authenticate } = require('../middleware/auth');
const NodeCache = require('node-cache');

// Mise en cache des résultats pendant 60 secondes
const eventCache = new NodeCache({ stdTTL: 60 });

// Récupérer les événements du calendrier
router.get('/', authenticate, async (req, res, next) => {  
  try {
    const { start, end } = req.query;
    const userId = req.user._id || req.user.id;
    const cacheKey = `${userId}-${start}-${end}`;
    let startDate, endDate;
    
    // Vérifier le cache
    const cachedData = eventCache.get(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }
    
    // Si start/end manquent, on utilise le mois courant comme plage par défaut
    if (!start || !end) {
      const now = new Date();
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    } else {
      // Nettoyer et convertir les dates en objets Date valides
      const cleanStart = start.split('T')[0];
      const cleanEnd = end.split('T')[0];
      
      startDate = new Date(cleanStart);
      endDate = new Date(cleanEnd);
      
      // Ajuster l'heure de fin pour inclure toute la journée
      endDate.setHours(23, 59, 59, 999);
      
      // Vérifier si les dates sont valides
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        throw new Error('Format de date invalide');
      }
    }

    // Récupérer les naissances, mariages, décès ET événements génériques
    const [naissances, mariages, deces, customEvents] = await Promise.all([
      Naissance.find({
        dateNaissance: { 
          $gte: startDate,
          $lte: endDate
        },
        statut: 'validé'
      }).lean(),
      
      Mariage.find({
        dateMariage: {
          $gte: startDate,
          $lte: endDate
        },
        statut: 'validé'
      }).lean(),
      
      Deces.find({
        dateDeces: {
          $gte: startDate,
          $lte: endDate
        },
        statut: 'validé'
      }).lean(),
      
      CalendarEvent.find({
        userId: userId,
        start: {
          $gte: startDate,
          $lte: endDate
        }
      }).lean()
    ]);
    
    // Fonction pour formater les événements
    const formatEvent = (event, type, title, color) => {
      let eventDate;
      let eventTitle = title;
      let details = {};
      
      switch(type) {
        case 'naissance':
          eventDate = event.dateNaissance ? new Date(event.dateNaissance) : new Date();
          eventTitle = `Naissance de ${event.prenomsEnfant || ''} ${event.nomEnfant || ''}`.trim();
          details = {
            type: 'Naissance',
            nom: event.nomEnfant || 'Non spécifié',
            prenom: event.prenomsEnfant || '',
            date: eventDate.toLocaleDateString('fr-FR'),
            lieu: event.lieuNaissance || 'Non spécifié'
          };
          break;
          
        case 'mariage':
          eventDate = event.dateMariage ? new Date(event.dateMariage) : new Date();
          eventTitle = `Mariage de ${event.epoux?.prenoms || ''} ${event.epoux?.nom || ''} et ${event.epouse?.prenoms || ''} ${event.epouse?.nom || ''}`.trim();
          details = {
            type: 'Mariage',
            date: eventDate.toLocaleDateString('fr-FR'),
            lieu: event.lieuMariage || 'Non spécifié'
          };
          break;
          
        case 'deces':
          eventDate = event.dateDeces ? new Date(event.dateDeces) : new Date();
          eventTitle = `Décès de ${event.defunt?.prenoms || ''} ${event.defunt?.nom || ''}`.trim();
          details = {
            type: 'Décès',
            date: eventDate.toLocaleDateString('fr-FR'),
            lieu: event.lieuDeces || 'Non spécifié'
          };
          break;
      }
      
      // Formater la date au format ISO (sans l'heure)
      const formattedDate = eventDate.toISOString().split('T')[0];
      
      return {
        id: `${type}-${event._id}`,
        title: eventTitle,
        start: formattedDate,
        allDay: true,
        color: color,
        extendedProps: details
      };
    };

    // Combiner tous les événements
    const events = [
      ...naissances.map(naissance => formatEvent(naissance, 'naissance', 'Naissance', '#4CAF50')),
      ...mariages.map(mariage => formatEvent(mariage, 'mariage', 'Mariage', '#2196F3')),
      ...deces.map(deces => formatEvent(deces, 'deces', 'Décès', '#9E9E9E')),
      ...customEvents.map(event => ({
        id: `custom-${event._id}`,
        title: event.title,
        start: event.start.toISOString().split('T')[0],
        end: event.end ? event.end.toISOString().split('T')[0] : null,
        allDay: event.allDay,
        color: event.color || '#3498db',
        backgroundColor: event.backgroundColor || '#3498db',
        borderColor: event.borderColor || '#0d6efd',
        textColor: event.textColor || '#ffffff',
        extendedProps: {
          type: event.type || 'autre',
          description: event.description || '',
          location: event.location || ''
        }
      }))
    ];
    
    // Mettre en cache les résultats
    const result = { 
      success: true,
      events: events || []
    };
    
    // Mettre en cache uniquement si on a des résultats
    if (events && events.length > 0) {
      eventCache.set(cacheKey, result);
    }
    
    // Envoyer la réponse
    return res.json(result);
    
  } catch (error) {
    logger.error('Erreur lors de la récupération des événements:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la récupération des événements',
      error: error.message 
    });
  }
});

// Récupérer les détails d'un événement spécifique
router.get('/:type/:id', async (req, res, next) => {
  try {
    const { type, id } = req.params;
    let event = null;
    
    // Récupérer l'événement en fonction du type
    switch(type) {
      case 'naissance':
        event = await Naissance.findById(id);
        break;
      case 'mariage':
        event = await Mariage.findById(id);
        break;
      case 'deces':
        event = await Deces.findById(id);
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Type d\'événement non valide'
        });
    }
    
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Événement non trouvé'
      });
    }
    
    res.json({
      success: true,
      data: event
    });
    
  } catch (error) {
    logger.error('Erreur lors de la récupération des détails de l\'événement:', {
      message: error.message,
      stack: error.stack,
      params: req.params
    });
    
    next(error);
  }
});

// Créer un événement du calendrier
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { title, start, end, description, type, location } = req.body;
    const userId = req.user._id || req.user.id;
    
    // Validation des champs obligatoires
    if (!title || !start || !type) {
      return res.status(400).json({
        success: false,
        message: 'Les champs titre, date de début et type sont obligatoires'
      });
    }
    
    // Vérifier que le type est valide
    const validTypes = ['naissance', 'mariage', 'deces', 'autre'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Type d\'événement non valide. Les types valides sont: ' + validTypes.join(', ')
      });
    }
    
    // Créer l'événement en base de données
    const newEvent = new CalendarEvent({
      userId: userId,
      title: title.trim(),
      description: description ? description.trim() : '',
      location: location ? location.trim() : '',
      type: type,
      start: new Date(start),
      end: end ? new Date(end) : null,
      allDay: true
    });
    
    // Sauvegarder l'événement
    await newEvent.save();
    
    logger.info('Événement créé avec succès', {
      eventId: newEvent._id,
      userId: userId,
      title: title,
      type: type
    });
    
    // Envoyer la réponse
    res.status(201).json({
      success: true,
      message: 'Événement enregistré avec succès',
      data: {
        id: `custom-${newEvent._id}`,
        title: newEvent.title,
        start: newEvent.start,
        end: newEvent.end,
        description: newEvent.description,
        location: newEvent.location,
        type: newEvent.type
      }
    });
    
  } catch (error) {
    logger.error('Erreur lors de la sauvegarde de l\'événement:', {
      message: error.message,
      stack: error.stack,
      body: req.body
    });
    
    res.status(500).json({
      success: false,
      message: 'Une erreur est survenue lors de la sauvegarde de l\'événement',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Mettre à jour un événement
router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, start, end, description, type, location } = req.body;
    const userId = req.user._id || req.user.id;
    
    // Extraire l'ID réel (enlever le préfixe 'custom-')
    const eventId = id.replace('custom-', '');
    
    // Validation des champs obligatoires
    if (!title || !start || !type) {
      return res.status(400).json({
        success: false,
        message: 'Les champs titre, date de début et type sont obligatoires'
      });
    }
    
    // Trouver et mettre à jour l'événement
    const event = await CalendarEvent.findByIdAndUpdate(
      eventId,
      {
        title: title.trim(),
        description: description ? description.trim() : '',
        location: location ? location.trim() : '',
        type: type,
        start: new Date(start),
        end: end ? new Date(end) : null,
        updatedAt: new Date()
      },
      { new: true, runValidators: true }
    );
    
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Événement non trouvé'
      });
    }
    
    logger.info('Événement mis à jour avec succès', {
      eventId: event._id,
      userId: userId,
      title: title,
      type: type
    });
    
    res.json({
      success: true,
      message: 'Événement mis à jour avec succès',
      data: {
        id: `custom-${event._id}`,
        title: event.title,
        start: event.start,
        end: event.end,
        description: event.description,
        location: event.location,
        type: event.type
      }
    });
    
  } catch (error) {
    logger.error('Erreur lors de la mise à jour de l\'événement:', {
      message: error.message,
      stack: error.stack,
      params: req.params,
      body: req.body
    });
    
    res.status(500).json({
      success: false,
      message: 'Une erreur est survenue lors de la mise à jour de l\'événement',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Supprimer un événement
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id || req.user.id;
    
    // Extraire l'ID réel (enlever le préfixe 'custom-')
    const eventId = id.replace('custom-', '');
    
    // Trouver et supprimer l'événement
    const event = await CalendarEvent.findByIdAndDelete(eventId);
    
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Événement non trouvé'
      });
    }
    
    logger.info('Événement supprimé avec succès', {
      eventId: event._id,
      userId: userId,
      title: event.title,
      type: event.type
    });
    
    res.json({
      success: true,
      message: 'Événement supprimé avec succès'
    });
    
  } catch (error) {
    logger.error('Erreur lors de la suppression de l\'événement:', {
      message: error.message,
      stack: error.stack,
      params: req.params
    });
    
    res.status(500).json({
      success: false,
      message: 'Une erreur est survenue lors de la suppression de l\'événement',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
