const express = require('express');
const router = express.Router();
const memberController = require('../controllers/memberController');
const authMiddleware = require('../middleware/authMiddleware');

// Routes pour les membres (utilisateurs normaux)
router.post('/', authMiddleware(), memberController.createMember);
router.get('/my-members', authMiddleware(), memberController.getMyMembers);

// Routes pour les administrateurs
router.get('/all', authMiddleware('admin'), memberController.getAllMembers);
router.get('/users', authMiddleware('admin'), memberController.getAllUsers);
router.delete('/:id', authMiddleware('admin'), memberController.deleteMember);
router.delete('/users/:id', authMiddleware('admin'), memberController.deleteUser);
router.put('/users/:id/role', authMiddleware('admin'), memberController.updateUserRole);

// Routes d'exportation (admin seulement) - AJOUTÉES
router.get('/export/csv/members', authMiddleware('admin'), memberController.exportMembersCSV);
router.get('/export/csv/users', authMiddleware('admin'), memberController.exportUsersCSV);
router.get('/export/json/members', authMiddleware('admin'), memberController.exportMembersJSON);
router.get('/export/json/users', authMiddleware('admin'), memberController.exportUsersJSON);

module.exports = router;