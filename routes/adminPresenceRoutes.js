const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const db = require('../database');

// Toutes les routes sont protégées pour admin seulement
router.use(authMiddleware('admin'));

// =============================================
// 1. GET /api/admin/presence/date/:date
// =============================================
router.get('/date/:date', (req, res) => {
  const { date } = req.params;
  console.log(`📅 Admin - Présences pour ${date}, appelé par: ${req.user.username}`);
  
  // Récupérer les présences pour cette date
  db.all(`
    SELECT p.*, 
           m.nom, 
           m.prenom, 
           m.numero, 
           m.quartier, 
           m.service,
           u.username as berger_nom
    FROM presences p
    JOIN membres m ON p.membre_id = m.id
    LEFT JOIN users u ON p.user_id = u.id
    WHERE p.date = ?
    ORDER BY m.service, m.nom, m.prenom
  `, [date], (err, presences) => {
    if (err) {
      console.error('❌ Erreur récupération présences:', err);
      return res.status(500).json({ 
        success: false, 
        error: err.message 
      });
    }
    
    // Calculer les stats
    const total = presences.length;
    const presents = presences.filter(p => p.present === 1).length;
    const absents = total - presents;
    const taux = total > 0 ? Math.round((presents / total) * 100) : 0;
    
    // Grouper par service
    const parService = {};
    presences.forEach(p => {
      if (!parService[p.service]) {
        parService[p.service] = {
          total: 0,
          presents: 0,
          membres: []
        };
      }
      parService[p.service].total++;
      if (p.present === 1) parService[p.service].presents++;
      parService[p.service].membres.push(p);
    });
    
    res.json({
      success: true,
      date: date,
      presences: presences,
      stats: {
        total,
        presents,
        absents,
        taux,
        parService: Object.keys(parService).map(service => ({
          service,
          total: parService[service].total,
          presents: parService[service].presents,
          absents: parService[service].total - parService[service].presents,
          taux: Math.round((parService[service].presents / parService[service].total) * 100) || 0
        }))
      },
      count: total
    });
  });
});

// =============================================
// 2. GET /api/admin/presence/member/:memberId
// =============================================
router.get('/member/:memberId', (req, res) => {
  const { memberId } = req.params;
  console.log(`👤 Admin - Présences du membre ${memberId}, appelé par: ${req.user.username}`);
  
  db.all(`
    SELECT p.*, 
           m.nom, 
           m.prenom, 
           m.service, 
           u.username as enregistre_par
    FROM presences p
    JOIN membres m ON p.membre_id = m.id
    LEFT JOIN users u ON p.user_id = u.id
    WHERE p.membre_id = ?
    ORDER BY p.date DESC
  `, [memberId], (err, presences) => {
    if (err) {
      console.error('❌ Erreur récupération présences membre:', err);
      return res.status(500).json({ 
        success: false, 
        error: err.message 
      });
    }
    
    // Récupérer info du membre
    db.get('SELECT * FROM membres WHERE id = ?', [memberId], (err, membre) => {
      if (err) {
        console.error('❌ Erreur récupération membre:', err);
        return res.status(500).json({ 
          success: false, 
          error: err.message 
        });
      }
      
      // Statistiques de présence
      const totalPresences = presences.length;
      const presencesCount = presences.filter(p => p.present === 1).length;
      const tauxPresence = totalPresences > 0 ? 
        Math.round((presencesCount / totalPresences) * 100) : 0;
      
      // Dernière présence
      const dernierePresence = presences.length > 0 ? presences[0] : null;
      
      res.json({
        success: true,
        membre: membre,
        presences: presences,
        stats: {
          total: totalPresences,
          presents: presencesCount,
          absents: totalPresences - presencesCount,
          taux_presence: tauxPresence,
          derniere_presence: dernierePresence ? dernierePresence.date : 'Jamais'
        },
        total_presences: totalPresences
      });
    });
  });
});

