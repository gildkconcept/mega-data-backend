// ============================================
// FICHIER DE DÉMARRAGE OPTIMISÉ POUR RENDER
// ============================================
console.log('🚀 Démarrage Mega-data Server...');
console.log('📅', new Date().toISOString());
console.log('🌍 NODE_ENV:', process.env.NODE_ENV || 'development');
console.log('🏗️  Sur Render:', process.env.RENDER ? 'OUI' : 'NON');
console.log('🔧 PORT:', process.env.PORT || 3000);
console.log('📁 __dirname:', __dirname);

// Vérifier et créer le répertoire /data sur Render si nécessaire
if (process.env.RENDER) {
  const fs = require('fs');
  const path = require('path');
  const dataDir = '/data';
  
  console.log(`📁 Vérification du répertoire ${dataDir}...`);
  
  if (!fs.existsSync(dataDir)) {
    console.log(`📁 Création du répertoire ${dataDir}...`);
    try {
      fs.mkdirSync(dataDir, { recursive: true });
      console.log('✅ Répertoire /data créé avec succès');
      
      // Vérifier les permissions
      const stats = fs.statSync(dataDir);
      console.log(`📊 Permissions /data: ${stats.mode.toString(8)}`);
    } catch (err) {
      console.log('⚠️  Impossible de créer /data:', err.message);
      console.log('ℹ️  Utilisation du répertoire courant comme fallback');
    }
  } else {
    console.log('✅ Répertoire /data existe déjà');
    
    // Lister les fichiers dans /data pour debug
    try {
      const files = fs.readdirSync(dataDir);
      console.log(`📂 Fichiers dans /data: ${files.length > 0 ? files.join(', ') : 'aucun'}`);
    } catch (listErr) {
      console.log('⚠️  Impossible de lister /data:', listErr.message);
    }
  }
}

// Vérifier les variables d'environnement critiques
const requiredEnvVars = ['JWT_SECRET'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.warn('⚠️  Variables d\'environnement manquantes:', missingEnvVars);
  
  // Générer un JWT_SECRET si manquant (seulement en développement)
  if (!process.env.JWT_SECRET && process.env.NODE_ENV !== 'production') {
    const crypto = require('crypto');
    process.env.JWT_SECRET = crypto.randomBytes(64).toString('hex');
    console.log('🔑 JWT_SECRET généré automatiquement (développement seulement)');
  }
}

// Afficher les infos de version
console.log('📦 Node.js version:', process.version);
console.log('📦 Plateforme:', process.platform, process.arch);

// Démarrer le serveur principal
console.log('\n' + '='.repeat(50));
console.log('🎯 CHARGEMENT DU SERVEUR PRINCIPAL');
console.log('='.repeat(50) + '\n');

try {
  require('./server.js');
} catch (error) {
  console.error('❌ ERREUR CRITIQUE lors du démarrage:', error);
  console.error('Stack:', error.stack);
  process.exit(1);
}