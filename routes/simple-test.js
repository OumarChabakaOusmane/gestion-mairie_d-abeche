const express = require('express');
const router = express.Router();

// Healthcheck for test routing
router.get('/', (req, res) => {
  res.json({ success: true, message: 'simple-test route OK' });
});

module.exports = router;


