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
          console.error('Erreur vérification utilisateur:', err);
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
            'INSERT INTO users (username, password, nom, prenom, branche, role) VALUES (?, ?, ?, ?, ?, ?)',
            [username, hashedPassword, nom, prenom, branche, 'member'],
            function(err) {
              if (err) {
                console.error('Erreur création utilisateur:', err);
                return res.status(500).json({
                  success: false,
                  message: 'Erreur lors de la création du compte'
                });
              }
              
              // Générer le token JWT (sans email, avec branche)
              const token = jwt.sign(
                { 
                  id: this.lastID, 
                  username, 
                  nom, 
                  prenom, 
                  branche,
                  role: 'member' 
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
                  role: 'member'
                }
              });
            }
          );
        } catch (error) {
          console.error('Erreur hash password:', error);
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
    
    // Chercher l'utilisateur par username seulement
    db.get('SELECT * FROM users WHERE username = ?', 
      [login], 
      async (err, user) => {
        if (err) {
          console.error('Erreur recherche utilisateur:', err);
          return res.status(500).json({
            success: false,
            message: 'Erreur serveur'
          });
        }
        
        if (!user) {
          return res.status(401).json({
            success: false,
            message: 'Identifiants incorrects'
          });
        }
        
        try {
          // Vérifier le mot de passe
          const isPasswordValid = await bcrypt.compare(password, user.password);
          
          if (!isPasswordValid) {
            return res.status(401).json({
              success: false,
              message: 'Identifiants incorrects'
            });
          }
          
          // Générer le token JWT (sans email, avec branche)
          const token = jwt.sign(
            { 
              id: user.id, 
              username: user.username, 
              nom: user.nom, 
              prenom: user.prenom, 
              branche: user.branche,
              role: user.role 
            },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
          );
          
          res.json({
            success: true,
            message: 'Connexion réussie',
            token,
            user: {
              id: user.id,
              username: user.username,
              nom: user.nom,
              prenom: user.prenom,
              branche: user.branche,
              role: user.role
            }
          });
        } catch (error) {
          console.error('Erreur comparaison password:', error);
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
    res.json({
      success: true,
      user: req.user
    });
  }
};

module.exports = authController;