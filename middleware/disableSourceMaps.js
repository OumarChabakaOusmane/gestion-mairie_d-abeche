/**
 * Middleware pour supprimer les références aux source maps en production
 */
function disableSourceMaps(req, res, next) {
  if (process.env.NODE_ENV === 'production') {
    const originalSend = res.send;
    
    res.send = function(body) {
      if (typeof body === 'string' && res.get('Content-Type')?.includes('text/html')) {
        // Supprimer les références aux source maps
        body = body
          .replace(/\/\*# sourceMappingURL=[^\s*]+\*\//g, '')
          .replace(/\/\*# sourceMappingURL=[^\s]+/g, '')
          .replace(/\/\*@ sourceURL=[^\s]+\*\//g, '');
      }
      return originalSend.call(this, body);
    };
  }
  next();
}

module.exports = disableSourceMaps;
