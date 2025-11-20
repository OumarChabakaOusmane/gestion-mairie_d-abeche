// routes/calendrier.js
const express = require('express');
const router = express.Router();
const logger = require('../config/logger');
const Naissance = require('../models/Naissance');
const Mariage = require('../models/Mariage');
const Deces = require('../models/Deces');

// Récupérer les événements du calendrier
router.get('/', async (req, res, next) => {  
  try {
    let { start, end } = req.query;

    // Si start/end manquent, on utilise le mois courant comme plage par défaut
    if (!start || !end) {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      start = start || firstDay.toISOString();
      end = end || lastDay.toISOString();
      logger.info('Paramètres start/end manquants — utilisation du mois courant par défaut');
    }

    logger.info(`Récupération des événements du ${start} au ${end}`);

    // Convertir les dates en objets Date
    const startDate = new Date(start);
    const endDate = new Date(end);
    
    // Récupérer les naissances dans la plage de dates
    const [naissances, mariages, deces] = await Promise.all([
      Naissance.find({
        dateNaissance: { 
          $gte: startDate,
          $lte: endDate
        },
        statut: 'validé' // Uniquement les actes validés
      }),
      
      // Récupérer les mariages dans la plage de dates
      Mariage.find({
        dateMariage: {
          $gte: startDate,
          $lte: endDate
        },
        statut: 'validé' // Uniquement les actes validés
      }),
      
      // Récupérer les décès dans la plage de dates
      Deces.find({
        dateDeces: {
          $gte: startDate,
          $lte: endDate
        },
        statut: 'validé' // Uniquement les actes validés
      })
    ]);
    
    // Formater les événements pour FullCalendar
    const events = [
      // Naissances
      ...naissances.map(naissance => ({
        id: `naissance-${naissance._id}`,
        title: 'Naissance',
        start: naissance.dateNaissance,
        color: '#4CAF50', // Vert
        extendedProps: {
          type: 'naissance',
          numeroActe: naissance.numeroActe,
          details: {
            nom: naissance.enfant.nom,
            prenom: naissance.enfant.prenom,
            date: naissance.dateNaissance,
            lieu: naissance.lieuNaissance
          }
        }
      })),
      
      // Mariages
      ...mariages.map(mariage => ({
        id: `mariage-${mariage._id}`,
        title: 'Mariage',
        start: mariage.dateMariage,
        color: '#2196F3', // Bleu
        extendedProps: {
          type: 'mariage',
          numeroActe: mariage.numeroActe,
          details: {
            epoux: `${mariage.epoux.prenom} ${mariage.epoux.nom}`,
            epouse: `${mariage.epouse.prenom} ${mariage.epouse.nom}`,
            date: mariage.dateMariage,
            lieu: mariage.lieuMariage
          }
        }
      })),
      
      // Décès
      ...deces.map(deces => ({
        id: `deces-${deces._id}`,
        title: 'Décès',
        start: deces.dateDeces,
        color: '#F44336', // Rouge
        extendedProps: {
          type: 'deces',
          numeroActe: deces.numeroActe,
          details: {
            defunt: `${deces.defunt.prenom} ${deces.defunt.nom}`,
            date: deces.dateDeces,
            lieu: deces.lieuDeces,
            dateNaissance: deces.defunt.dateNaissance
          }
        }
      }))
    ];
    
    logger.info(`Retour de ${events.length} événements`);

    // S'assurer que les dates sont sérialisables proprement (ISO strings)
    const serialized = events.map(ev => ({
      id: ev.id,
      title: ev.title,
      start: (ev.start instanceof Date) ? ev.start.toISOString() : ev.start,
      color: ev.color,
      extendedProps: ev.extendedProps || {}
    }));

    res.json({ success: true, data: serialized });
    
  } catch (error) {
    logger.error('Erreur lors de la récupération des événements:', {
      message: error.message,
      stack: error.stack,
      query: req.query
    });
    
    next(error);
  }
});

// Récupérer le détail d'un événement
router.get('/:type/:id', async (req, res, next) => {
  try {
    const { type, id } = req.params;
    let event = null;
    
    switch (type) {
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