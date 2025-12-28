const db = require('../database');

class Member {
  // Créer un nouveau membre
  static create(membreData, callback) {
    const { user_id, nom, prenom, numero, quartier } = membreData;
    
    db.run(
      'INSERT INTO membres (user_id, nom, prenom, numero, quartier) VALUES (?, ?, ?, ?, ?)',
      [user_id, nom, prenom, numero, quartier],
      function(err) {
        if (err) {
          console.error('Erreur création membre:', err);
          callback(err, null);
        } else {
          callback(null, { 
            id: this.lastID, 
            ...membreData 
          });
        }
      }
    );
  }
  
  // Récupérer tous les membres (pour admin) - MODIFIÉ
  static getAll(callback) {
    db.all(
      `SELECT m.*, u.username, u.branche, u.role 
       FROM membres m 
       LEFT JOIN users u ON m.user_id = u.id 
       ORDER BY m.created_at DESC`,
      (err, rows) => {
        if (err) {
          console.error('Erreur récupération membres:', err);
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
          console.error('Erreur récupération membres par user_id:', err);
          callback(err, null);
        } else {
          callback(null, rows);
        }
      }
    );
  }
  
  // Récupérer tous les utilisateurs (pour admin) - MODIFIÉ
  static getAllUsers(callback) {
    db.all(
      `SELECT id, username, nom, prenom, branche, role, created_at 
       FROM users 
       ORDER BY created_at DESC`,
      (err, rows) => {
        if (err) {
          console.error('Erreur récupération utilisateurs:', err);
          callback(err, null);
        } else {
          callback(null, rows);
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
          console.error('Erreur vérification membre:', err);
          callback(err, null);
        } else {
          callback(null, !!row);
        }
      }
    );
  }
  
  // NOUVELLE MÉTHODE : Mettre à jour un membre
  static update(id, updates, userId, userRole, callback) {
    // Vérifier les permissions
    let query = 'UPDATE membres SET ';
    const fields = [];
    const values = [];
    
    Object.keys(updates).forEach(key => {
      fields.push(`${key} = ?`);
      values.push(updates[key]);
    });
    
    values.push(id);
    
    // Si l'utilisateur n'est pas admin, vérifier qu'il est le propriétaire
    if (userRole !== 'admin') {
      query += fields.join(', ') + ' WHERE id = ? AND user_id = ?';
      values.push(userId);
    } else {
      query += fields.join(', ') + ' WHERE id = ?';
    }
    
    db.run(query, values, function(err) {
      if (err) {
        console.error('Erreur mise à jour membre:', err);
        callback(err, null);
      } else {
        callback(null, { updated: this.changes > 0 });
      }
    });
  }
  
  // NOUVELLE MÉTHODE : Récupérer un membre par ID
  static getById(id, userId, userRole, callback) {
    let query = 'SELECT m.*, u.username, u.branche FROM membres m LEFT JOIN users u ON m.user_id = u.id WHERE m.id = ?';
    const params = [id];
    
    if (userRole !== 'admin') {
      query += ' AND m.user_id = ?';
      params.push(userId);
    }
    
    db.get(query, params, (err, row) => {
      if (err) {
        console.error('Erreur récupération membre:', err);
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
          console.error('Erreur suppression membre:', err);
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
          console.error('Erreur suppression utilisateur:', err);
          callback(err, null);
        } else {
          // Supprimer aussi les membres associés
          db.run(
            'DELETE FROM membres WHERE user_id = ?',
            [id],
            function(err2) {
              if (err2) {
                console.error('Erreur suppression membres associés:', err2);
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
          console.error('Erreur mise à jour rôle:', err);
          callback(err, null);
        } else {
          callback(null, { updated: this.changes > 0 });
        }
      }
    );
  }
}

module.exports = Member;