const express = require('express');
const router = express.Router();
const presenceController = require('../controllers/presenceController');
const authMiddleware = require('../middleware/authMiddleware');

// Toutes les routes sont protégées pour les bergers
router.use(authMiddleware('berger'));

// Enregistrer une présence
router.post('/record', presenceController.recordPresence);

// Récupérer les présences pour une date
router.get('/date/:date', presenceController.getPresencesByDate);

// Marquer tous comme présents
router.post('/mark-all', presenceController.markAllPresent);

// Générer un rapport PDF
router.get('/report/:date', presenceController.generatePresenceReport);

// Récupérer les statistiques
router.get('/stats', presenceController.getPresenceStats);

module.exports = router;