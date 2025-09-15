const requiredEnv = [
  'JWT_SECRET',
  'MONGODB_URI',
  // Optionnels mais recommandés selon fonctionnalités
  // 'CORS_ORIGIN',
  // 'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'
];

function validateEnv() {
  const missing = requiredEnv.filter((key) => !process.env[key] || String(process.env[key]).trim() === '');
  if (missing.length > 0) {
    const message = `Variables d'environnement manquantes: ${missing.join(', ')}`;
    // En production, on bloque le démarrage
    if (process.env.NODE_ENV === 'production') {
      throw new Error(message);
    } else {
      // En dev, on avertit seulement
      console.warn(`[ENV WARNING] ${message}`);
    }
  }
}

module.exports = { validateEnv };


