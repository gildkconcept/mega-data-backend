const Member = require('../models/Member');

const bergerController = {
  // Tableau de bord du berger - AVEC DEBUG
  getDashboard: (req, res) => {
    console.log('🔍 [BACKEND] ====== getDashboard START ======');
    console.log('🔍 [BACKEND] User object:', req.user);
    console.log('🔍 [BACKEND] Service assigné:', req.user?.service_assigne);
    console.log('🔍 [BACKEND] User ID:', req.user?.id);
    console.log('🔍 [BACKEND] User role:', req.user?.role);
    
    const serviceAssigne = req.user.service_assigne;
    
    if (!serviceAssigne) {
      console.log('❌ [BACKEND] ERROR: No service_assigne for user');
      return res.status(400).json({
        success: false,
        message: 'Aucun service assigné à ce berger'
      });
    }
    
    console.log(`🔍 [BACKEND] Calling Member.getForBerger("${serviceAssigne}")`);
    
    Member.getForBerger(serviceAssigne, (err, membres) => {
      if (err) {
        console.error('❌ [BACKEND] ERROR in getForBerger:', err);
        return res.status(500).json({
          success: false,
          message: 'Erreur lors de la récupération des données'
        });
      }
      
      console.log(`🔍 [BACKEND] Found ${membres.length} members for service: "${serviceAssigne}"`);
      
      if (membres.length > 0) {
        console.log('🔍 [BACKEND] First 3 members:', membres.slice(0, 3).map(m => ({
          id: m.id,
          nom: m.nom,
          prenom: m.prenom,
          service: m.service
        })));
      } else {
        console.log('🔍 [BACKEND] No members found. Checking database...');
        
        // Debug supplémentaire : vérifier ce qu'il y a vraiment dans la base
        const db = require('../database');
        db.all(
          'SELECT service, COUNT(*) as count FROM membres GROUP BY service',
          (dbErr, rows) => {
            if (!dbErr) {
              console.log('🔍 [BACKEND] All services in database:', rows);
            }
          }
        );
      }
      
      // Calculer les statistiques
      const stats = {
        totalMembres: membres.length,
        cetteSemaine: membres.filter(m => {
          const date = new Date(m.created_at);
          const now = new Date();
          const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
          return diffDays <= 7;
        }).length,
        aujourdhui: membres.filter(m => {
          const date = new Date(m.created_at);
          const today = new Date();
          return date.toDateString() === today.toDateString();
        }).length
      };
      
      console.log('🔍 [BACKEND] Calculated stats:', stats);
      console.log('🔍 [BACKEND] ====== getDashboard END ======');
      
      res.json({
        success: true,
        service: serviceAssigne,
        stats,
        derniersMembres: membres.slice(0, 10)
      });
    });
  },
  
  // Liste complète des membres du service - AVEC DEBUG
  getMembers: (req, res) => {
    console.log('🔍 [BACKEND] getMembers called');
    console.log('🔍 [BACKEND] Service assigné:', req.user?.service_assigne);
    
    const serviceAssigne = req.user.service_assigne;
    
    Member.getForBerger(serviceAssigne, (err, membres) => {
      if (err) {
        console.error('❌ [BACKEND] Error in getMembers:', err);
        return res.status(500).json({
          success: false,
          message: 'Erreur lors de la récupération des membres'
        });
      }
      
      console.log(`🔍 [BACKEND] Returning ${membres.length} members`);
      
      res.json({
        success: true,
        service: serviceAssigne,
        membres
      });
    });
  },
  
  // Statistiques détaillées
  getStats: (req, res) => {
    const serviceAssigne = req.user.service_assigne;
    
    Member.getForBerger(serviceAssigne, (err, membres) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: 'Erreur lors de la récupération des statistiques'
        });
      }
      
      // Calculer les statistiques par quartier
      const parQuartier = {};
      membres.forEach(membre => {
        const quartier = membre.quartier || 'Non spécifié';
        parQuartier[quartier] = (parQuartier[quartier] || 0) + 1;
      });
      
      // Statistiques par mois
      const parMois = {};
      membres.forEach(membre => {
        const date = new Date(membre.created_at);
        const mois = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        parMois[mois] = (parMois[mois] || 0) + 1;
      });
      
      res.json({
        success: true,
        service: serviceAssigne,
        total: membres.length,
        parQuartier,
        parMois,
        parUtilisateur: {}
      });
    });
  },
  
  // Export PDF pour le berger
  exportPDF: (req, res) => {
    res.json({
      success: true,
      message: 'Export PDF pour berger'
    });
  }
};

module.exports = bergerController;