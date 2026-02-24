// backend/database.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');
const fs = require('fs');
require('dotenv').config();

// ============================================
// CONFIGURATION DU CHEMIN DE LA BASE DE DONNÉES
// ============================================
const isProduction = process.env.NODE_ENV === 'production';
const isRender = isProduction && process.env.RENDER;

let dbPath;

if (isRender) {
  // SUR RENDER : utiliser le dossier /tmp (accessible en écriture)
  // IMPORTANT: Les données seront perdues au redémarrage du service
  dbPath = path.join('/tmp', 'database.sqlite');
  console.log('📍 Mode: Production sur Render');
  console.log('📁 Chemin Render (temporaire): /tmp/database.sqlite');
  console.log('⚠️  Attention: La base de données sera réinitialisée à chaque redémarrage !');
  
  // Vérifier que le dossier /tmp existe (il existe toujours sur Render)
  try {
    if (!fs.existsSync('/tmp')) {
      fs.mkdirSync('/tmp', { recursive: true });
      console.log('📁 Dossier /tmp créé');
    } else {
      console.log('📁 Dossier /tmp existe déjà');
    }
  } catch (error) {
    console.error('❌ Erreur accès /tmp:', error.message);
  }
} else if (isProduction) {
  // PRODUCTION AILLEURS
  dbPath = path.join(__dirname, 'database.sqlite');
  console.log('📍 Mode: Production autre');
} else {
  // DÉVELOPPEMENT LOCAL
  dbPath = path.join(__dirname, 'database.sqlite');
  console.log('📍 Mode: Développement local');
}

console.log(`📁 Base de données: ${dbPath}`);

// ============================================
// CONNEXION À LA BASE DE DONNÉES
// ============================================
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Erreur de connexion à la base de données:', err.message);
  } else {
    console.log('✅ Connecté à la base de données SQLite.');
    initDatabase();
  }
});

// ============================================
// INITIALISATION DE LA BASE DE DONNÉES
// ============================================
function initDatabase() {
  // Table des utilisateurs AVEC service_assigne pour les bergers
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    nom TEXT,
    prenom TEXT,
    branche TEXT,
    role TEXT DEFAULT 'member',
    service_assigne TEXT,  -- CRITIQUE: service assigné pour les bergers
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) {
      console.error('❌ Erreur création table users:', err.message);
    } else {
      console.log('✅ Table users prête (avec service_assigne)');
    }
  });

  // Table des services (pour standardisation)
  db.run(`CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nom TEXT UNIQUE NOT NULL,
    nom_court TEXT UNIQUE,
    description TEXT,
    responsable_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (responsable_id) REFERENCES users (id)
  )`, (err) => {
    if (err) {
      console.error('❌ Erreur création table services:', err.message);
    } else {
      console.log('✅ Table services prête');
    }
  });

  // Table des membres AVEC service
  db.run(`CREATE TABLE IF NOT EXISTS membres (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    nom TEXT NOT NULL,
    prenom TEXT NOT NULL,
    numero TEXT NOT NULL,
    quartier TEXT NOT NULL,
    service TEXT NOT NULL,  -- Champ service obligatoire
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  )`, (err) => {
    if (err) {
      console.error('❌ Erreur création table membres:', err.message);
    } else {
      console.log('✅ Table membres prête (avec service)');
    }
  });

  // Table des présences
  db.run(`CREATE TABLE IF NOT EXISTS presences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    membre_id INTEGER NOT NULL,
    berger_id INTEGER NOT NULL,
    date DATE NOT NULL,
    present BOOLEAN DEFAULT 1,
    commentaire TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (membre_id) REFERENCES membres (id),
    FOREIGN KEY (berger_id) REFERENCES users (id),
    UNIQUE(membre_id, date)
  )`, (err) => {
    if (err) {
      console.error('❌ Erreur création table presences:', err.message);
    } else {
      console.log('✅ Table presences prête');
    }
  });

  // Créer les comptes administrateurs ET bergers
  setTimeout(() => {
    createDefaultServices();
    createAllAccounts();
  }, 1000);
}

