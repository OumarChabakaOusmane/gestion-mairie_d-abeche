const express = require('express');
const router = express.Router();
const Divorce = require('../models/Divorce');
const EngagementConcubinage = require('../models/EngagementConcubinage');
const Acte = require('../models/Acte');
const logger = require('../config/logger');
const { authenticate } = require('../middleware/auth');

// Appliquer l'authentification à toutes les routes
router.use(authenticate);

// Fonction utilitaire pour formater la date
function formatTimeAgo(date) {
  if (!date) return 'Inconnu';
  
  const now = new Date();
  const diffMs = now - new Date(date);
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffMins < 1) return 'À l\'instant';
  if (diffMins < 60) return `Il y a ${diffMins} minute${diffMins > 1 ? 's' : ''}`;
  if (diffHours < 24) return `Il y a ${diffHours} heure${diffHours > 1 ? 's' : ''}`;
  if (diffDays < 30) return `Il y a ${diffDays} jour${diffDays > 1 ? 's' : ''}`;
  
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `Il y a ${diffMonths} mois`;
  
  const diffYears = Math.floor(diffMonths / 12);
  return `Il y a ${diffYears} an${diffYears > 1 ? 's' : ''}`;
}

// Endpoint pour obtenir les statistiques du dashboard
router.get('/stats', async (req, res) => {
  try {
    // Utiliser Promise.all pour exécuter les requêtes en parallèle
    const [
      divorcesCount, 
      engagementsCount,
      naissancesCount,
      mariagesCount,
      decesCount
    ] = await Promise.all([
      Divorce.countDocuments(),
      EngagementConcubinage.countDocuments(),
      Acte.countDocuments({ type: 'naissance' }),
      Acte.countDocuments({ type: 'mariage' }),
      Acte.countDocuments({ type: 'deces' })
    ]);

    // Formater les statistiques
    const stats = {
      divorces: divorcesCount,
      engagements: engagementsCount,
      naissances: naissancesCount,
      mariages: mariagesCount,
      deces: decesCount,
      total: divorcesCount + engagementsCount + naissancesCount + mariagesCount + decesCount,
      lastUpdated: new Date()
    };

    // Mise en cache côté client (1 minute)
    res.set('Cache-Control', 'public, max-age=60');
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Erreur lors de la récupération des statistiques', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id
    });
    
    res.status(500).json({
      success: false,
      error: 'Impossible de récupérer les statistiques',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Endpoint pour obtenir les activités récentes
router.get('/activities', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    
    // Récupérer les activités récentes en parallèle
    const [recentDivorces, recentEngagements] = await Promise.all([
      Divorce.find()
        .sort({ dateEtablissement: -1 })
        .limit(limit)
        .select('dateEtablissement numeroActe')
        .lean(),
      EngagementConcubinage.find()
        .sort({ dateEtablissement: -1 })
        .limit(limit)
        .select('dateEtablissement numeroActe')
        .lean()
    ]);

    // Formater les activités
    const formatActivity = (item, type) => ({
      id: item._id,
      type,
      numeroActe: item.numeroActe,
      date: item.dateEtablissement,
      timeAgo: formatTimeAgo(item.dateEtablissement),
      icon: type === 'divorce' ? 'fa-gavel' : 'fa-handshake',
      color: type === 'divorce' ? 'danger' : 'success'
    });

    const activities = [
      ...recentDivorces.map(item => formatActivity(item, 'divorce')),
      ...recentEngagements.map(item => formatActivity(item, 'engagement'))
    ].sort((a, b) => new Date(b.date) - new Date(a.date))
     .slice(0, limit);

    res.json({
      success: true,
      data: activities
    });
  } catch (error) {
    logger.error('Erreur lors de la récupération des activités récentes', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id
    });
    
    res.status(500).json({
      success: false,
      error: 'Impossible de récupérer les activités récentes',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
