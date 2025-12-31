const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Base de données
const db = require('./database');

// Middleware
const authMiddleware = require('./middleware/authMiddleware');

// Routes
const authRoutes = require('./routes/authRoutes');
const memberRoutes = require('./routes/memberRoutes');
const bergerRoutes = require('./routes/bergerRoutes');
const adminRoutes = require('./routes/adminRoutes');
const presenceRoutes = require('./routes/presenceRoutes');
const adminPresenceRoutes = require('./routes/adminPresenceRoutes');
const adminWeeklyPresenceRoutes = require('./routes/adminWeeklyPresenceRoutes');

const app = express();

// Middleware global
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware de logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url} ${req.ip}`);
  next();
});

// Gérer les pré-vols CORS
app.options('*', cors());

// Routes publiques
app.use('/api/auth', authRoutes);

// Routes protégées
app.use('/api/members', memberRoutes);
app.use('/api/berger', bergerRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/presence', presenceRoutes);
app.use('/api/admin/presence', adminPresenceRoutes);
app.use('/api/admin/weekly', adminWeeklyPresenceRoutes);

// Route racine
app.get('/', (req, res) => {
  res.json({ 
    message: 'API Mega-data - Gestion des membres d\'église',
    version: '2.2.0',
    status: 'online',
    timestamp: new Date().toISOString(),
    features: [
      'Authentification JWT',
      'Gestion des membres',
      'Dashboard berger',
      'Dashboard admin',
      'Export PDF',
      'Administration complète',
      'Système de présence',
      'Super Admin: Vue complète présences',
      'Export PDF hebdomadaire'
    ],
    endpoints: {
      auth: '/api/auth',
      members: '/api/members',
      berger: '/api/berger',
      admin: '/api/admin',
      presence: '/api/presence',
      admin_presence: '/api/admin/presence',
      admin_weekly: '/api/admin/weekly',
      health: '/api/health',
      stats: '/api/stats',
      protected: '/api/protected'
    },
    environment: process.env.NODE_ENV || 'development'
  });
});

// Route de santé
app.get('/api/health', (req, res) => {
  db.get('SELECT 1 as healthy', (err) => {
    const dbHealthy = !err;
    
    // Vérifier l'état des tables
    db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
      const tablesList = tables ? tables.map(t => t.name) : [];
      
      res.json({ 
        success: true,
        message: 'Serveur Mega-data en ligne',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        services: {
          database: dbHealthy ? 'healthy' : 'unhealthy',
          api: 'healthy',
          auth: 'JWT',
          pdf: 'available',
          presence: 'available',
          admin_presence: 'available',
          weekly_reports: 'available'
        },
        tables: tablesList,
        version: '2.2.0',
        node_version: process.version
      });
    });
  });
});

// Route de debug pour les services
app.get('/api/debug/services', authMiddleware('admin'), (req, res) => {
  console.log('🔍 Debug services appelé par:', req.user.username);
  
  db.all('SELECT DISTINCT service FROM membres ORDER BY service', (err, services) => {
    if (err) {
      console.error('❌ Erreur services membres:', err);
      return res.status(500).json({ error: err.message });
    }
    
    db.all('SELECT username, service_assigne, role FROM users WHERE role = "berger" ORDER BY username', (err, bergers) => {
      if (err) {
        console.error('❌ Erreur bergers:', err);
        return res.status(500).json({ error: err.message });
      }
      
      db.all('SELECT nom, nom_court FROM services ORDER BY nom', (err, serviceDefinitions) => {
        if (err) {
          console.error('❌ Erreur services définis:', err);
          return res.status(500).json({ error: err.message });
        }
        
        // Vérifier les correspondances
        const correspondances = [];
        services.forEach(service => {
          const berger = bergers.find(b => b.service_assigne === service.service);
          correspondances.push({
            service: service.service,
            a_berger: !!berger,
            berger_username: berger ? berger.username : 'AUCUN',
            est_dans_services: serviceDefinitions.some(s => s.nom === service.service)
          });
        });
        
        res.json({
          success: true,
          services_membres: services.map(s => s.service),
          bergers: bergers.map(b => ({ 
            username: b.username, 
            service_assigne: b.service_assigne,
            role: b.role
          })),
          services_definis: serviceDefinitions,
          correspondances: correspondances,
          message: 'Debug: Vérification des correspondances de services',
          total_services: services.length,
          total_bergers: bergers.length,
          total_definitions: serviceDefinitions.length
        });
      });
    });
  });
});

// Route pour super admin: statistiques avancées
app.get('/api/admin/advanced-stats', authMiddleware('admin'), (req, res) => {
  console.log('📊 Advanced stats appelé par:', req.user.username);
  
  // Statistiques par service
  db.all(`
    SELECT 
      service,
      COUNT(*) as total_membres,
      COUNT(CASE WHEN date(created_at) >= date('now', '-7 days') THEN 1 END) as cette_semaine,
      COUNT(CASE WHEN date(created_at) = date('now') THEN 1 END) as aujourdhui
    FROM membres 
    GROUP BY service 
    ORDER BY total_membres DESC
  `, (err, serviceStats) => {
    if (err) {
      console.error('❌ Erreur stats service:', err);
      return res.status(500).json({ error: err.message });
    }
    
    // Statistiques de présence des 4 derniers dimanches
    const sundays = [];
    for (let i = 0; i < 4; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (date.getDay() + 7 * i) + 7);
      sundays.push(date.toISOString().split('T')[0]);
    }
    
    const presencePromises = sundays.map(date => {
      return new Promise((resolve, reject) => {
        db.all(`
          SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN present = 1 THEN 1 ELSE 0 END) as presents
          FROM presences 
          WHERE date = ?
        `, [date], (err, row) => {
          if (err) reject(err);
          else resolve({ date, ...row[0] });
        });
      });
    });
    
    Promise.all(presencePromises).then(presenceStats => {
      // Top 5 quartiers
      db.all(`
        SELECT quartier, COUNT(*) as count
        FROM membres 
        GROUP BY quartier 
        ORDER BY count DESC 
        LIMIT 5
      `, (err, topQuartiers) => {
        if (err) {
          console.error('❌ Erreur top quartiers:', err);
          return res.status(500).json({ error: err.message });
        }
        
        // Activité récente
        db.all(`
          SELECT 
            strftime('%Y-%m-%d', created_at) as date,
            COUNT(*) as nouveaux_membres
          FROM membres 
          WHERE created_at >= date('now', '-30 days')
          GROUP BY strftime('%Y-%m-%d', created_at)
          ORDER BY date DESC
          LIMIT 7
        `, (err, activite) => {
          if (err) {
            console.error('❌ Erreur activité:', err);
            // Continuer sans activité
          }
          
          res.json({
            success: true,
            stats: {
              par_service: serviceStats,
              presences_semaines: presenceStats,
              top_quartiers: topQuartiers,
              activite_recente: activite || [],
              total_membres: serviceStats.reduce((sum, s) => sum + s.total_membres, 0),
              total_presences: presenceStats.reduce((sum, p) => sum + (p.presents || 0), 0),
              date_generation: new Date().toISOString()
            }
          });
        });
      });
    }).catch(error => {
      console.error('❌ Erreur promesses présence:', error);
      res.status(500).json({ error: error.message });
    });
  });
});

// Normaliser les services (route admin)
app.post('/api/admin/normalize-services', authMiddleware('admin'), (req, res) => {
  console.log('🔄 Normalisation services par:', req.user.username);
  
  const Member = require('./models/Member');
  
  Member.normalizeAllServices((err, result) => {
    if (err) {
      console.error('❌ Erreur normalisation:', err);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la normalisation'
      });
    }
    
    res.json({
      success: true,
      message: `Services normalisés: ${result.updated || 0} services mis à jour`,
      updated: result.updated || 0,
      timestamp: new Date().toISOString()
    });
  });
});

// Route protégée de test
app.get('/api/protected', authMiddleware(), (req, res) => {
  console.log('🔐 Protected route appelé par:', req.user.username);
  res.json({
    success: true,
    message: 'Route protégée accessible',
    user: req.user,
    timestamp: new Date().toISOString()
  });
});

// Route admin de test
app.get('/api/admin/test', authMiddleware('admin'), (req, res) => {
  console.log('👑 Admin test appelé par:', req.user.username);
  res.json({
    success: true,
    message: 'Route admin accessible',
    user: req.user,
    service_assigne: req.user.service_assigne,
    is_super_admin: req.user.role === 'super_admin',
    timestamp: new Date().toISOString()
  });
});

// Route berger de test
app.get('/api/berger/test', authMiddleware('berger'), (req, res) => {
  console.log('🐑 Berger test appelé par:', req.user.username);
  res.json({
    success: true,
    message: 'Route berger accessible',
    user: req.user,
    service_assigne: req.user.service_assigne || 'Non assigné',
    has_service: !!req.user.service_assigne,
    timestamp: new Date().toISOString()
  });
});

// Test d'export PDF
app.get('/api/test/pdf', authMiddleware('berger'), (req, res) => {
  console.log('📄 PDF test appelé par:', req.user.username);
  res.json({
    success: true,
    message: 'Route PDF disponible',
    service: req.user.service_assigne,
    pdf_endpoint: '/api/berger/export/pdf',
    weekly_pdf_endpoint: '/api/admin/weekly/export/weekly-pdf',
    timestamp: new Date().toISOString()
  });
});

// Recherche globale
app.get('/api/search', authMiddleware(), (req, res) => {
  const { q, type = 'membres' } = req.query;
  
  if (!q || q.length < 2) {
    return res.status(400).json({
      success: false,
      message: 'Terme de recherche trop court (min 2 caractères)'
    });
  }
  
  console.log(`🔍 Recherche: "${q}", type: ${type}, par: ${req.user.username}`);
  
  if (type === 'membres') {
    let sql = `
      SELECT m.*, u.username as berger
      FROM membres m
      LEFT JOIN users u ON m.user_id = u.id
      WHERE m.nom LIKE ? OR m.prenom LIKE ? OR m.numero LIKE ? OR m.quartier LIKE ? OR m.service LIKE ?
      ORDER BY m.created_at DESC
      LIMIT 50
    `;
    
    const searchTerm = `%${q}%`;
    const params = [searchTerm, searchTerm, searchTerm, searchTerm, searchTerm];
    
    // Si c'est un berger, limiter à son service
    if (req.user.role === 'berger' && req.user.service_assigne) {
      sql = sql.replace('WHERE', 'WHERE m.service = ? AND (');
      params.unshift(req.user.service_assigne);
      sql += ')';
    }
    
    db.all(sql, params, (err, results) => {
      if (err) {
        console.error('❌ Erreur recherche membres:', err);
        return res.status(500).json({
          success: false,
          message: 'Erreur lors de la recherche'
        });
      }
      
      res.json({
        success: true,
        query: q,
        type: 'membres',
        total: results.length,
        results
      });
    });
  } else if (type === 'utilisateurs' && ['admin', 'super_admin'].includes(req.user.role)) {
    // Recherche d'utilisateurs (admin seulement)
    db.all(`
      SELECT id, username, nom, prenom, branche, role, service_assigne, created_at
      FROM users
      WHERE username LIKE ? OR nom LIKE ? OR prenom LIKE ? OR branche LIKE ? OR role LIKE ?
      ORDER BY created_at DESC
      LIMIT 50
    `, [`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`], (err, results) => {
      if (err) {
        console.error('❌ Erreur recherche utilisateurs:', err);
        return res.status(500).json({
          success: false,
          message: 'Erreur lors de la recherche'
        });
      }
      
      res.json({
        success: true,
        query: q,
        type: 'utilisateurs',
        total: results.length,
        results
      });
    });
  } else {
    res.status(403).json({
      success: false,
      message: 'Type de recherche non autorisé'
    });
  }
});

// Statistiques globales
app.get('/api/stats', authMiddleware('admin'), (req, res) => {
  console.log('📈 Stats globales appelé par:', req.user.username);
  
  db.get('SELECT COUNT(*) as total_membres FROM membres', (err, membres) => {
    if (err) {
      console.error('❌ Erreur total membres:', err);
      return res.status(500).json({ error: err.message });
    }
    
    db.get('SELECT COUNT(*) as total_users FROM users', (err, users) => {
      if (err) {
        console.error('❌ Erreur total users:', err);
        return res.status(500).json({ error: err.message });
      }
      
      db.all(`SELECT role, COUNT(*) as count FROM users GROUP BY role`, (err, roles) => {
        if (err) {
          console.error('❌ Erreur stats roles:', err);
          return res.status(500).json({ error: err.message });
        }
        
        db.all(`SELECT service, COUNT(*) as count FROM membres GROUP BY service ORDER BY count DESC`, (err, services) => {
          if (err) {
            console.error('❌ Erreur stats services:', err);
            return res.status(500).json({ error: err.message });
          }
          
          // Présences aujourd'hui
          const today = new Date().toISOString().split('T')[0];
          db.get(`
            SELECT 
              COUNT(*) as total_presences,
              SUM(CASE WHEN present = 1 THEN 1 ELSE 0 END) as presents
            FROM presences 
            WHERE date = ?
          `, [today], (err, presences) => {
            if (err) {
              console.error('❌ Erreur stats présences:', err);
              // Continuer sans stats présences
            }
            
            res.json({
              success: true,
              stats: {
                membres: membres.total_membres,
                utilisateurs: users.total_users,
                roles: roles.reduce((acc, r) => {
                  acc[r.role] = r.count;
                  return acc;
                }, {}),
                services: services.reduce((acc, s) => {
                  acc[s.service] = s.count;
                  return acc;
                }, {}),
                presences_aujourdhui: presences || { total_presences: 0, presents: 0 },
                generé_le: new Date().toISOString(),
                par: req.user.username
              }
            });
          });
        });
      });
    });
  });
});

// API Documentation
app.get('/api/docs', (req, res) => {
  res.json({
    title: 'API Mega-data Documentation',
    version: '2.2.0',
    description: 'API pour la gestion des membres d\'église',
    base_url: req.protocol + '://' + req.get('host'),
    endpoints: {
      authentication: {
        register: { method: 'POST', path: '/api/auth/register', description: 'Créer un compte' },
        login: { method: 'POST', path: '/api/auth/login', description: 'Se connecter' },
        profile: { method: 'GET', path: '/api/auth/profile', description: 'Profil utilisateur', auth: true }
      },
      members: {
        create: { method: 'POST', path: '/api/members', description: 'Ajouter un membre', auth: true },
        my_members: { method: 'GET', path: '/api/members/my-members', description: 'Mes membres', auth: true },
        all_members: { method: 'GET', path: '/api/members/all', description: 'Tous les membres', auth: 'admin' }
      },
      berger: {
        dashboard: { method: 'GET', path: '/api/berger/dashboard', description: 'Dashboard berger', auth: 'berger' },
        members: { method: 'GET', path: '/api/berger/members', description: 'Membres du service', auth: 'berger' },
        pdf: { method: 'GET', path: '/api/berger/export/pdf', description: 'Export PDF', auth: 'berger' }
      },
      presence: {
        record: { method: 'POST', path: '/api/presence/record', description: 'Enregistrer présence', auth: 'berger' },
        by_date: { method: 'GET', path: '/api/presence/date/:date', description: 'Présences par date', auth: 'berger' }
      },
      admin: {
        advanced_stats: { method: 'GET', path: '/api/admin/advanced-stats', description: 'Stats avancées', auth: 'admin' },
        normalize: { method: 'POST', path: '/api/admin/normalize-services', description: 'Normaliser services', auth: 'admin' },
        weekly_pdf: { method: 'GET', path: '/api/admin/weekly/export/weekly-pdf', description: 'Export hebdomadaire PDF', auth: 'admin' }
      },
      utilities: {
        health: { method: 'GET', path: '/api/health', description: 'Santé du serveur' },
        stats: { method: 'GET', path: '/api/stats', description: 'Statistiques', auth: 'admin' },
        search: { method: 'GET', path: '/api/search', description: 'Recherche globale', auth: true }
      }
    }
  });
});

// Gestion des erreurs 404
app.use((req, res) => {
  console.log(`❌ Route non trouvée: ${req.method} ${req.url}`);
  res.status(404).json({ 
    success: false,
    message: 'Route non trouvée',
    path: req.path,
    method: req.method,
    suggestion: 'Consultez /api/docs pour la documentation complète',
    available_endpoints: [
      '/api/auth/register',
      '/api/auth/login',
      '/api/health',
      '/api/docs'
    ]
  });
});

// Gestion des erreurs globales
app.use((err, req, res, next) => {
  console.error('❌ Erreur serveur:', err);
  
  const statusCode = err.status || 500;
  const message = err.message || 'Erreur interne du serveur';
  
  // Log plus détaillé en développement
  if (process.env.NODE_ENV === 'development') {
    console.error('Stack:', err.stack);
  }
  
  res.status(statusCode).json({
    success: false,
    message: message,
    error: process.env.NODE_ENV === 'development' ? {
      name: err.name,
      stack: err.stack,
      path: req.path,
      method: req.method
    } : undefined,
    timestamp: new Date().toISOString()
  });
});

// Démarrer le serveur
const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log('\n' + '='.repeat(70));
  console.log('🚀 SERVEUR MEGA-DATA V2.2 DÉMARRÉ');
  console.log('='.repeat(70));
  console.log(`✅ Port: ${PORT}`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log(`🔗 Frontend: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
  console.log(`📁 Base de données: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔐 Authentification: JWT`);
  console.log(`📊 PDF Export: ACTIVÉ`);
  console.log(`📋 Système de présence: ACTIVÉ`);
  console.log(`📈 Stats avancées: ACTIVÉ`);
  console.log(`📅 Export hebdomadaire: ACTIVÉ`);
  console.log('='.repeat(70));
  console.log('\n📋 ENDPOINTS DISPONIBLES:');
  console.log('├── 🔐 AUTHENTIFICATION');
  console.log('│   ├── POST /api/auth/register');
  console.log('│   ├── POST /api/auth/login');
  console.log('│   ├── GET  /api/auth/profile');
  console.log('│   └── GET  /api/auth/check-role');
  console.log('├── 👥 MEMBRES');
  console.log('│   ├── POST /api/members');
  console.log('│   ├── GET  /api/members/my-members');
  console.log('│   ├── GET  /api/members/all (admin)');
  console.log('│   ├── GET  /api/search (recherche)');
  console.log('│   ├── 📥 GET  /api/members/export/csv/members');
  console.log('│   └── 📥 GET  /api/members/export/csv/users');
  console.log('├── 🐑 BERGER');
  console.log('│   ├── GET  /api/berger/dashboard');
  console.log('│   ├── GET  /api/berger/members');
  console.log('│   ├── GET  /api/berger/stats');
  console.log('│   └── 📥 GET  /api/berger/export/pdf');
  console.log('├── 📋 PRÉSENCES (BERGER)');
  console.log('│   ├── POST /api/presence/record');
  console.log('│   ├── GET  /api/presence/date/:date');
  console.log('│   ├── POST /api/presence/mark-all');
  console.log('│   └── GET  /api/presence/stats');
  console.log('├── 👑 SUPER ADMIN');
  console.log('│   ├── GET  /api/admin/presence/date/:date');
  console.log('│   ├── GET  /api/admin/presence/member/:memberId');
  console.log('│   ├── GET  /api/admin/presence/stats/service');
  console.log('│   ├── 📥 GET  /api/admin/presence/export/pdf/:date');
  console.log('│   └── 📅 GET  /api/admin/weekly/export/weekly-pdf');
  console.log('├── ⚙️  ADMIN');
  console.log('│   ├── GET  /api/stats');
  console.log('│   ├── GET  /api/admin/advanced-stats');
  console.log('│   ├── POST /api/admin/normalize-services');
  console.log('│   ├── GET  /api/debug/services');
  console.log('│   └── 📥 GET  /api/admin/export/pdf');
  console.log('└── 🩺 UTILITAIRES');
  console.log('    ├── GET  / (racine)');
  console.log('    ├── GET  /api/health');
  console.log('    ├── GET  /api/docs');
  console.log('    ├── GET  /api/protected');
  console.log('    ├── GET  /api/admin/test');
  console.log('    └── GET  /api/berger/test');
  console.log('\n' + '='.repeat(70));
  console.log('📋 SERVICES CONFIGURÉS:');
  console.log('• Groupe de louange et d\'adoration (GLA)');
  console.log('• Voir et Entendre');
  console.log('• Communication');
  console.log('• 28:19');
  console.log('• Suivi');
  console.log('• Service d\'ordre');
  console.log('• Protocole');
  console.log('• Logistique');
  console.log('• Service Book');
  console.log('• Gestion de culte');
  console.log('='.repeat(70));
  console.log('\n📊 STATISTIQUES ACTUELLES:');
  
  // Afficher quelques stats au démarrage
  setTimeout(() => {
    db.get('SELECT COUNT(*) as total FROM membres', (err, membres) => {
      if (!err && membres) {
        db.get('SELECT COUNT(*) as total FROM users', (err, users) => {
          if (!err && users) {
            db.get('SELECT COUNT(*) as total FROM presences', (err, presences) => {
              console.log(`   • Membres: ${membres.total}`);
              console.log(`   • Utilisateurs: ${users.total}`);
              console.log(`   • Présences: ${presences ? presences.total : 0}`);
              console.log('='.repeat(70));
              console.log('\n✅ Prêt à recevoir des connexions...\n');
            });
          }
        });
      }
    });
  }, 1000);
});

// Gestion propre de l'arrêt
process.on('SIGINT', () => {
  console.log('\n\n🛑 Arrêt propre du serveur...');
  server.close(() => {
    console.log('✅ Serveur arrêté');
    db.close((err) => {
      if (err) {
        console.error('❌ Erreur fermeture base de données:', err);
      } else {
        console.log('✅ Base de données fermée');
      }
      process.exit(0);
    });
  });
});

// Gestion des erreurs non capturées
process.on('uncaughtException', (err) => {
  console.error('❌ Exception non capturée:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Rejet non géré:', reason);
});

module.exports = app;