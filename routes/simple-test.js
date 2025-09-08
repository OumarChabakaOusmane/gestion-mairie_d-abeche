const express = require('express');
const router = express.Router();

// Simple test route
router.get('/test', (req, res) => {
  console.log('Simple test route called');
  res.json({ status: 'success', message: 'Simple test route is working' });
});

module.exports = router;
