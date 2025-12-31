const db = require('../database');
const { normalizeServiceName } = require('../database');

class Member {
  // Créer un nouveau membre (avec service normalisé)
  static create(membreData, callback) {
    const { user_id, nom, prenom, numero, quartier, service } = membreData;
    
    // NORMALISATION AUTOMATIQUE du service
    const normalizedService = normalizeServiceName(service);
    
    console.log(`📝 Création membre:`);
    console.log(`   Service fourni: "${service}"`);
    console.log(`   Service normalisé: "${normalizedService}"`);
    
    // Validation : le service est obligatoire
    if (!normalizedService) {
      const error = new Error('Le service est requis');
      console.error('❌ Erreur création membre: service manquant ou invalide');
      callback(error, null);
      return;
    }
    
    db.run(
      'INSERT INTO membres (user_id, nom, prenom, numero, quartier, service) VALUES (?, ?, ?, ?, ?, ?)',
      [user_id, nom, prenom, numero, quartier, normalizedService],
      function(err) {
        if (err) {
          console.error('❌ Erreur création membre:', err);
          callback(err, null);
        } else {
          console.log(`✅ Membre créé avec succès (ID: ${this.lastID})`);
          console.log(`   Service: "${normalizedService}"`);
          callback(null, { 
            id: this.lastID, 
            ...membreData,
            service: normalizedService
          });
        }
      }
    );
  }
  
  // Récupérer tous les membres (pour super_admin et admin)
  static getAll(callback) {
    db.all(
      `SELECT m.*, u.username, u.branche, u.role 
       FROM membres m 
       LEFT JOIN users u ON m.user_id = u.id 
       ORDER BY m.created_at DESC`,
      (err, rows) => {
        if (err) {
          console.error('❌ Erreur récupération membres:', err);
          callback(err, null);
        } else {
          callback(null, rows);
        }
      }
    );
  }
  
  // Récupérer les membres d'un utilisateur spécifique
  static getByUserId(userId, callback) {
    db.all(
      'SELECT * FROM membres WHERE user_id = ? ORDER BY created_at DESC',
      [userId],
      (err, rows) => {
        if (err) {
          console.error('❌ Erreur récupération membres par user_id:', err);
          callback(err, null);
        } else {
          callback(null, rows);
        }
      }
    );
  }
  
  // Récupérer tous les utilisateurs (pour admin)
  static getAllUsers(callback) {
    db.all(
      `SELECT id, username, nom, prenom, branche, role, service_assigne, created_at 
       FROM users 
       ORDER BY created_at DESC`,
      (err, rows) => {
        if (err) {
          console.error('❌ Erreur récupération utilisateurs:', err);
          callback(err, null);
        } else {
          callback(null, rows);
        }
      }
    );
  }
  
  // Récupérer les membres pour un berger spécifique - VERSION AMÉLIORÉE
  static getForBerger(serviceAssigne, callback) {
    if (!serviceAssigne) {
      console.error('❌ Erreur: Service assigné manquant');
      return callback(new Error('Service assigné manquant'), null);
    }
    
    console.log(`🔍 Recherche membres pour service: "${serviceAssigne}"`);
    
    // Normaliser le service assigné
    const normalizedService = normalizeServiceName(serviceAssigne);
    console.log(`🔍 Service normalisé: "${normalizedService}"`);
    
    // RECHERCHE FLEXIBLE - Toutes les variations possibles
    // 1. Chercher le service exact
    // 2. Chercher le nom court
    // 3. Chercher avec LIKE pour les variations (avec/sans articles)
    
    // Obtenir le nom court du service depuis la table services
    db.get('SELECT nom_court FROM services WHERE nom = ?', [normalizedService], (err, serviceRow) => {
      if (err) {
        console.error('❌ Erreur récupération service:', err);
      }
      
      // Construire la liste des termes de recherche
      const searchTerms = [normalizedService];
      const likeTerms = [`%${normalizedService}%`];
      
      // Ajouter le nom court si disponible
      if (serviceRow && serviceRow.nom_court) {
        searchTerms.push(serviceRow.nom_court);
        likeTerms.push(`%${serviceRow.nom_court}%`);
      }
      
      // Ajouter des variations courantes avec articles
      if (normalizedService.includes('Communication')) {
        likeTerms.push('%La communication%');
        likeTerms.push('%communication%');
      }
      if (normalizedService.includes('Protocole')) {
        likeTerms.push('%Le protocole%');
        likeTerms.push('%protocole%');
      }
      if (normalizedService.includes('Logistique')) {
        likeTerms.push('%La logistique%');
        likeTerms.push('%logistique%');
      }
      if (normalizedService.includes('Service Book')) {
        likeTerms.push('%Le Service Book%');
        likeTerms.push('%service book%');
      }
      if (normalizedService.includes('Gestion de culte')) {
        likeTerms.push('%La gestion de culte%');
        likeTerms.push('%gestion de culte%');
      }
      if (normalizedService.includes('Service d\'ordre')) {
        likeTerms.push('%Le service d\'ordre%');
        likeTerms.push('%service d\'ordre%');
      }
      
      // Combiner tous les termes de recherche uniques
      const allSearchTerms = [...new Set([...searchTerms, ...likeTerms])];
      
      // Construire la clause WHERE
      let whereClauses = [];
      let params = [];
      
      // Termes exacts
      if (searchTerms.length > 0) {
        const exactPlaceholders = searchTerms.map(() => '?').join(', ');
        whereClauses.push(`m.service IN (${exactPlaceholders})`);
        params.push(...searchTerms);
      }
      
      // Termes LIKE
      if (likeTerms.length > 0) {
        const likeConditions = likeTerms.map(() => 'm.service LIKE ?').join(' OR ');
        whereClauses.push(`(${likeConditions})`);
        params.push(...likeTerms);
      }
      
      const whereClause = whereClauses.join(' OR ');
      
      const sql = `
        SELECT m.*, u.username, u.branche 
        FROM membres m 
        LEFT JOIN users u ON m.user_id = u.id 
        WHERE ${whereClause}
        ORDER BY m.created_at DESC
      `;
      
      console.log(`🔍 SQL: ${sql}`);
      console.log(`🔍 Params (${params.length}):`, params);
      
      db.all(sql, params, (err, rows) => {
        if (err) {
          console.error('❌ Erreur récupération membres pour berger:', err);
          callback(err, null);
        } else {
          console.log(`✅ ${rows.length} membres trouvés pour service: "${normalizedService}"`);
          
          if (rows.length === 0) {
            // Debug: Voir ce qu'il y a dans la base
            db.all(
              'SELECT DISTINCT service FROM membres ORDER BY service',
              (err, allServices) => {
                if (!err) {
                  console.log(`🔍 Services disponibles dans la base:`, allServices.map(s => s.service));
                }
              }
            );
          }
          
          callback(null, rows);
        }
      });
    });
  }
  
