// routes/calendrier.js
const express = require('express');
const router = express.Router();
const Acte = require('../models/Acte');

router.get('/', async (req, res) => {
  try {
    const actes = await Acte.find().sort({ dateEnregistrement: -1 });
    
    const events = actes.map(acte => {
      let title, date;
      
      switch(acte.type) {
        case 'naissance':
          title = `Naissance: ${acte.details.prenom} ${acte.details.nom}`;
          date = acte.details.dateNaissance;
          break;
        case 'mariage':
          title = `Mariage: ${acte.details.conjoint1} & ${acte.details.conjoint2}`;
          date = acte.details.dateMariage;
          break;
        case 'deces':
          title = `Décès: ${acte.details.prenom} ${acte.details.nom}`;
          date = acte.details.dateDeces;
          break;
      }

      return {
        title,
        start: date,
        color: acte.type === 'naissance' ? '#3498db' : 
              acte.type === 'mariage' ? '#2ecc71' : '#e74c3c'
      };
    });

    res.json({ 
      success: true,
      data: events 
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
});

module.exports = router;