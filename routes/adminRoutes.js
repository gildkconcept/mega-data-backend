const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');

// Route temporaire sans PDF
router.get('/export/pdf', authMiddleware('admin'), (req, res) => {
  res.json({
    success: true,
    message: 'Fonction PDF en développement',
    user: req.user
  });
});

module.exports = router;