  // Récupérer les membres par service exact
  static getByService(service, callback) {
    const normalizedService = normalizeServiceName(service);
    
    db.all(
      `SELECT m.*, u.username, u.branche 
       FROM membres m 
       LEFT JOIN users u ON m.user_id = u.id 
       WHERE m.service = ?
       ORDER BY m.created_at DESC`,
      [normalizedService],
      (err, rows) => {
        if (err) {
          console.error('❌ Erreur récupération membres par service:', err);
          callback(err, null);
        } else {
          callback(null, rows);
        }
      }
    );
  }
  
  // Récupérer les statistiques par service
  static getStatsByService(service, callback) {
    const normalizedService = normalizeServiceName(service);
    
    db.get(
      `SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN date(created_at) = date('now') THEN 1 END) as aujourdhui,
        COUNT(CASE WHEN created_at >= datetime('now', '-7 days') THEN 1 END) as cette_semaine
       FROM membres 
       WHERE service = ?`,
      [normalizedService],
      (err, row) => {
        if (err) {
          console.error('❌ Erreur récupération stats par service:', err);
          callback(err, null);
        } else {
          callback(null, row);
        }
      }
    );
  }
  
  // Vérifier si un membre existe déjà pour un utilisateur
  static existsForUser(userId, nom, prenom, callback) {
    db.get(
      'SELECT id FROM membres WHERE user_id = ? AND nom = ? AND prenom = ?',
      [userId, nom, prenom],
      (err, row) => {
        if (err) {
          console.error('❌ Erreur vérification membre:', err);
          callback(err, null);
        } else {
          callback(null, !!row);
        }
      }
    );
  }
  
  // Mettre à jour un membre
  static update(id, updates, userId, userRole, callback) {
    // Normaliser le service si présent
    if (updates.service) {
      updates.service = normalizeServiceName(updates.service);
      console.log(`🔄 Mise à jour membre ${id}: service normalisé à "${updates.service}"`);
    }
    
    let query = 'UPDATE membres SET ';
    const fields = [];
    const values = [];
    
    Object.keys(updates).forEach(key => {
      fields.push(`${key} = ?`);
      values.push(updates[key]);
    });
    
    values.push(id);
    
    // Si l'utilisateur n'est pas admin ou super_admin, vérifier qu'il est le propriétaire
    if (!['admin', 'super_admin'].includes(userRole)) {
      query += fields.join(', ') + ' WHERE id = ? AND user_id = ?';
      values.push(userId);
    } else {
      query += fields.join(', ') + ' WHERE id = ?';
    }
    
    console.log(`🔍 Update query: ${query}`);
    console.log(`🔍 Update values:`, values);
    
    db.run(query, values, function(err) {
      if (err) {
        console.error('❌ Erreur mise à jour membre:', err);
        callback(err, null);
      } else {
        callback(null, { updated: this.changes > 0 });
      }
    });
  }
  
  // Récupérer un membre par ID
  static getById(id, userId, userRole, callback) {
    let query = 'SELECT m.*, u.username, u.branche FROM membres m LEFT JOIN users u ON m.user_id = u.id WHERE m.id = ?';
    const params = [id];
    
    if (!['admin', 'super_admin'].includes(userRole)) {
      query += ' AND m.user_id = ?';
      params.push(userId);
    }
    
    db.get(query, params, (err, row) => {
      if (err) {
        console.error('❌ Erreur récupération membre:', err);
        callback(err, null);
      } else {
        callback(null, row);
      }
    });
  }
  
