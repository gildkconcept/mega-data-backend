const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware'); // Maintenant c'est une fonction

// Routes publiques
router.post('/register', authController.register);
router.post('/login', authController.login);

// Routes protégées (utiliser la fonction directement)
router.get('/profile', authMiddleware(), authController.getProfile); // Ici authMiddleware() fonctionne

// NOUVELLE ROUTE : Vérifier le rôle de l'utilisateur
router.get('/check-role', authMiddleware(), (req, res) => {
  res.json({
    success: true,
    user: req.user,
    isAdmin: ['admin', 'super_admin'].includes(req.user.role),
    isBerger: req.user.role === 'berger',
    isMember: req.user.role === 'member',
    canAccessAdmin: ['admin', 'super_admin'].includes(req.user.role),
    canAccessBerger: req.user.role === 'berger'
  });
});

module.exports = router;