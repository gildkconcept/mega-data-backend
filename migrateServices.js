const db = require('./database');
const { normalizeServiceName } = require('./database');

console.log('🔄 Migration des services existants...');

// 1. Normaliser tous les services dans la table membres
db.all('SELECT id, service FROM membres', (err, rows) => {
  if (err) {
    console.error('❌ Erreur:', err);
    return;
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
            console.error(`❌ Erreur mise à jour membre ${row.id}:`, err);
          } else if (this.changes > 0) {
            updated++;
            console.log(`✅ ${row.id}: "${row.service}" → "${normalized}"`);
          }
        }
      );
    }
  });
  
  setTimeout(() => {
    console.log(`\n📊 Migration terminée:`);
    console.log(`   ${updated} services normalisés`);
    
    // Afficher le résultat
    db.all('SELECT service, COUNT(*) as count FROM membres GROUP BY service ORDER BY service', 
      (err, results) => {
        if (!err) {
          console.log('\n📋 Services après migration:');
          results.forEach(r => {
            console.log(`   ${r.service}: ${r.count} membres`);
          });
        }
    });
  }, 2000);
});