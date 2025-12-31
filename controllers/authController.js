const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database');
require('dotenv').config();

const authController = {
  // Inscription d'un nouvel utilisateur (SANS EMAIL, AVEC BRANCHE)
  register: (req, res) => {
    const { username, password, nom, prenom, branche, role = 'member', service_assigne = null } = req.body;
    
    // Validation des données (sans email)
    if (!username || !password || !nom || !prenom || !branche) {
      return res.status(400).json({
        success: false,
        message: 'Veuillez fournir tous les champs requis: username, password, nom, prenom, branche'
      });
    }
    
    // Vérifier si l'username existe déjà
    db.get('SELECT id FROM users WHERE username = ?', 
      [username], 
      async (err, row) => {
        if (err) {
          console.error('❌ Erreur vérification utilisateur:', err);
          return res.status(500).json({
            success: false,
            message: 'Erreur serveur lors de l\'inscription'
          });
        }
        
        if (row) {
          return res.status(400).json({
            success: false,
            message: 'Ce nom d\'utilisateur est déjà utilisé'
          });
        }
        
        try {
          // Hasher le mot de passe
          const hashedPassword = await bcrypt.hash(password, 10);
          
          // Créer l'utilisateur (sans email, avec branche)
          db.run(
            'INSERT INTO users (username, password, nom, prenom, branche, role, service_assigne, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime("now"))',
            [username, hashedPassword, nom, prenom, branche, role, service_assigne],
            function(err) {
              if (err) {
                console.error('❌ Erreur création utilisateur:', err);
                return res.status(500).json({
                  success: false,
                  message: 'Erreur lors de la création du compte'
                });
              }
              
              // DEBUG: Log de création
              console.log(`✅ Compte créé: ${username} (ID: ${this.lastID})`);
              console.log(`   Rôle: ${role}, Service: ${service_assigne || 'Aucun'}`);
              
              // Générer le token JWT (INCLURE service_assigne)
              const token = jwt.sign(
                { 
                  id: this.lastID, 
                  username, 
                  nom, 
                  prenom, 
                  branche,
                  role: role,
                  service_assigne: service_assigne
                },
                process.env.JWT_SECRET,
                { expiresIn: '7d' }
              );
              
              res.status(201).json({
                success: true,
                message: 'Compte créé avec succès',
                token,
                user: {
                  id: this.lastID,
                  username,
                  nom,
                  prenom,
                  branche,
                  role: role,
                  service_assigne: service_assigne
                }
              });
            }
          );
        } catch (error) {
          console.error('❌ Erreur hash password:', error);
          res.status(500).json({
            success: false,
            message: 'Erreur serveur'
          });
        }
      }
    );
  },
  
  // Connexion - Accepte à la fois "username" et "login"
  login: (req, res) => {
    const { username, login, password } = req.body;
    
    // Accepte soit "username" soit "login" pour compatibilité
    const userIdentifier = username || login;
    
    if (!userIdentifier || !password) {
      return res.status(400).json({
        success: false,
        message: 'Veuillez fournir nom d\'utilisateur et mot de passe'
      });
    }
    
    console.log(`🔍 Tentative de connexion pour: ${userIdentifier}`);
    
    // Chercher l'utilisateur par username seulement
    db.get('SELECT * FROM users WHERE username = ?', 
      [userIdentifier], 
      async (err, user) => {
        if (err) {
          console.error('❌ Erreur recherche utilisateur:', err);
          return res.status(500).json({
            success: false,
            message: 'Erreur serveur'
          });
        }
        
        if (!user) {
          console.log(`❌ Utilisateur non trouvé: ${userIdentifier}`);
          return res.status(401).json({
            success: false,
            message: 'Identifiants incorrects'
          });
        }
        
        // DEBUG: Afficher l'utilisateur trouvé
        console.log(`✅ Utilisateur trouvé: ${user.username} (ID: ${user.id})`);
        console.log(`🔍 service_assigne dans DB: ${user.service_assigne}`);
        console.log(`🔍 Rôle dans DB: ${user.role}`);
        
        try {
          // Vérifier le mot de passe
          const isPasswordValid = await bcrypt.compare(password, user.password);
          
          if (!isPasswordValid) {
            console.log(`❌ Mot de passe incorrect pour: ${userIdentifier}`);
            return res.status(401).json({
              success: false,
              message: 'Identifiants incorrects'
            });
          }
          
          console.log(`✅ Mot de passe valide pour: ${user.username}`);
          
          // IMPORTANT: Inclure service_assigne dans le token JWT
          const tokenPayload = {
            id: user.id,
            username: user.username,
            nom: user.nom,
            prenom: user.prenom,
            branche: user.branche,
            role: user.role,
            service_assigne: user.service_assigne  // CRITIQUE !
          };
          
          console.log('🔍 Token payload:', tokenPayload);
          
          // Générer le token JWT
          const token = jwt.sign(
            tokenPayload,
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
          );
          
          // Préparer la réponse utilisateur
          const userResponse = {
            id: user.id,
            username: user.username,
            nom: user.nom,
            prenom: user.prenom,
            branche: user.branche,
            role: user.role,
            service_assigne: user.service_assigne,
            created_at: user.created_at
          };
          
          console.log(`✅ Connexion réussie pour: ${user.username}`);
          console.log(`🔍 Role: ${user.role}, Service: ${user.service_assigne || 'Aucun'}`);
          
          res.json({
            success: true,
            message: 'Connexion réussie',
            token,
            user: userResponse
          });
        } catch (error) {
          console.error('❌ Erreur comparaison password:', error);
          res.status(500).json({
            success: false,
            message: 'Erreur serveur'
          });
        }
      }
    );
  },
  
  // Récupérer le profil de l'utilisateur connecté
  getProfile: (req, res) => {
    console.log('🔍 getProfile appelé, user:', req.user);
    res.json({
      success: true,
      user: req.user
    });
  },
  
  // Vérifier le token (pour debug)
  verifyToken: (req, res) => {
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Token manquant'
      });
    }
    
    const token = authHeader.substring(7);
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('🔍 Token décodé:', decoded);
      
      res.json({
        success: true,
        decoded,
        hasServiceAssigne: 'service_assigne' in decoded,
        serviceAssigneValue: decoded.service_assigne
      });
    } catch (error) {
      res.status(401).json({
        success: false,
        message: 'Token invalide',
        error: error.message
      });
    }
  },

  // Vérifier le rôle de l'utilisateur
  checkRole: (req, res) => {
    console.log('🔍 checkRole appelé, user:', req.user);
    
    res.json({
      success: true,
      role: req.user.role,
      service_assigne: req.user.service_assigne,
      isAdmin: ['admin', 'super_admin'].includes(req.user.role),
      isBerger: req.user.role === 'berger',
      isSuperAdmin: req.user.role === 'super_admin',
      hasServiceAssigne: !!req.user.service_assigne
    });
  },

  // Créer un compte administrateur (pour tests)
  createAdmin: (req, res) => {
    const { username, password, nom, prenom, branche, service_assigne = null } = req.body;
    
    if (!username || !password || !nom || !prenom || !branche) {
      return res.status(400).json({
        success: false,
        message: 'Tous les champs sont requis'
      });
    }
    
    db.get('SELECT id FROM users WHERE username = ?', [username], async (err, row) => {
      if (err) {
        console.error('❌ Erreur vérification:', err);
        return res.status(500).json({ error: err.message });
      }
      
      if (row) {
        return res.status(400).json({
          success: false,
          message: 'Username déjà utilisé'
        });
      }
      
      try {
        const hashedPassword = await bcrypt.hash(password, 10);
        
        db.run(
          'INSERT INTO users (username, password, nom, prenom, branche, role, service_assigne, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime("now"))',
          [username, hashedPassword, nom, prenom, branche, 'admin', service_assigne],
          function(err) {
            if (err) {
              console.error('❌ Erreur création admin:', err);
              return res.status(500).json({ error: err.message });
            }
            
            console.log(`✅ Admin créé: ${username} (ID: ${this.lastID})`);
            
            res.json({
              success: true,
              message: 'Compte administrateur créé',
              userId: this.lastID,
              username: username,
              credentials: {
                username: username,
                password: password // Retourne pour test
              }
            });
          }
        );
      } catch (error) {
        console.error('❌ Erreur hash:', error);
        res.status(500).json({ error: error.message });
      }
    });
  },

  // Réinitialiser le mot de passe d'un utilisateur (admin seulement)
  resetPassword: (req, res) => {
    const { userId, newPassword } = req.body;
    
    if (!userId || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'User ID et nouveau mot de passe requis'
      });
    }
    
    // Vérifier que l'utilisateur qui fait la requête est admin
    if (!['admin', 'super_admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Permission refusée'
      });
    }
    
    bcrypt.hash(newPassword, 10, (err, hashedPassword) => {
      if (err) {
        console.error('❌ Erreur hash:', err);
        return res.status(500).json({ error: err.message });
      }
      
      db.run(
        'UPDATE users SET password = ? WHERE id = ?',
        [hashedPassword, userId],
        function(err) {
          if (err) {
            console.error('❌ Erreur mise à jour password:', err);
            return res.status(500).json({ error: err.message });
          }
          
          if (this.changes === 0) {
            return res.status(404).json({
              success: false,
              message: 'Utilisateur non trouvé'
            });
          }
          
          console.log(`✅ Mot de passe réinitialisé pour user ID: ${userId}`);
          
          res.json({
            success: true,
            message: 'Mot de passe réinitialisé avec succès'
          });
        }
      );
    });
  },

  // Liste tous les utilisateurs (admin seulement)
  getAllUsers: (req, res) => {
    if (!['admin', 'super_admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Permission refusée'
      });
    }
    
    db.all(
      'SELECT id, username, nom, prenom, branche, role, service_assigne, created_at FROM users ORDER BY created_at DESC',
      (err, users) => {
        if (err) {
          console.error('❌ Erreur récupération utilisateurs:', err);
          return res.status(500).json({ error: err.message });
        }
        
        res.json({
          success: true,
          users: users,
          count: users.length
        });
      }
    );
  },

  // Mettre à jour le profil utilisateur
  updateProfile: (req, res) => {
    const { nom, prenom, branche } = req.body;
    const userId = req.user.id;
    
    if (!nom || !prenom || !branche) {
      return res.status(400).json({
        success: false,
        message: 'Tous les champs sont requis'
      });
    }
    
    db.run(
      'UPDATE users SET nom = ?, prenom = ?, branche = ? WHERE id = ?',
      [nom, prenom, branche, userId],
      function(err) {
        if (err) {
          console.error('❌ Erreur mise à jour profil:', err);
          return res.status(500).json({ error: err.message });
        }
        
        // Regénérer le token avec les nouvelles infos
        const updatedUser = {
          ...req.user,
          nom,
          prenom,
          branche
        };
        
        const token = jwt.sign(
          updatedUser,
          process.env.JWT_SECRET,
          { expiresIn: '7d' }
        );
        
        console.log(`✅ Profil mis à jour pour: ${req.user.username}`);
        
        res.json({
          success: true,
          message: 'Profil mis à jour',
          token,
          user: updatedUser
        });
      }
    );
  },

  // Changement de mot de passe (par l'utilisateur lui-même)
  changePassword: (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Mot de passe actuel et nouveau mot de passe requis'
      });
    }
    
    // Récupérer l'utilisateur avec le mot de passe
    db.get('SELECT password FROM users WHERE id = ?', [userId], async (err, user) => {
      if (err) {
        console.error('❌ Erreur récupération utilisateur:', err);
        return res.status(500).json({ error: err.message });
      }
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Utilisateur non trouvé'
        });
      }
      
      try {
        // Vérifier le mot de passe actuel
        const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
        
        if (!isPasswordValid) {
          return res.status(401).json({
            success: false,
            message: 'Mot de passe actuel incorrect'
          });
        }
        
        // Hasher le nouveau mot de passe
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        // Mettre à jour
        db.run(
          'UPDATE users SET password = ? WHERE id = ?',
          [hashedPassword, userId],
          function(err) {
            if (err) {
              console.error('❌ Erreur mise à jour password:', err);
              return res.status(500).json({ error: err.message });
            }
            
            console.log(`✅ Mot de passe changé pour: ${req.user.username}`);
            
            res.json({
              success: true,
              message: 'Mot de passe changé avec succès'
            });
          }
        );
      } catch (error) {
        console.error('❌ Erreur comparaison password:', error);
        res.status(500).json({ error: error.message });
      }
    });
  }
};

module.exports = authController;