// ============================================
// CRÉER LES SERVICES PAR DÉFAUT
// ============================================
function createDefaultServices() {
  const services = [
    { nom: 'Groupe de louange et d\'adoration (GLA)', nom_court: 'GLA' },
    { nom: 'Voir et Entendre', nom_court: 'VE' },
    { nom: 'Communication', nom_court: 'COM' },
    { nom: '28:19', nom_court: '28:19' },
    { nom: 'Suivi', nom_court: 'SUIVI' },
    { nom: 'Service d\'ordre', nom_court: 'SO' },
    { nom: 'Protocole', nom_court: 'PO' },
    { nom: 'Logistique', nom_court: 'LO' },
    { nom: 'Service Book', nom_court: 'SB' },
    { nom: 'Gestion de culte', nom_court: 'GC' }
  ];

  console.log('🔄 Création des services...');
  
  services.forEach(service => {
    db.run(
      'INSERT OR IGNORE INTO services (nom, nom_court) VALUES (?, ?)',
      [service.nom, service.nom_court],
      function(err) {
        if (err) {
          console.error(`❌ Erreur création service ${service.nom}:`, err.message);
        } else if (this.changes > 0) {
          console.log(`✅ Service créé: ${service.nom} (${service.nom_court})`);
        }
      }
    );
  });
}

// ============================================
// CRÉER TOUS LES COMPTES
// ============================================
async function createAllAccounts() {
  console.log('\n🔄 Création des comptes administrateurs et bergers...');
  
  const accounts = [
    // Super administrateurs
    { 
      username: process.env.ADMIN_USERNAME_1 || 'Pasteur Abel Aké',
      password: process.env.ADMIN_PASSWORD_1 || 'Admin12345', 
      nom: 'Abel', 
      prenom: 'Aké', 
      branche: 'Administration',
      role: 'super_admin',
      service_assigne: null
    },
    { 
      username: process.env.ADMIN_USERNAME_2 || 'berger',
      password: process.env.ADMIN_PASSWORD_2 || 'Admin12345', 
      nom: 'Berger', 
      prenom: 'Principal', 
      branche: 'Administration',
      role: 'super_admin',
      service_assigne: null
    },
    
    // Bergers avec service_assigne
    { 
      username: 'berger GLA',
      password: process.env.BERGER_GLA_PASSWORD || 'GLA12345',
      nom: 'GLA',
      prenom: 'Berger',
      branche: 'Groupe de louange et d\'adoration',
      role: 'berger',
      service_assigne: 'Groupe de louange et d\'adoration (GLA)'
    },
    { 
      username: 'berger VE',
      password: process.env.BERGER_VE_PASSWORD || 'VE12345',
      nom: 'VE',
      prenom: 'Berger',
      branche: 'Voir et Entendre',
      role: 'berger',
      service_assigne: 'Voir et Entendre'
    },
    { 
      username: 'berger COM',
      password: process.env.BERGER_COM_PASSWORD || 'COM12345',
      nom: 'COM',
      prenom: 'Berger',
      branche: 'Communication',
      role: 'berger',
      service_assigne: 'Communication'
    },
    { 
      username: 'berger 28:19',
      password: process.env.BERGER_2819_PASSWORD || '281912345',
      nom: '28:19',
      prenom: 'Berger',
      branche: '28:19',
      role: 'berger',
      service_assigne: '28:19'
    },
    { 
      username: 'berger suivi',
      password: process.env.BERGER_SUIVI_PASSWORD || 'SUIVI12345',
      nom: 'Suivi',
      prenom: 'Berger',
      branche: 'Suivi',
      role: 'berger',
      service_assigne: 'Suivi'
    },
    { 
      username: 'berger SO',
      password: process.env.BERGER_SO_PASSWORD || 'SO12345',
      nom: 'SO',
      prenom: 'Berger',
      branche: 'Service d\'ordre',
      role: 'berger',
      service_assigne: 'Service d\'ordre'
    },
    { 
      username: 'berger PO',
      password: process.env.BERGER_PO_PASSWORD || 'PO12345',
      nom: 'PO',
      prenom: 'Berger',
      branche: 'Protocole',
      role: 'berger',
      service_assigne: 'Protocole'
    },
    { 
      username: 'berger LO',
      password: process.env.BERGER_LO_PASSWORD || 'LO12345',
      nom: 'LO',
      prenom: 'Berger',
      branche: 'Logistique',
      role: 'berger',
      service_assigne: 'Logistique'
    },
    { 
      username: 'berger SB',
      password: process.env.BERGER_SB_PASSWORD || 'SB12345',
      nom: 'SB',
      prenom: 'Berger',
      branche: 'Service Book',
      role: 'berger',
      service_assigne: 'Service Book'
    },
    { 
      username: 'berger GC',
      password: process.env.BERGER_GC_PASSWORD || 'GC12345',
      nom: 'GC',
      prenom: 'Berger',
      branche: 'Gestion de culte',
      role: 'berger',
      service_assigne: 'Gestion de culte'
    }
  ];

  for (const account of accounts) {
    try {
      const hashedPassword = await bcrypt.hash(account.password, 10);
      
      // Vérifier si le compte existe déjà
      db.get('SELECT * FROM users WHERE username = ?', 
        [account.username], 
        async (err, row) => {
          if (err) {
            console.error(`❌ Erreur vérification ${account.username}:`, err.message);
            return;
          }
          
          if (!row) {
            // Créer le compte
            db.run(
              'INSERT INTO users (username, password, nom, prenom, branche, role, service_assigne) VALUES (?, ?, ?, ?, ?, ?, ?)',
              [
                account.username,
                hashedPassword,
                account.nom,
                account.prenom,
                account.branche,
                account.role,
                account.service_assigne
              ],
              function(err) {
                if (err) {
                  console.error(`❌ Erreur création ${account.username}:`, err.message);
                } else {
                  console.log(`✅ Compte ${account.username} créé (rôle: ${account.role})`);
                  if (account.role === 'berger') {
                    console.log(`   Service assigné: ${account.service_assigne}`);
                  }
                }
              }
            );
          } else {
            // Mettre à jour si nécessaire
            const needsUpdate = 
              row.role !== account.role || 
              row.service_assigne !== account.service_assigne;
            
            if (needsUpdate) {
              db.run(
                'UPDATE users SET role = ?, service_assigne = ? WHERE username = ?',
                [account.role, account.service_assigne, account.username],
                function(err) {
                  if (err) {
                    console.error(`❌ Erreur mise à jour ${account.username}:`, err.message);
                  } else if (this.changes > 0) {
                    console.log(`🔄 Compte ${account.username} mis à jour`);
                    console.log(`   Rôle: ${row.role} → ${account.role}`);
                    console.log(`   Service: ${row.service_assigne} → ${account.service_assigne}`);
                  }
                }
              );
            } else {
              console.log(`ℹ️  Compte ${account.username} existe déjà.`);
              console.log(`   Rôle: ${row.role}, Service: ${row.service_assigne}`);
            }
          }
        }
      );
    } catch (error) {
      console.error(`❌ Erreur lors du hash pour ${account.username}:`, error);
    }
  }
}

