const express = require('express');
const router = express.Router();
const Acte = require('../models/Acte');
const User = require('../models/User');

// Fonction pour calculer le temps écoulé
function getTimeAgo(date) {
  const now = new Date();
  const diffMs = now - new Date(date);
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffHours < 1) return 'À l\'instant';
  if (diffHours < 24) return `${diffHours} heure${diffHours > 1 ? 's' : ''}`;
  if (diffDays < 7) return `${diffDays} jour${diffDays > 1 ? 's' : ''}`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} semaine${Math.floor(diffDays / 7) > 1 ? 's' : ''}`;
  return `${Math.floor(diffDays / 30)} mois`;
}

// Endpoint pour obtenir les statistiques du dashboard
router.get('/stats', async (req, res) => {
  try {
    // Compter les actes par type
    const stats = await Acte.aggregate([
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 }
        }
      }
    ]);

    // Formater les statistiques selon les attentes du frontend
    const formattedStats = {
      births: 0,
      marriages: 0,
      deaths: 0,
      documents: 0
    };

    stats.forEach(stat => {
      if (stat._id === 'naissance') formattedStats.births = stat.count;
      else if (stat._id === 'mariage') formattedStats.marriages = stat.count;
      else if (stat._id === 'deces') formattedStats.deaths = stat.count;
    });

    // Calculer le total des documents
    formattedStats.documents = formattedStats.births + formattedStats.marriages + formattedStats.deaths;

    res.json({
      success: true,
      data: formattedStats
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des statistiques'
    });
  }
});

// Endpoint pour obtenir les activités récentes
router.get('/activities', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    
    // Récupérer les actes récents
    const recentActes = await Acte.find()
      .sort({ dateEnregistrement: -1 })
      .limit(limit)
      .select('type dateEnregistrement numeroActe');

    // Récupérer les actes récents seulement

    // Formater les activités selon les attentes du frontend
    const formattedActivities = recentActes.map(acte => {
      const type = acte.type === 'naissance' ? 'birth' : 
                   acte.type === 'mariage' ? 'marriage' : 'death';
      
      const description = `Acte de ${acte.type} - ${acte.numeroActe}`;
      const time = getTimeAgo(acte.dateEnregistrement);
      const user = 'Système'; // Pas de champ utilisateur dans le modèle actuel
      
      return {
        type,
        description,
        time,
        user
      };
    });

    res.json({
      success: true,
      data: formattedActivities
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des activités:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des activités'
    });
  }
});

module.exports = router;
