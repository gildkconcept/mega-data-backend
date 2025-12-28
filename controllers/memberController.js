const Member = require('../models/Member');
const { Parser } = require('json2csv');

const memberController = {
  // Créer un nouveau membre (UNIQUEMENT pour les membres, PAS les admins)
  createMember: (req, res) => {
    // Vérifier si l'utilisateur est un admin
    if (req.user.role === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Les administrateurs ne peuvent pas enregistrer de membres. Cette fonctionnalité est réservée aux utilisateurs membres.'
      });
    }
    
    const { nom, prenom, numero, quartier } = req.body;
    const userId = req.user.id;
    
    // Validation des données
    if (!nom || !prenom || !numero || !quartier) {
      return res.status(400).json({
        success: false,
        message: 'Veuillez remplir tous les champs: nom, prénom, numéro, quartier'
      });
    }
    
    // Vérifier si le membre existe déjà pour cet utilisateur
    Member.existsForUser(userId, nom, prenom, (err, exists) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: 'Erreur serveur lors de la vérification'
        });
      }
      
      if (exists) {
        return res.status(400).json({
          success: false,
          message: 'Ce membre est déjà enregistré avec votre compte'
        });
      }
      
      // Créer le membre
      Member.create(
        { user_id: userId, nom, prenom, numero, quartier },
        (err, newMember) => {
          if (err) {
            console.error('Erreur création membre:', err);
            return res.status(500).json({
              success: false,
              message: 'Erreur lors de l\'enregistrement du membre'
            });
          }
          
          res.status(201).json({
            success: true,
            message: 'Membre enregistré avec succès',
            member: newMember
          });
        }
      );
    });
  },
  
  // Récupérer les membres de l'utilisateur connecté
  getMyMembers: (req, res) => {
    const userId = req.user.id;
    
    Member.getByUserId(userId, (err, membres) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: 'Erreur lors de la récupération des membres'
        });
      }
      
      res.json({
        success: true,
        membres
      });
    });
  },
  
  // Récupérer tous les membres (admin seulement)
  getAllMembers: (req, res) => {
    Member.getAll((err, membres) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: 'Erreur lors de la récupération de tous les membres'
        });
      }
      
      res.json({
        success: true,
        membres
      });
    });
  },
  
  // Récupérer tous les utilisateurs (admin seulement)
  getAllUsers: (req, res) => {
    Member.getAllUsers((err, users) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: 'Erreur lors de la récupération des utilisateurs'
        });
      }
      
      res.json({
        success: true,
        users
      });
    });
  },
  
  // Supprimer un membre (admin seulement)
  deleteMember: (req, res) => {
    const { id } = req.params;
    
    Member.delete(id, (err, result) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: 'Erreur lors de la suppression'
        });
      }
      
      if (!result.deleted) {
        return res.status(404).json({
          success: false,
          message: 'Membre non trouvé'
        });
      }
      
      res.json({
        success: true,
        message: 'Membre supprimé avec succès'
      });
    });
  },
  
  // Supprimer un utilisateur (admin seulement)
  deleteUser: (req, res) => {
    const { id } = req.params;
    
    // Empêcher la suppression d'un admin par un autre admin (sécurité)
    Member.getAllUsers((err, users) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: 'Erreur lors de la vérification'
        });
      }
      
      const userToDelete = users.find(u => u.id === parseInt(id));
      
      if (userToDelete && userToDelete.role === 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Impossible de supprimer un compte administrateur'
        });
      }
      
      Member.deleteUser(id, (err, result) => {
        if (err) {
          return res.status(500).json({
            success: false,
            message: 'Erreur lors de la suppression de l\'utilisateur'
          });
        }
        
        if (!result.deleted) {
          return res.status(404).json({
            success: false,
            message: 'Utilisateur non trouvé'
          });
        }
        
        res.json({
          success: true,
          message: 'Utilisateur et ses membres supprimés avec succès'
        });
      });
    });
  },
  
  // Mettre à jour le rôle d'un utilisateur (admin seulement)
  updateUserRole: (req, res) => {
    const { id } = req.params;
    const { role } = req.body;
    
    if (!role || !['admin', 'member'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Rôle invalide. Doit être "admin" ou "member"'
      });
    }
    
    Member.updateUserRole(id, role, (err, result) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: 'Erreur lors de la mise à jour du rôle'
        });
      }
      
      if (!result.updated) {
        return res.status(404).json({
          success: false,
          message: 'Utilisateur non trouvé'
        });
      }
      
      res.json({
        success: true,
        message: `Rôle de l'utilisateur mis à jour à "${role}"`
      });
    });
  },

  // Exporter tous les membres en CSV (admin seulement)
  exportMembersCSV: (req, res) => {
    Member.getAll((err, membres) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: 'Erreur lors de la récupération des membres'
        });
      }

      try {
        // Préparer les données pour l'exportation
        const dataForExport = membres.map(membre => ({
          ID: membre.id,
          'Nom du membre': membre.nom,
          'Prénom du membre': membre.prenom,
          'Numéro de téléphone': membre.numero,
          'Quartier': membre.quartier,
          'Enregistré par': membre.username || membre.email || 'N/A',
          'Rôle de l\'utilisateur': membre.role,
          'Date d\'enregistrement': new Date(membre.created_at).toLocaleDateString('fr-FR'),
          'Heure d\'enregistrement': new Date(membre.created_at).toLocaleTimeString('fr-FR')
        }));

        // Convertir en CSV
        const json2csvParser = new Parser({
          fields: [
            'ID',
            'Nom du membre',
            'Prénom du membre',
            'Numéro de téléphone',
            'Quartier',
            'Enregistré par',
            'Rôle de l\'utilisateur',
            'Date d\'enregistrement',
            'Heure d\'enregistrement'
          ],
          delimiter: ';'
        });

        const csv = json2csvParser.parse(dataForExport);

        // Définir les headers pour le téléchargement
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=mega-data-membres-${new Date().toISOString().split('T')[0]}.csv`);
        
        // Envoyer le CSV
        res.send(csv);

      } catch (error) {
        console.error('Erreur lors de la conversion en CSV:', error);
        res.status(500).json({
          success: false,
          message: 'Erreur lors de la génération du fichier CSV'
        });
      }
    });
  },

  // Exporter tous les utilisateurs en CSV (admin seulement)
  exportUsersCSV: (req, res) => {
    Member.getAllUsers((err, users) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: 'Erreur lors de la récupération des utilisateurs'
        });
      }

      try {
        // Préparer les données pour l'exportation
        const dataForExport = users.map(user => ({
          ID: user.id,
          'Nom d\'utilisateur': user.username,
          'Email': user.email,
          'Nom': user.nom,
          'Prénom': user.prenom,
          'Rôle': user.role === 'admin' ? 'Administrateur' : 'Membre',
          'Date d\'inscription': new Date(user.created_at).toLocaleDateString('fr-FR'),
          'Heure d\'inscription': new Date(user.created_at).toLocaleTimeString('fr-FR'),
          'Statut': 'Actif'
        }));

        // Convertir en CSV
        const json2csvParser = new Parser({
          fields: [
            'ID',
            'Nom d\'utilisateur',
            'Email',
            'Nom',
            'Prénom',
            'Rôle',
            'Date d\'inscription',
            'Heure d\'inscription',
            'Statut'
          ],
          delimiter: ';'
        });

        const csv = json2csvParser.parse(dataForExport);

        // Définir les headers pour le téléchargement
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=mega-data-utilisateurs-${new Date().toISOString().split('T')[0]}.csv`);
        
        // Envoyer le CSV
        res.send(csv);

      } catch (error) {
        console.error('Erreur lors de la conversion en CSV:', error);
        res.status(500).json({
          success: false,
          message: 'Erreur lors de la génération du fichier CSV'
        });
      }
    });
  },

  // Exporter tous les membres en JSON (admin seulement)
  exportMembersJSON: (req, res) => {
    Member.getAll((err, membres) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: 'Erreur lors de la récupération des membres'
        });
      }

      try {
        // Formater les données
        const formattedData = {
          meta: {
            application: "Mega-data Église",
            dateExport: new Date().toISOString(),
            totalMembres: membres.length,
            format: "JSON"
          },
          membres: membres.map(membre => ({
            id: membre.id,
            nom: membre.nom,
            prenom: membre.prenom,
            numero: membre.numero,
            quartier: membre.quartier,
            enregistrePar: {
              username: membre.username,
              email: membre.email,
              role: membre.role
            },
            dateEnregistrement: membre.created_at,
            timestamp: new Date(membre.created_at).getTime()
          }))
        };

        // Définir les headers pour le téléchargement
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=mega-data-membres-${new Date().toISOString().split('T')[0]}.json`);
        
        // Envoyer le JSON
        res.json(formattedData);

      } catch (error) {
        console.error('Erreur lors de la génération du JSON:', error);
        res.status(500).json({
          success: false,
          message: 'Erreur lors de la génération du fichier JSON'
        });
      }
    });
  },

  // Exporter tous les utilisateurs en JSON (admin seulement)
  exportUsersJSON: (req, res) => {
    Member.getAllUsers((err, users) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: 'Erreur lors de la récupération des utilisateurs'
        });
      }

      try {
        // Formater les données
        const formattedData = {
          meta: {
            application: "Mega-data Église",
            dateExport: new Date().toISOString(),
            totalUtilisateurs: users.length,
            administrateurs: users.filter(u => u.role === 'admin').length,
            membres: users.filter(u => u.role === 'member').length,
            format: "JSON"
          },
          utilisateurs: users.map(user => ({
            id: user.id,
            username: user.username,
            email: user.email,
            nom: user.nom,
            prenom: user.prenom,
            role: user.role,
            dateInscription: user.created_at,
            timestamp: new Date(user.created_at).getTime()
          }))
        };

        // Définir les headers pour le téléchargement
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=mega-data-utilisateurs-${new Date().toISOString().split('T')[0]}.json`);
        
        // Envoyer le JSON
        res.json(formattedData);

      } catch (error) {
        console.error('Erreur lors de la génération du JSON:', error);
        res.status(500).json({
          success: false,
          message: 'Erreur lors de la génération du fichier JSON'
        });
      }
    });
  }
};

module.exports = memberController;