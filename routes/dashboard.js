const express = require('express');
const router = express.Router();
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
      naissancesCount,
      mariagesCount,
      decesCount
    ] = await Promise.all([
      Acte.countDocuments({ type: 'naissance' }),
      Acte.countDocuments({ type: 'mariage' }),
      Acte.countDocuments({ type: 'deces' })
    ]);

    // Formater les statistiques
    const stats = {
      naissances: naissancesCount,
      mariages: mariagesCount,
      deces: decesCount,
      total: naissancesCount + mariagesCount + decesCount,
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

// Endpoint unifié pour les actes récents (tous types)
router.get('/recent-actes', async (req, res) => {
  try {
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));

    // Charger les actes
    const actes = await Acte.find()
      .sort({ dateEnregistrement: -1 })
      .limit(limit)
      .select('type numeroActe details dateEnregistrement createdAt')
      .lean();

    const normalizedActes = actes.map(a => ({
      _id: a._id,
      type: a.type,
      numeroActe: a.numeroActe,
      dateEnregistrement: a.dateEnregistrement || a.createdAt,
      details: a.details || {}
    }));

    // Trier par date décroissante et limiter
    const merged = normalizedActes
      .sort((x, y) => new Date(y.dateEnregistrement) - new Date(x.dateEnregistrement))
      .slice(0, limit);

    return res.json({ success: true, data: merged });
  } catch (error) {
    logger.error('Erreur /recent-actes', { error: error.message, stack: error.stack, userId: req.user?.id });
    return res.status(500).json({ success: false, error: 'Impossible de récupérer les actes récents' });
  }
});

// Endpoint pour obtenir les activités récentes
router.get('/activities', async (req, res) => {
  try {
    // Aucune activité récente à afficher
    return res.json({ success: true, data: [] });
  } catch (error) {
    logger.error('Erreur lors de la récupération des activités récentes', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id
    });
    return res.status(500).json({ success: false, error: 'Impossible de récupérer les activités récentes' });
  }
});

module.exports = router;