// ============================================
// FONCTION DE NORMALISATION DES SERVICES
// ============================================
function normalizeServiceName(serviceName) {
  if (!serviceName) return null;
  
  const serviceMapping = {
    'gla': 'Groupe de louange et d\'adoration (GLA)',
    'groupe de louange': 'Groupe de louange et d\'adoration (GLA)',
    'groupe de louange et d\'adoration': 'Groupe de louange et d\'adoration (GLA)',
    've': 'Voir et Entendre',
    'voir et entendre': 'Voir et Entendre',
    'com': 'Communication',
    'communication': 'Communication',
    '2819': '28:19',
    '28:19': '28:19',
    'suivi': 'Suivi',
    'so': 'Service d\'ordre',
    'service d\'ordre': 'Service d\'ordre',
    'po': 'Protocole',
    'protocole': 'Protocole',
    'lo': 'Logistique',
    'logistique': 'Logistique',
    'sb': 'Service Book',
    'service book': 'Service Book',
    'gc': 'Gestion de culte',
    'gestion de culte': 'Gestion de culte'
  };
  
  const normalized = serviceName.trim().toLowerCase();
  return serviceMapping[normalized] || serviceName.trim();
}

// ============================================
// VÉRIFICATION DES BERGERS (debug)
// ============================================
function checkBergersStatus() {
  console.log('\n🔍 Vérification des bergers...');
  
  db.all('SELECT id, username, role, service_assigne FROM users WHERE role = "berger"', (err, bergers) => {
    if (err) {
      console.error('❌ Erreur vérification bergers:', err);
      return;
    }
    
    console.log(`📊 ${bergers.length} bergers trouvés:`);
    bergers.forEach(berger => {
      const status = berger.service_assigne ? '✅' : '❌';
      console.log(`   ${status} ${berger.username}: ${berger.service_assigne || 'AUCUN SERVICE'}`);
    });
    
    // Vérifier aussi les membres par service
    db.all('SELECT service, COUNT(*) as count FROM membres GROUP BY service', (err, services) => {
      if (!err) {
        console.log('\n📊 Membres par service:');
        services.forEach(s => {
          console.log(`   ${s.service}: ${s.count} membres`);
        });
      }
    });
  });
}

// Exécuter la vérification après un délai
setTimeout(checkBergersStatus, 3000);

// ============================================
// EXPORTATION
// ============================================
module.exports = db;
module.exports.normalizeServiceName = normalizeServiceName;