// =============================================
// 3. GET /api/admin/presence/stats/service
// =============================================
router.get('/stats/service', (req, res) => {
  console.log(`📊 Admin - Stats par service, appelé par: ${req.user.username}`);
  
  db.all(`
    SELECT 
      m.service,
      COUNT(DISTINCT m.id) as total_membres,
      COUNT(p.id) as total_presences,
      SUM(CASE WHEN p.present = 1 THEN 1 ELSE 0 END) as presents,
      COUNT(DISTINCT p.date) as jours_enregistres,
      MAX(p.date) as derniere_presence
    FROM membres m
    LEFT JOIN presences p ON m.id = p.membre_id
    WHERE m.service IS NOT NULL AND m.service != ''
    GROUP BY m.service
    ORDER BY total_membres DESC
  `, (err, stats) => {
    if (err) {
      console.error('❌ Erreur stats par service:', err);
      return res.status(500).json({ 
        success: false, 
        error: err.message 
      });
    }
    
    // Calculer les taux
    const statsWithTaux = stats.map(s => ({
      ...s,
      absents: s.total_presences - s.presents,
      taux_presence: s.total_presences > 0 ? 
        Math.round((s.presents / s.total_presences) * 100) : 0,
      taux_presentiels: s.total_membres > 0 ? 
        Math.round((s.presents / s.total_membres) * 100) : 0,
      moyenne_journaliere: s.jours_enregistres > 0 ? 
        Math.round((s.presents / s.jours_enregistres) * 100) : 0
    }));
    
    // Totaux généraux
    const totalMembres = stats.reduce((sum, item) => sum + item.total_membres, 0);
    const totalPresences = stats.reduce((sum, item) => sum + item.total_presences, 0);
    const totalPresents = stats.reduce((sum, item) => sum + item.presents, 0);
    
    res.json({
      success: true,
      stats: statsWithTaux,
      summary: {
        total_services: stats.length,
        total_membres: totalMembres,
        total_presences: totalPresences,
        total_presents: totalPresents,
        total_absents: totalPresences - totalPresents,
        taux_presence_global: totalPresences > 0 ? 
          Math.round((totalPresents / totalPresences) * 100) : 0,
        date_generation: new Date().toISOString()
      }
    });
  });
});

// =============================================
// 4. GET /api/admin/presence/export/pdf/:date
// =============================================
router.get('/export/pdf/:date', (req, res) => {
  const { date } = req.params;
  console.log(`📄 Admin - Export PDF pour ${date}, appelé par: ${req.user.username}`);
  
  // Récupérer les données
  db.all(`
    SELECT p.*, 
           m.nom, 
           m.prenom, 
           m.numero, 
           m.quartier, 
           m.service,
           u.username as berger_nom
    FROM presences p
    JOIN membres m ON p.membre_id = m.id
    LEFT JOIN users u ON p.user_id = u.id
    WHERE p.date = ?
    ORDER BY m.service, m.nom, m.prenom
  `, [date], (err, presences) => {
    if (err) {
      console.error('❌ Erreur récupération données PDF:', err);
      return res.status(500).json({ 
        success: false, 
        error: err.message 
      });
    }
    
    if (presences.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Aucune présence enregistrée pour le ${date}`
      });
    }
    
    res.json({
      success: true,
      message: `Export PDF pour ${date} (fonctionnalité à implémenter)`,
      date: date,
      presences_count: presences.length,
      presences: presences
    });
  });
});

// =============================================
// 5. GET /api/admin/presence/export/weekly-pdf
// =============================================
router.get('/export/weekly-pdf', (req, res) => {
  const { startDate, endDate, service } = req.query;
  
  if (!startDate || !endDate) {
    return res.status(400).json({
      success: false,
      message: 'Les dates de début et de fin sont requises'
    });
  }
  
  console.log(`🔍 [Weekly PDF] Export du ${startDate} au ${endDate}, service: ${service || 'tous'}`);
  
  // Récupérer les données
  let sql = `
    SELECT 
      p.*, 
      m.nom, 
      m.prenom, 
      m.numero, 
      m.quartier, 
      m.service,
      u.username as berger_nom
    FROM presences p
    JOIN membres m ON p.membre_id = m.id
    LEFT JOIN users u ON p.user_id = u.id
    WHERE p.date BETWEEN ? AND ?
  `;
  
  const params = [startDate, endDate];
  
  if (service && service !== 'tous') {
    sql += ' AND m.service = ?';
    params.push(service);
  }
  
  sql += ' ORDER BY p.date, m.service, m.nom';
  
  db.all(sql, params, (err, presences) => {
    if (err) {
      console.error('❌ Erreur récupération données hebdomadaires:', err);
      return res.status(500).json({ 
        success: false, 
        error: err.message 
      });
    }
    
    if (presences.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Aucune donnée de présence pour cette période'
      });
    }
    
    // Grouper par date
    const groupedByDate = {};
    presences.forEach(p => {
      if (!groupedByDate[p.date]) {
        groupedByDate[p.date] = [];
      }
      groupedByDate[p.date].push(p);
    });
    
    // Calculer les stats
    const dates = Object.keys(groupedByDate).sort();
    const weeklyData = dates.map(date => {
      const dayPresences = groupedByDate[date];
      const total = dayPresences.length;
      const presents = dayPresences.filter(p => p.present === 1).length;
      const taux = total > 0 ? Math.round((presents / total) * 100) : 0;
      
      return {
        date,
        data: dayPresences,
        stats: {
          total,
          presents,
          absents: total - presents,
          taux
        }
      };
    });
    
    res.json({
      success: true,
      period: { startDate, endDate },
      service: service || 'tous',
      weeklyData: weeklyData,
      total_days: dates.length,
      total_presences: presences.length,
      total_presents: presences.filter(p => p.present === 1).length,
      message: 'Données pour export PDF hebdomadaire (fonctionnalité à implémenter)'
    });
  });
});

module.exports = router;