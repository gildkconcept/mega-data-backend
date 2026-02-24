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

// =============================================
// SECTION CORS CORRIGÉE POUR RENDER
// =============================================
app.use(cors({
  origin: function (origin, callback) {
    // Liste des origines autorisées
    const allowedOrigins = [
      'http://localhost:3000',                    // Développement local
      'https://mega-data.vercel.app'               // Frontend Vercel
    ];
    
    // Autoriser les requêtes sans origin (curl, Postman, apps mobiles)
    if (!origin) {
      return callback(null, true);
    }
    
    // Vérifier si l'origine est autorisée
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // Pour les sous-domaines Vercel (déploiements preview)
    if (origin.includes('vercel.app')) {
      console.log('🌐 Autorisation sous-domaine Vercel:', origin);
      return callback(null, true);
    }
    
    // Pour le debug, autoriser temporairement en développement
    if (process.env.NODE_ENV !== 'production') {
      console.log('⚠️ Autorisation CORS en dev pour:', origin);
      return callback(null, true);
    }
    
    // En production sur Render, autoriser toutes les origines pour tester
    if (process.env.RENDER) {
      console.log('🌐 Render: Autorisation CORS pour:', origin);
      return callback(null, true);
    }
    
    // En production autre, bloquer les origines non autorisées
    console.log('❌ CORS bloqué pour:', origin);
    console.log('Origines autorisées:', allowedOrigins);
    return callback(new Error('Not allowed by CORS'), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// =============================================
// CONFIGURATION EXPRESS
// =============================================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware de logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

// Gérer les pré-vols CORS
app.options('*', cors());

// Routes publiques
app.use('/api/auth', authRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/berger', bergerRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/presence', presenceRoutes);
app.use('/api/admin/presence', adminPresenceRoutes);
app.use('/api/admin/weekly', adminWeeklyPresenceRoutes);

// Route racine
app.get('/', (req, res) => {
  const hostname = req.hostname;
  const isRender = hostname.includes('render.com') || hostname.includes('onrender.com');
  
  res.json({ 
    message: 'API Mega-data - Gestion des membres d\'église',
    version: '2.2.0',
    status: 'online',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    host: hostname,
    platform: isRender ? 'Render' : 'Local/Other',
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
    }
  });
});

// Route de santé
app.get('/api/health', (req, res) => {
  const startTime = Date.now();
  
  db.get('SELECT 1 as healthy', (err) => {
    const dbHealthy = !err;
    const dbResponseTime = Date.now() - startTime;
    
    db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
      const tablesList = tables ? tables.map(t => t.name) : [];
      
      const fs = require('fs');
      let diskStatus = 'unknown';
      let dbPathInfo = 'N/A';
      
      try {
        if (process.env.RENDER) {
          const dataDir = '/data';
          if (fs.existsSync(dataDir)) {
            diskStatus = 'mounted';
            dbPathInfo = dataDir;
          } else {
            diskStatus = 'not_found';
          }
        } else {
          diskStatus = 'local';
          dbPathInfo = __dirname;
        }
      } catch (diskErr) {
        diskStatus = 'error: ' + diskErr.message;
      }
      
      res.json({ 
        success: true,
        message: 'Serveur Mega-data en ligne',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        platform: process.env.RENDER ? 'Render' : 'Local/Other',
        services: {
          database: dbHealthy ? 'healthy' : 'unhealthy',
          api: 'healthy',
          auth: 'JWT',
          pdf: 'available',
          presence: 'available',
          admin_presence: 'available',
          weekly_reports: 'available',
          disk: diskStatus
        },
        performance: {
          db_response_ms: dbResponseTime,
          node_version: process.version,
          memory_usage: process.memoryUsage()
        },
        tables: tablesList,
        disk_info: {
          path: dbPathInfo,
          status: diskStatus
        },
        render_specific: process.env.RENDER ? {
          service_id: process.env.RENDER_SERVICE_ID,
          instance_id: process.env.RENDER_INSTANCE_ID
        } : null
      });
    });
  });
});

// ... (le reste de vos routes reste identique) ...

// =============================================
// DÉMARRAGE DU SERVEUR
// =============================================

const PORT = process.env.PORT || 10000;
const HOST = '0.0.0.0';

const server = app.listen(PORT, HOST, () => {
  console.log('\n' + '='.repeat(70));
  console.log('🚀 SERVEUR MEGA-DATA V2.2 DÉMARRÉ');
  console.log('='.repeat(70));
  console.log(`✅ Port: ${PORT}`);
  console.log(`✅ Host: ${HOST}`);
  console.log(`🌐 URL: https://mega-data-pw3w.onrender.com`);
  console.log(`🔗 Frontend autorisés: http://localhost:3000, https://mega-data.vercel.app`);
  console.log('='.repeat(70));
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

module.exports = app;