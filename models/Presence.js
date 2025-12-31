const db = require('../database');

class Presence {
  // Enregistrer une présence
  static recordPresence(presenceData, callback) {
    const { membre_id, berger_id, date, present, commentaire } = presenceData;
    
    db.run(
      `INSERT INTO presences (membre_id, berger_id, date, present, commentaire) 
       VALUES (?, ?, ?, ?, ?) 
       ON CONFLICT(membre_id, date) 
       DO UPDATE SET present = ?, commentaire = ?, created_at = CURRENT_TIMESTAMP`,
      [membre_id, berger_id, date, present, commentaire, present, commentaire],
      function(err) {
        if (err) {
          console.error('❌ Erreur enregistrement présence:', err);
          callback(err, null);
        } else {
          callback(null, { 
            id: this.lastID, 
            ...presenceData,
            updated: this.changes > 0
          });
        }
      }
    );
  }

  // Récupérer les présences d'un service pour une date
  static getPresencesByServiceAndDate(service, date, callback) {
    db.all(
      `SELECT p.*, m.nom, m.prenom, m.quartier, m.service
       FROM presences p
       JOIN membres m ON p.membre_id = m.id
       WHERE m.service = ? AND p.date = ?
       ORDER BY m.nom, m.prenom`,
      [service, date],
      (err, rows) => {
        if (err) {
          console.error('❌ Erreur récupération présences:', err);
          callback(err, null);
        } else {
          callback(null, rows);
        }
      }
    );
  }

  // Récupérer l'historique des présences d'un membre
  static getMemberPresenceHistory(membre_id, callback) {
    db.all(
      `SELECT * FROM presences 
       WHERE membre_id = ? 
       ORDER BY date DESC 
       LIMIT 20`,
      [membre_id],
      (err, rows) => {
        if (err) {
          console.error('❌ Erreur récupération historique présence:', err);
          callback(err, null);
        } else {
          callback(null, rows);
        }
      }
    );
  }

  // Récupérer les statistiques de présence par service
  static getPresenceStats(service, startDate, endDate, callback) {
    db.all(
      `SELECT 
        date,
        COUNT(*) as total_membres,
        SUM(CASE WHEN present = 1 THEN 1 ELSE 0 END) as presents,
        SUM(CASE WHEN present = 0 THEN 1 ELSE 0 END) as absents,
        ROUND((SUM(CASE WHEN present = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*)), 1) as taux_presence
       FROM presences p
       JOIN membres m ON p.membre_id = m.id
       WHERE m.service = ? AND p.date BETWEEN ? AND ?
       GROUP BY p.date
       ORDER BY p.date DESC`,
      [service, startDate, endDate],
      (err, rows) => {
        if (err) {
          console.error('❌ Erreur récupération stats présence:', err);
          callback(err, null);
        } else {
          callback(null, rows);
        }
      }
    );
  }

  // Générer un rapport PDF des présences
  static getPresenceReport(service, date, callback) {
    db.all(
      `SELECT 
        m.nom, 
        m.prenom, 
        m.quartier,
        p.present,
        p.commentaire,
        CASE 
          WHEN p.present = 1 THEN 'Présent'
          ELSE 'Absent'
        END as statut,
        CASE 
          WHEN p.present = 1 THEN '✅'
          ELSE '❌'
        END as icone
       FROM membres m
       LEFT JOIN presences p ON m.id = p.membre_id AND p.date = ?
       WHERE m.service = ?
       ORDER BY m.nom, m.prenom`,
      [date, service],
      (err, rows) => {
        if (err) {
          console.error('❌ Erreur génération rapport présence:', err);
          callback(err, null);
        } else {
          callback(null, rows);
        }
      }
    );
  }
}

module.exports = Presence;