  // Supprimer un membre (admin seulement)
  static delete(id, callback) {
    db.run(
      'DELETE FROM membres WHERE id = ?',
      [id],
      function(err) {
        if (err) {
          console.error('❌ Erreur suppression membre:', err);
          callback(err, null);
        } else {
          callback(null, { deleted: this.changes > 0 });
        }
      }
    );
  }
  
  // Supprimer un utilisateur (admin seulement)
  static deleteUser(id, callback) {
    db.run(
      'DELETE FROM users WHERE id = ?',
      [id],
      function(err) {
        if (err) {
          console.error('❌ Erreur suppression utilisateur:', err);
          callback(err, null);
        } else {
          // Supprimer aussi les membres associés
          db.run(
            'DELETE FROM membres WHERE user_id = ?',
            [id],
            function(err2) {
              if (err2) {
                console.error('❌ Erreur suppression membres associés:', err2);
              }
              callback(null, { deleted: this.changes > 0 });
            }
          );
        }
      }
    );
  }
  
  // Mettre à jour le rôle d'un utilisateur (admin seulement)
  static updateUserRole(id, role, callback) {
    db.run(
      'UPDATE users SET role = ? WHERE id = ?',
      [role, id],
      function(err) {
        if (err) {
          console.error('❌ Erreur mise à jour rôle:', err);
          callback(err, null);
        } else {
          callback(null, { updated: this.changes > 0 });
        }
      }
    );
  }
  
  // Récupérer tous les bergers
  static getAllBergers(callback) {
    db.all(
      `SELECT id, username, nom, prenom, branche, service_assigne, created_at 
       FROM users 
       WHERE role = 'berger'
       ORDER BY username`,
      (err, rows) => {
        if (err) {
          console.error('❌ Erreur récupération bergers:', err);
          callback(err, null);
        } else {
          callback(null, rows);
        }
      }
    );
  }
  
  // Récupérer tous les services
  static getAllServices(callback) {
    db.all(
      `SELECT s.*, 
              u.username as responsable_nom,
              COUNT(m.id) as total_membres
       FROM services s
       LEFT JOIN users u ON s.responsable_id = u.id
       LEFT JOIN membres m ON m.service = s.nom
       GROUP BY s.id
       ORDER BY s.nom`,
      (err, rows) => {
        if (err) {
          console.error('❌ Erreur récupération services:', err);
          callback(err, null);
        } else {
          callback(null, rows);
        }
      }
    );
  }
  
  // Récupérer les statistiques par tous les services
  static getStatsByAllServices(callback) {
    db.all(
      `SELECT 
        service,
        COUNT(*) as total,
        COUNT(CASE WHEN date(created_at) = date('now') THEN 1 END) as aujourdhui,
        COUNT(CASE WHEN created_at >= datetime('now', '-7 days') THEN 1 END) as cette_semaine
       FROM membres 
       GROUP BY service
       ORDER BY total DESC`,
      (err, rows) => {
        if (err) {
          console.error('❌ Erreur récupération stats services:', err);
          callback(err, null);
        } else {
          callback(null, rows);
        }
      }
    );
  }
  
  // Normaliser les services existants
  static normalizeAllServices(callback) {
    console.log('🔄 Normalisation des services existants...');
    
    db.all('SELECT id, service FROM membres', (err, rows) => {
      if (err) {
        console.error('❌ Erreur récupération services:', err);
        return callback(err);
      }
      
      let updated = 0;
      rows.forEach(row => {
        const normalized = normalizeServiceName(row.service);
        if (normalized !== row.service) {
          db.run(
            'UPDATE membres SET service = ? WHERE id = ?',
            [normalized, row.id],
            function(err) {
              if (err) {
                console.error(`❌ Erreur normalisation membre ${row.id}:`, err);
              } else if (this.changes > 0) {
                updated++;
                console.log(`✅ ${row.id}: "${row.service}" → "${normalized}"`);
              }
            }
          );
        }
      });
      
      setTimeout(() => {
        console.log(`✅ Normalisation terminée: ${updated} services mis à jour`);
        callback(null, { updated });
      }, 1000);
    });
  }
  
  // Debug: Voir tous les services et leurs membres
  static debugServices(callback) {
    console.log('\n🔍 DEBUG: Analyse complète des services...');
    
    db.all(
      `SELECT 
        m.service,
        COUNT(*) as total_membres,
        GROUP_CONCAT(m.nom || ' ' || m.prenom, ', ') as membres_noms
       FROM membres m
       GROUP BY m.service
       ORDER BY m.service`,
      (err, rows) => {
        if (err) {
          console.error('❌ Erreur debug services:', err);
          callback(err, null);
        } else {
          console.log(`📊 ${rows.length} services avec membres:`);
          rows.forEach(row => {
            console.log(`   • ${row.service}: ${row.total_membres} membres`);
          });
          callback(null, rows);
        }
      }
    );
  }
}

module.exports = Member;