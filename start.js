console.log('🚀 Démarrage Mega-data Server sur Render...');

// Forcer l'installation des dépendances manquantes
const fs = require('fs');
const { execSync } = require('child_process');

console.log('🔧 Vérification des dépendances...');

// Liste des dépendances critiques
const criticalDeps = [
  'iconv-lite@0.6.3',
  'raw-body@2.5.2',
  'body-parser@1.20.2'
];

console.log('📦 Installation des dépendances manquantes...');

try {
  // Installer les dépendances manquantes
  criticalDeps.forEach(dep => {
    console.log(`Installing ${dep}...`);
    execSync(`npm install ${dep} --no-save`, { stdio: 'inherit' });
  });
} catch (error) {
  console.log('⚠️ Certaines installations ont échoué, continuation...');
}

// Démarrer le serveur
console.log('🎯 Démarrage du serveur principal...');
require('./server.js');