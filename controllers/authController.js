const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database');
require('dotenv').config();

const authController = {
  // Inscription d'un nouvel utilisateur (SANS EMAIL, AVEC BRANCHE)
  register: (req, res) => {
    const { username, password, nom, prenom, branche } = req.body;
    
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
            'INSERT INTO users (username, password, nom, prenom, branche, role, service_assigne) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [username, hashedPassword, nom, prenom, branche, 'member', null],
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
              
              // Générer le token JWT (INCLURE service_assigne)
              const token = jwt.sign(
                { 
                  id: this.lastID, 
                  username, 
                  nom, 
                  prenom, 
                  branche,
                  role: 'member',
                  service_assigne: null  // Les membres normaux n'ont pas de service
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
                  role: 'member',
                  service_assigne: null
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
  
  // Connexion avec username seulement (SANS EMAIL)
  login: (req, res) => {
    const { login, password } = req.body;
    
    if (!login || !password) {
      return res.status(400).json({
        success: false,
        message: 'Veuillez fournir nom d\'utilisateur et mot de passe'
      });
    }
    
    console.log(`🔍 Tentative de connexion pour: ${login}`);
    
    // Chercher l'utilisateur par username seulement
    db.get('SELECT * FROM users WHERE username = ?', 
      [login], 
      async (err, user) => {
        if (err) {
          console.error('❌ Erreur recherche utilisateur:', err);
          return res.status(500).json({
            success: false,
            message: 'Erreur serveur'
          });
        }
        
        if (!user) {
          console.log(`❌ Utilisateur non trouvé: ${login}`);
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
            console.log(`❌ Mot de passe incorrect pour: ${login}`);
            return res.status(401).json({
              success: false,
              message: 'Identifiants incorrects'
            });
          }
          
          console.log(`✅ Mot de passe valide pour: ${login}`);
          
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
            service_assigne: user.service_assigne
          };
          
          console.log(`✅ Connexion réussie pour: ${user.username}`);
          console.log(`🔍 Role: ${user.role}, Service: ${user.service_assigne}`);
          
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
  }
};

module.exports = authController;