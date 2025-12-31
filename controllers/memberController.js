const Member = require('../models/Member');

const db = require('../database');
const json2csv = require('json2csv').Parser;
const memberController = {
  // Créer un nouveau membre
  createMember: (req, res) => {
    const { nom, prenom, numero, quartier, service } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;
    const serviceAssigne = req.user.service_assigne;

    // Validation des champs requis
    if (!nom || !prenom || !numero || !quartier || !service) {
      return res.status(400).json({
        success: false,
        message: 'Tous les champs sont requis: nom, prenom, numero, quartier, service'
      });
    }

    // Validation du numéro de téléphone
    const phoneRegex = /^(\+225|\+2250|0)?[0-9]{8,10}$/;
    if (!phoneRegex.test(numero)) {
      return res.status(400).json({
        success: false,
        message: 'Numéro de téléphone invalide. Format attendu: 0102030405 ou +2250102030405'
      });
    }

    // Pour les bergers: vérifier que le service correspond à leur service_assigne
    if (userRole === 'berger' && serviceAssigne && service !== serviceAssigne) {
      return res.status(403).json({
        success: false,
        message: `Vous ne pouvez ajouter que des membres du service: ${serviceAssigne}`
      });
    }

    // Vérifier si le membre existe déjà pour cet utilisateur
    Member.existsForUser(userId, nom, prenom, (err, exists) => {
      if (err) {
        console.error('Erreur vérification membre existant:', err);
        return res.status(500).json({
          success: false,
          message: 'Erreur serveur lors de la vérification'
        });
      }

      if (exists) {
        return res.status(400).json({
          success: false,
          message: 'Un membre avec ce nom et prénom existe déjà dans votre liste'
        });
      }

      // Créer le membre
      const membreData = {
        user_id: userId,
        nom: nom.trim(),
        prenom: prenom.trim(),
        numero: numero.replace(/^\+225/, '0').replace(/^225/, '0'), // Normaliser le numéro
        quartier: quartier.trim(),
        service: service.trim()
      };

      Member.create(membreData, (err, member) => {
        if (err) {
          console.error('Erreur création membre:', err);
          return res.status(500).json({
            success: false,
            message: 'Erreur lors de la création du membre'
          });
        }

        // Récupérer le membre créé avec les informations utilisateur
        Member.getById(member.id, userId, userRole, (err, memberWithDetails) => {
          if (err) {
            console.error('Erreur récupération membre:', err);
          }

          res.status(201).json({
            success: true,
            message: 'Membre créé avec succès',
            member: memberWithDetails || member
          });
        });
      });
    });
  },

  // Récupérer les membres de l'utilisateur connecté
  getMyMembers: (req, res) => {
    const userId = req.user.id;
    const userRole = req.user.role;
    const serviceAssigne = req.user.service_assigne;

    // Si c'est un berger avec service assigné, utiliser getForBerger
    if (userRole === 'berger' && serviceAssigne) {
      Member.getForBerger(serviceAssigne, (err, membres) => {
        if (err) {
          console.error('Erreur récupération membres berger:', err);
          return res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des membres'
          });
        }

        // Calculer les statistiques
        const aujourdhui = new Date().toDateString();
        const ilYa7Jours = new Date();
        ilYa7Jours.setDate(ilYa7Jours.getDate() - 7);

        const stats = {
          total: membres.length,
          aujourdhui: membres.filter(m => {
            const dateMembre = new Date(m.created_at).toDateString();
            return dateMembre === aujourdhui;
          }).length,
          cette_semaine: membres.filter(m => {
            const dateMembre = new Date(m.created_at);
            return dateMembre >= ilYa7Jours;
          }).length
        };

        res.json({
          success: true,
          service: serviceAssigne,
          stats,
          membres,
          total: membres.length
        });
      });
    } else {
      // Pour les autres utilisateurs (member, admin, super_admin sans service assigné)
      Member.getByUserId(userId, (err, membres) => {
        if (err) {
          console.error('Erreur récupération membres utilisateur:', err);
          return res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des membres'
          });
        }

        res.json({
          success: true,
          membres,
          total: membres.length
        });
      });
    }
  },

  // Récupérer tous les membres (admin seulement)
  getAllMembers: (req, res) => {
    Member.getAll((err, membres) => {
      if (err) {
        console.error('Erreur récupération tous membres:', err);
        return res.status(500).json({
          success: false,
          message: 'Erreur lors de la récupération des membres'
        });
      }

      // Calculer les statistiques générales
      const stats = {
        total: membres.length,
        par_service: {}
      };

      membres.forEach(membre => {
        const service = membre.service || 'Non spécifié';
        stats.par_service[service] = (stats.par_service[service] || 0) + 1;
      });

      res.json({
        success: true,
        membres,
        total: membres.length,
        stats
      });
    });
  },

  // Récupérer tous les utilisateurs (admin seulement)
  getAllUsers: (req, res) => {
    Member.getAllUsers((err, users) => {
      if (err) {
        console.error('Erreur récupération tous utilisateurs:', err);
        return res.status(500).json({
          success: false,
          message: 'Erreur lors de la récupération des utilisateurs'
        });
      }

      // Statistiques par rôle
      const stats = {
        total: users.length,
        par_role: {
          super_admin: 0,
          admin: 0,
          berger: 0,
          member: 0
        }
      };

      users.forEach(user => {
        if (stats.par_role[user.role] !== undefined) {
          stats.par_role[user.role]++;
        }
      });

      res.json({
        success: true,
        users,
        total: users.length,
        stats
      });
    });
  },

  // Récupérer un membre par ID
  getMemberById: (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    Member.getById(id, userId, userRole, (err, member) => {
      if (err) {
        console.error('Erreur récupération membre par ID:', err);
        return res.status(500).json({
          success: false,
          message: 'Erreur lors de la récupération du membre'
        });
      }

      if (!member) {
        return res.status(404).json({
          success: false,
          message: 'Membre non trouvé'
        });
      }

      res.json({
        success: true,
        member
      });
    });
  },

  // Mettre à jour un membre
  updateMember: (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Validation des champs à mettre à jour
    const allowedFields = ['nom', 'prenom', 'numero', 'quartier', 'service'];
    const invalidFields = Object.keys(updates).filter(field => !allowedFields.includes(field));

    if (invalidFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Champs non autorisés: ${invalidFields.join(', ')}`
      });
    }

    // Si c'est un berger qui essaie de changer le service
    if (userRole === 'berger' && updates.service && updates.service !== req.user.service_assigne) {
      return res.status(403).json({
        success: false,
        message: `Vous ne pouvez pas changer le service. Votre service assigné est: ${req.user.service_assigne}`
      });
    }

    // Validation du numéro de téléphone si présent
    if (updates.numero) {
      const phoneRegex = /^(\+225|\+2250|0)?[0-9]{8,10}$/;
      if (!phoneRegex.test(updates.numero)) {
        return res.status(400).json({
          success: false,
          message: 'Numéro de téléphone invalide'
        });
      }
      updates.numero = updates.numero.replace(/^\+225/, '0').replace(/^225/, '0');
    }

    // Normaliser les champs texte
    if (updates.nom) updates.nom = updates.nom.trim();
    if (updates.prenom) updates.prenom = updates.prenom.trim();
    if (updates.quartier) updates.quartier = updates.quartier.trim();
    if (updates.service) updates.service = updates.service.trim();

    Member.update(id, updates, userId, userRole, (err, result) => {
      if (err) {
        console.error('Erreur mise à jour membre:', err);
        return res.status(500).json({
          success: false,
          message: 'Erreur lors de la mise à jour du membre'
        });
      }

      if (!result.updated) {
        return res.status(404).json({
          success: false,
          message: 'Membre non trouvé ou non autorisé'
        });
      }

      // Récupérer le membre mis à jour
      Member.getById(id, userId, userRole, (err, updatedMember) => {
        if (err) {
          console.error('Erreur récupération membre mis à jour:', err);
        }

        res.json({
          success: true,
          message: 'Membre mis à jour avec succès',
          member: updatedMember
        });
      });
    });
  },

  // Supprimer un membre (admin seulement)
  deleteMember: (req, res) => {
    const { id } = req.params;

    Member.delete(id, (err, result) => {
      if (err) {
        console.error('Erreur suppression membre:', err);
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

    // Empêcher l'auto-suppression
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'Vous ne pouvez pas supprimer votre propre compte'
      });
    }

    // Empêcher la suppression d'un super_admin par un admin
    db.get('SELECT role FROM users WHERE id = ?', [id], (err, user) => {
      if (err) {
        console.error('Erreur vérification rôle utilisateur:', err);
        return res.status(500).json({
          success: false,
          message: 'Erreur serveur'
        });
      }

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Utilisateur non trouvé'
        });
      }

      if (user.role === 'super_admin' && req.user.role !== 'super_admin') {
        return res.status(403).json({
          success: false,
          message: 'Seuls les super administrateurs peuvent supprimer d\'autres super administrateurs'
        });
      }

      Member.deleteUser(id, (err, result) => {
        if (err) {
          console.error('Erreur suppression utilisateur:', err);
          return res.status(500).json({
            success: false,
            message: 'Erreur lors de la suppression'
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
          message: 'Utilisateur supprimé avec succès'
        });
      });
    });
  },

  // Mettre à jour le rôle d'un utilisateur (admin seulement)
  updateUserRole: (req, res) => {
    const { id } = req.params;
    const { role } = req.body;

    if (!role || !['member', 'berger', 'admin', 'super_admin'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Rôle invalide. Les rôles valides sont: member, berger, admin, super_admin'
      });
    }

    // Empêcher la modification de son propre rôle
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'Vous ne pouvez pas modifier votre propre rôle'
      });
    }

    // Vérifier les permissions
    db.get('SELECT role FROM users WHERE id = ?', [id], (err, user) => {
      if (err) {
        console.error('Erreur vérification utilisateur:', err);
        return res.status(500).json({
          success: false,
          message: 'Erreur serveur'
        });
      }

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Utilisateur non trouvé'
        });
      }

      // Empêcher un admin de modifier un super_admin
      if (user.role === 'super_admin' && req.user.role !== 'super_admin') {
        return res.status(403).json({
          success: false,
          message: 'Seuls les super administrateurs peuvent modifier d\'autres super administrateurs'
        });
      }

      // Empêcher de promouvoir quelqu'un au-dessus de son propre rôle
      const roleHierarchy = {
        'super_admin': 4,
        'admin': 3,
        'berger': 2,
        'member': 1
      };

      if (roleHierarchy[role] > roleHierarchy[req.user.role]) {
        return res.status(403).json({
          success: false,
          message: 'Vous ne pouvez pas attribuer un rôle supérieur au vôtre'
        });
      }

      Member.updateUserRole(id, role, (err, result) => {
        if (err) {
          console.error('Erreur mise à jour rôle:', err);
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
          message: `Rôle mis à jour avec succès: ${role}`,
          userId: id,
          newRole: role
        });
      });
    });
  },

  // Exporter les membres en CSV
  exportMembersCSV: (req, res) => {
    Member.getAll((err, membres) => {
      if (err) {
        console.error('Erreur récupération membres pour export:', err);
        return res.status(500).json({
          success: false,
          message: 'Erreur lors de l\'export'
        });
      }

      if (!membres || membres.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Aucun membre à exporter'
        });
      }

      try {
        const fields = [
          { label: 'ID', value: 'id' },
          { label: 'Nom', value: 'nom' },
          { label: 'Prénom', value: 'prenom' },
          { label: 'Numéro', value: 'numero' },
          { label: 'Quartier', value: 'quartier' },
          { label: 'Service', value: 'service' },
          { label: 'Berger', value: 'username' },
          { label: 'Date création', value: 'created_at' }
        ];

        const parser = new Parser({ fields });
        const csv = parser.parse(membres);

        res.header('Content-Type', 'text/csv');
        res.attachment(`membres_${new Date().toISOString().split('T')[0]}.csv`);
        res.send(csv);
      } catch (error) {
        console.error('Erreur conversion CSV:', error);
        res.status(500).json({
          success: false,
          message: 'Erreur lors de la conversion en CSV'
        });
      }
    });
  },

  // Exporter les utilisateurs en CSV
  exportUsersCSV: (req, res) => {
    Member.getAllUsers((err, users) => {
      if (err) {
        console.error('Erreur récupération utilisateurs pour export:', err);
        return res.status(500).json({
          success: false,
          message: 'Erreur lors de l\'export'
        });
      }

      if (!users || users.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Aucun utilisateur à exporter'
        });
      }

      try {
        const fields = [
          { label: 'ID', value: 'id' },
          { label: 'Username', value: 'username' },
          { label: 'Nom', value: 'nom' },
          { label: 'Prénom', value: 'prenom' },
          { label: 'Branche', value: 'branche' },
          { label: 'Rôle', value: 'role' },
          { label: 'Service Assigné', value: 'service_assigne' },
          { label: 'Date création', value: 'created_at' }
        ];

        const parser = new Parser({ fields });
        const csv = parser.parse(users);

        res.header('Content-Type', 'text/csv');
        res.attachment(`utilisateurs_${new Date().toISOString().split('T')[0]}.csv`);
        res.send(csv);
      } catch (error) {
        console.error('Erreur conversion CSV:', error);
        res.status(500).json({
          success: false,
          message: 'Erreur lors de la conversion en CSV'
        });
      }
    });
  },

  // Exporter les membres en JSON
  exportMembersJSON: (req, res) => {
    Member.getAll((err, membres) => {
      if (err) {
        console.error('Erreur récupération membres pour export JSON:', err);
        return res.status(500).json({
          success: false,
          message: 'Erreur lors de l\'export'
        });
      }

      res.json({
        success: true,
        exported_at: new Date().toISOString(),
        total: membres.length,
        data: membres
      });
    });
  },

  // Exporter les utilisateurs en JSON
  exportUsersJSON: (req, res) => {
    Member.getAllUsers((err, users) => {
      if (err) {
        console.error('Erreur récupération utilisateurs pour export JSON:', err);
        return res.status(500).json({
          success: false,
          message: 'Erreur lors de l\'export'
        });
      }

      res.json({
        success: true,
        exported_at: new Date().toISOString(),
        total: users.length,
        data: users
      });
    });
  },

  // Rechercher des membres
  searchMembers: (req, res) => {
    const { query, service } = req.query;
    const userRole = req.user.role;
    const userId = req.user.id;

    if (!query && !service) {
      return res.status(400).json({
        success: false,
        message: 'Veuillez fournir un terme de recherche ou un service'
      });
    }

    let sql = `SELECT m.*, u.username, u.branche 
               FROM membres m 
               LEFT JOIN users u ON m.user_id = u.id 
               WHERE 1=1`;
    const params = [];

    if (query) {
      sql += ` AND (m.nom LIKE ? OR m.prenom LIKE ? OR m.numero LIKE ? OR m.quartier LIKE ?)`;
      const searchTerm = `%${query}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (service) {
      sql += ` AND m.service = ?`;
      params.push(service);
    }

    // Si c'est un berger, limiter à son service assigné
    if (userRole === 'berger') {
      sql += ` AND m.service = ?`;
      params.push(req.user.service_assigne);
    }

    sql += ` ORDER BY m.created_at DESC LIMIT 100`;

    db.all(sql, params, (err, membres) => {
      if (err) {
        console.error('Erreur recherche membres:', err);
        return res.status(500).json({
          success: false,
          message: 'Erreur lors de la recherche'
        });
      }

      res.json({
        success: true,
        query,
        service,
        total: membres.length,
        membres
      });
    });
  }
};

module.exports = memberController;