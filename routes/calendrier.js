// routes/calendrier.js
const express = require('express');
const router = express.Router();
const logger = require('../config/logger');
const Naissance = require('../models/Naissance');
const Mariage = require('../models/Mariage');
const Deces = require('../models/Deces');
const NodeCache = require('node-cache');

// Mise en cache des résultats pendant 60 secondes
const eventCache = new NodeCache({ stdTTL: 60 });

// Récupérer les événements du calendrier
router.get('/', async (req, res, next) => {  
  try {
    const { start, end } = req.query;
    const cacheKey = `${start}-${end}`;
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
      logger.info('Paramètres start/end manquants — utilisation du mois courant par défaut');
    } else {
      // Nettoyer et convertir les dates en objets Date valides
      const cleanStart = start.split('T')[0]; // Ne garder que la partie date
      const cleanEnd = end.split('T')[0];     // Ne garder que la partie date
      
      startDate = new Date(cleanStart);
      endDate = new Date(cleanEnd);
      
      // Ajuster l'heure de fin pour inclure toute la journée
      endDate.setHours(23, 59, 59, 999);
      
      // Vérifier si les dates sont valides
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        throw new Error('Format de date invalide');
      }
    }

    logger.info(`Récupération des événements du ${startDate} au ${endDate}`);
    logger.info(`Requête Naissance: dateNaissance entre ${startDate} et ${endDate}, statut: validé`);
    logger.info(`Requête Mariage: dateMariage entre ${startDate} et ${endDate}, statut: validé`);
    logger.info(`Requête Décès: dateDeces entre ${startDate} et ${endDate}, statut: validé`);

    // Récupérer les naissances dans la plage de dates
    const [naissances, mariages, deces] = await Promise.all([
      Naissance.find({
        dateNaissance: { 
          $gte: startDate,
          $lte: endDate
        },
        statut: 'validé'
      }).lean(),
      
      // Récupérer les mariages dans la plage de dates
      Mariage.find({
        dateMariage: {
          $gte: startDate,
          $lte: endDate
        },
        statut: 'validé'
      }).lean(),
      
      // Récupérer les décès dans la plage de dates
      Deces.find({
        dateDeces: {
          $gte: startDate,
          $lte: endDate
        },
        statut: 'validé'
      }).lean()
    ]);
    
    // Log des résultats bruts
    logger.info(`Résultats bruts - Naissances: ${naissances.length}, Mariages: ${mariages.length}, Décès: ${deces.length}`);
    if (naissances.length > 0) logger.info('Exemple de naissance:', JSON.stringify(naissances[0], null, 2));
    if (mariages.length > 0) logger.info('Exemple de mariage:', JSON.stringify(mariages[0], null, 2));
    if (deces.length > 0) logger.info('Exemple de décès:', JSON.stringify(deces[0], null, 2));
    
    // Formater les événements pour FullCalendar
    const formatEvent = (event, type, title, color) => {
      // Déterminer la date de l'événement
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
            lieu: event.lieuNaissance || 'Non spécifié',
            sexe: event.sexe || 'Non spécifié',
            numeroActe: event.numeroActe || 'N/A'
          };
          break;
          
        case 'mariage':
          eventDate = event.dateMariage ? new Date(event.dateMariage) : new Date();
          eventTitle = `Mariage de ${event.epoux?.prenoms || ''} ${event.epoux?.nom || ''} et ${event.epouse?.prenoms || ''} ${event.epouse?.nom || ''}`.trim();
          details = {
            type: 'Mariage',
            epoux: {
              nom: event.epoux?.nom || 'Non spécifié',
              prenom: event.epoux?.prenoms || ''
            },
            epouse: {
              nom: event.epouse?.nom || 'Non spécifié',
              prenom: event.epouse?.prenoms || ''
            },
            date: eventDate.toLocaleDateString('fr-FR'),
            lieu: event.lieuMariage || 'Non spécifié',
            numeroActe: event.numeroActe || 'N/A'
          };
          break;
          
        case 'deces':
          eventDate = event.dateDeces ? new Date(event.dateDeces) : new Date();
          eventTitle = `Décès de ${event.defunt?.prenoms || ''} ${event.defunt?.nom || ''}`.trim();
          details = {
            type: 'Décès',
            defunt: {
              nom: event.defunt?.nom || 'Non spécifié',
              prenom: event.defunt?.prenoms || ''
            },
            date: eventDate.toLocaleDateString('fr-FR'),
            lieu: event.lieuDeces || 'Non spécifié',
            numeroActe: event.numeroActe || 'N/A'
          };
          if (event.defunt?.dateNaissance) {
            details.dateNaissance = new Date(event.defunt.dateNaissance).toLocaleDateString('fr-FR');
          }
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
      ...deces.map(deces => formatEvent(deces, 'deces', 'Décès', '#9E9E9E'))
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

// Créer ou mettre à jour un événement du calendrier
router.post('/', async (req, res, next) => {
  try {
    const { title, start, end, description, type } = req.body;
    
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
    
    // Ici, vous devriez ajouter la logique pour sauvegarder l'événement dans votre base de données
    // Par exemple, créer un modèle d'événement ou utiliser un modèle existant
    
    // Pour l'instant, on retourne simplement un succès avec les données reçues
    res.status(201).json({
      success: true,
      message: 'Événement enregistré avec succès',
      data: {
        id: 'event-' + Date.now(),
        title,
        start,
        end: end || null,
        description: description || '',
        type
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
      message: 'Une erreur est survenue lors de la sauvegarde de l\'événement'
    });
  }
});

module.exports = router;