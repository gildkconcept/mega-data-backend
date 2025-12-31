const Presence = require('../models/Presence');
const Member = require('../models/Member');

const presenceController = {
  // Enregistrer une présence
  recordPresence: (req, res) => {
    const { membre_id, date, present, commentaire } = req.body;
    const berger_id = req.user.id;
    const service_assigne = req.user.service_assigne;

    if (!membre_id || !date) {
      return res.status(400).json({
        success: false,
        message: 'membre_id et date sont requis'
      });
    }

    // Vérifier que le membre appartient au service du berger
    Member.getForBerger(service_assigne, (err, membres) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: 'Erreur vérification membre'
        });
      }

      const membre = membres.find(m => m.id === parseInt(membre_id));
      if (!membre) {
        return res.status(403).json({
          success: false,
          message: 'Ce membre ne fait pas partie de votre service'
        });
      }

      const presenceData = {
        membre_id: parseInt(membre_id),
        berger_id,
        date,
        present: present !== undefined ? Boolean(present) : true,
        commentaire: commentaire || ''
      };

      Presence.recordPresence(presenceData, (err, result) => {
        if (err) {
          return res.status(500).json({
            success: false,
            message: 'Erreur enregistrement présence'
          });
        }

        res.json({
          success: true,
          message: `Présence enregistrée: ${membre.nom} ${membre.prenom}`,
          data: result
        });
      });
    });
  },

  // Récupérer les présences pour une date
  getPresencesByDate: (req, res) => {
    const { date } = req.params;
    const service_assigne = req.user.service_assigne;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Date requise'
      });
    }

    // Récupérer tous les membres du service
    Member.getForBerger(service_assigne, (err, membres) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: 'Erreur récupération membres'
        });
      }

      // Récupérer les présences déjà enregistrées
      Presence.getPresencesByServiceAndDate(service_assigne, date, (err, presences) => {
        if (err) {
          return res.status(500).json({
            success: false,
            message: 'Erreur récupération présences'
          });
        }

        // Combiner membres et présences
        const membresAvecPresence = membres.map(membre => {
          const presence = presences.find(p => p.membre_id === membre.id);
          return {
            ...membre,
            presence: presence ? {
              present: presence.present,
              commentaire: presence.commentaire,
              created_at: presence.created_at
            } : null
          };
        });

        res.json({
          success: true,
          date,
          service: service_assigne,
          total_membres: membres.length,
          total_presences: presences.length,
          membres: membresAvecPresence
        });
      });
    });
  },

  // Marquer tous les membres comme présents
  markAllPresent: (req, res) => {
    const { date } = req.body;
    const berger_id = req.user.id;
    const service_assigne = req.user.service_assigne;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Date requise'
      });
    }

    Member.getForBerger(service_assigne, (err, membres) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: 'Erreur récupération membres'
        });
      }

      let processed = 0;
      let errors = [];
      let successes = [];

      membres.forEach(membre => {
        const presenceData = {
          membre_id: membre.id,
          berger_id,
          date,
          present: true,
          commentaire: 'Marqué présent automatiquement'
        };

        Presence.recordPresence(presenceData, (err, result) => {
          processed++;
          
          if (err) {
            errors.push(`${membre.nom} ${membre.prenom}`);
          } else {
            successes.push(`${membre.nom} ${membre.prenom}`);
          }

          // Quand tous sont traités
          if (processed === membres.length) {
            res.json({
              success: true,
              message: `Présences enregistrées: ${successes.length} réussies, ${errors.length} échecs`,
              date,
              total_membres: membres.length,
              reussis: successes.length,
              echecs: errors.length,
              membres_echecs: errors
            });
          }
        });
      });
    });
  },

  // Générer un rapport de présence PDF
  generatePresenceReport: (req, res) => {
    const { date } = req.params;
    const service_assigne = req.user.service_assigne;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Date requise'
      });
    }

    Presence.getPresenceReport(service_assigne, date, (err, report) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: 'Erreur génération rapport'
        });
      }

      // Ici vous utiliseriez pdfkit pour générer le PDF
      // Pour l'instant, on retourne les données
      res.json({
        success: true,
        date,
        service: service_assigne,
        total: report.length,
        presents: report.filter(r => r.present === 1).length,
        absents: report.filter(r => r.present === 0).length,
        non_marques: report.filter(r => r.present === null).length,
        data: report
      });
    });
  },

  // Récupérer les statistiques de présence
  getPresenceStats: (req, res) => {
    const { startDate, endDate } = req.query;
    const service_assigne = req.user.service_assigne;

    const defaultStartDate = new Date();
    defaultStartDate.setDate(defaultStartDate.getDate() - 30); // 30 derniers jours

    Presence.getPresenceStats(
      service_assigne,
      startDate || defaultStartDate.toISOString().split('T')[0],
      endDate || new Date().toISOString().split('T')[0],
      (err, stats) => {
        if (err) {
          return res.status(500).json({
            success: false,
            message: 'Erreur récupération statistiques'
          });
        }

        res.json({
          success: true,
          service: service_assigne,
          periode: {
            start: startDate,
            end: endDate
          },
          stats
        });
      }
    );
  }
};

module.exports = presenceController;