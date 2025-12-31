const express = require('express');
const router = express.Router();
const bergerController = require('../controllers/bergerController');
const pdfController = require('../controllers/pdfController'); // Vérifiez ce chemin
const authMiddleware = require('../middleware/authMiddleware');

router.get('/dashboard', authMiddleware('berger'), bergerController.getDashboard);
router.get('/members', authMiddleware('berger'), bergerController.getMembers);
router.get('/stats', authMiddleware('berger'), bergerController.getStats);
router.get('/export/pdf', authMiddleware('berger'), pdfController.generateBergerPDF);

module.exports = router;