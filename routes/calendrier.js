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
    const { start, end } = req.query;
    
    if (!start || !end) {
      return res.status(400).json({
        success: false,
        message: 'Les paramètres de date de début et de fin sont requis'
      });
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
    
    res.json(events);
    
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

module.exports = router;