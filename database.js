const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const dbPath = path.join(__dirname, 'database.sqlite');

// Connexion à la base de données
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Erreur de connexion à la base de données:', err.message);
  } else {
    console.log('✅ Connecté à la base de données SQLite.');
    initDatabase();
  }
});

// Initialisation de la base de données
function initDatabase() {
  // Table des utilisateurs SANS email, AVEC branche
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    nom TEXT,
    prenom TEXT,
    branche TEXT,
    role TEXT DEFAULT 'member',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) {
      console.error('Erreur création table users:', err.message);
    } else {
      console.log('✅ Table users prête (sans email, avec branche)');
    }
  });

  // Table des membres
  db.run(`CREATE TABLE IF NOT EXISTS membres (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    nom TEXT NOT NULL,
    prenom TEXT NOT NULL,
    numero TEXT NOT NULL,
    quartier TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  )`, (err) => {
    if (err) {
      console.error('Erreur création table membres:', err.message);
    } else {
      console.log('✅ Table membres prête');
    }
  });

  // Créer les comptes administrateurs
  setTimeout(createAdminAccounts, 1000);
}

// Fonction pour créer les comptes administrateurs (SANS EMAIL)
async function createAdminAccounts() {
  console.log('🔄 Création des comptes administrateurs...');
  
  const admins = [
    { 
      username: 'Pasteur Abel Aké',
      password: process.env.ADMIN_PASSWORD_1, 
      nom: 'Abel', 
      prenom: 'Aké', 
      branche: 'Administration',
      role: 'admin' 
    },
    { 
      username: 'berger',
      password: process.env.ADMIN_PASSWORD_2, 
      nom: 'Berger', 
      prenom: 'Principal', 
      branche: 'Administration',
      role: 'admin' 
    }
  ];

  for (const admin of admins) {
    try {
      const hashedPassword = await bcrypt.hash(admin.password, 10);
      
      // MODIFIÉ : Vérification sans email
      db.get('SELECT * FROM users WHERE username = ?', 
        [admin.username], 
        async (err, row) => {
          if (err) {
            console.error(`❌ Erreur vérification admin ${admin.username}:`, err.message);
            return;
          }
          
          if (!row) {
            db.run(
              'INSERT INTO users (username, password, nom, prenom, branche, role) VALUES (?, ?, ?, ?, ?, ?)',
              [admin.username, hashedPassword, admin.nom, admin.prenom, admin.branche, admin.role],
              function(err) {
                if (err) {
                  console.error(`❌ Erreur création admin ${admin.username}:`, err.message);
                } else {
                  console.log(`✅ Compte admin ${admin.username} créé avec succès.`);
                  console.log(`   Identifiant: ${admin.username} / Mot de passe: ${admin.password}`);
                }
              }
            );
          } else {
            console.log(`ℹ️  Compte admin ${admin.username} existe déjà.`);
          }
        }
      );
    } catch (error) {
      console.error(`❌ Erreur lors du hash du mot de passe pour ${admin.username}:`, error);
    }
  }
}

module.exports = db;