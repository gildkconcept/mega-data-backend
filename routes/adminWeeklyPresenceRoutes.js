const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const db = require('../database');
const PDFDocument = require('pdfkit');

// Route protégée pour admin seulement
router.get('/export/weekly-pdf', authMiddleware('admin'), async (req, res) => {
  try {
    const { startDate, endDate, service } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Les dates de début et de fin sont requises'
      });
    }
    
    console.log(`🔍 [Weekly PDF] Export du ${startDate} au ${endDate}, service: ${service || 'tous'}`);
    
    // Récupérer toutes les dates entre startDate et endDate
    const dates = [];
    const currentDate = new Date(startDate);
    const end = new Date(endDate);
    
    while (currentDate <= end) {
      dates.push(currentDate.toISOString().split('T')[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Récupérer les données pour chaque date
    const weeklyData = [];
    
    for (const date of dates) {
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
        JOIN users u ON p.berger_id = u.id
        WHERE p.date = ?
      `;
      
      const params = [date];
      
      if (service && service !== 'tous') {
        sql += ' AND m.service = ?';
        params.push(service);
      }
      
      sql += ' ORDER BY m.service, m.nom, m.prenom';
      
      const rows = await new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
      
      if (rows.length > 0) {
        const total = rows.length;
        const presents = rows.filter(r => r.present).length;
        const absents = total - presents;
        const taux = total > 0 ? Math.round((presents / total) * 100) : 0;
        
        weeklyData.push({
          date,
          data: rows,
          stats: { total, presents, absents, taux }
        });
      }
    }
    
    if (weeklyData.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Aucune donnée de présence pour cette période'
      });
    }
    
    // Créer le PDF
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      info: {
        Title: `Rapport hebdomadaire des présences - ${startDate} au ${endDate}`,
        Author: `Super Admin ${req.user.username}`,
        Subject: 'Rapport hebdomadaire des présences',
        Keywords: 'présences, église, rapport, hebdomadaire, admin',
        Creator: 'Mega-data Église',
        Producer: 'Mega-data Église',
        CreationDate: new Date()
      }
    });
    
    // Headers
    res.setHeader('Content-Type', 'application/pdf');
    
    let filename = `presences_hebdomadaire_${startDate}_${endDate}`;
    if (service && service !== 'tous') {
      filename += `_${service.replace(/[^a-zA-Z0-9]/g, '_')}`;
    }
    filename += '.pdf';
    
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    doc.pipe(res);
    
    // ===== EN-TÊTE =====
    doc.fontSize(24)
       .font('Helvetica-Bold')
       .fillColor('#2c3e50')
       .text('MEGA-DATA ÉGLISE', { 
         align: 'center',
         underline: true 
       });
    
    doc.moveDown(0.5);
    doc.fontSize(18)
       .font('Helvetica')
       .fillColor('#3498db')
       .text('RAPPORT HEBDOMADAIRE DES PRÉSENCES', { align: 'center' });
    
    doc.moveDown(1);
    
    // ===== PÉRIODE =====
    doc.fontSize(16)
       .font('Helvetica-Bold')
       .fillColor('#e74c3c')
       .text(`Période: du ${formatDateFr(startDate)} au ${formatDateFr(endDate)}`, { align: 'center' });
    
    if (service && service !== 'tous') {
      doc.fontSize(14)
         .font('Helvetica')
         .fillColor('#27ae60')
         .text(`Service: ${service}`, { align: 'center' });
    }
    
    // ===== STATISTIQUES GLOBALES =====
    doc.moveDown(1.5);
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .fillColor('#7f8c8d')
       .text('RÉSUMÉ HEBDOMADAIRE', 50, doc.y, { underline: true });
    
    doc.moveDown(0.5);
    doc.fontSize(10)
       .font('Helvetica')
       .fillColor('#2c3e50');
    
    const globalStats = calculateGlobalWeeklyStats(weeklyData);
    
    let y = doc.y;
    doc.text(`• Période: ${startDate} au ${endDate}`, 70, y);
    y += 20;
    doc.text(`• Nombre de jours avec données: ${weeklyData.length}`, 70, y);
    y += 20;
    doc.text(`• Membres uniques: ${globalStats.uniqueMembers}`, 70, y);
    y += 20;
    doc.text(`• Taux de présence moyen: ${globalStats.averageAttendance}%`, 70, y);
    y += 20;
    doc.text(`• Meilleur jour: ${formatDateFr(globalStats.bestDay.date)} (${globalStats.bestDay.taux}%)`, 70, y);
    y += 20;
    doc.text(`• Pire jour: ${formatDateFr(globalStats.worstDay.date)} (${globalStats.worstDay.taux}%)`, 70, y);
    y += 20;
    doc.text(`• Généré par: ${req.user.username} (${req.user.role})`, 70, y);
    y += 20;
    doc.text(`• Date de génération: ${new Date().toLocaleDateString('fr-FR')}`, 70, y);
    
    // ===== STATISTIQUES PAR JOUR =====
    doc.moveDown(2.5);
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .fillColor('#7f8c8d')
       .text('STATISTIQUES PAR JOUR', { underline: true });
    
    doc.moveDown(0.5);
    
    // Tableau des stats par jour
    const tableTop = doc.y;
    let tableY = tableTop;
    
    // En-tête du tableau
    doc.fontSize(10)
       .font('Helvetica-Bold')
       .fillColor('#ffffff')
       .rect(45, tableY - 10, 510, 25)
       .fillAndStroke('#2c3e50', '#2c3e50');
    
    doc.fillColor('#ffffff')
       .text('DATE', 55, tableY)
       .text('JOUR', 110, tableY)
       .text('TOTAL', 200, tableY)
       .text('PRÉSENTS', 260, tableY)
       .text('ABSENTS', 340, tableY)
       .text('TAUX', 420, tableY);
    
    tableY += 30;
    
    // Données
    doc.font('Helvetica')
       .fontSize(9)
       .fillColor('#2c3e50');
    
    weeklyData.forEach((day, index) => {
      // Alternance des couleurs
      if (index % 2 === 0) {
        doc.rect(45, tableY - 5, 510, 20)
           .fillColor('#f8f9fa')
           .fill();
      }
      
      // Date
      const date = new Date(day.date);
      const dateStr = date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
      const dayName = date.toLocaleDateString('fr-FR', { weekday: 'short' });
      
      doc.fillColor('#2c3e50')
         .text(dateStr, 55, tableY)
         .text(dayName, 110, tableY)
         .text(day.stats.total.toString(), 200, tableY)
         .text(day.stats.presents.toString(), 260, tableY)
         .text(day.stats.absents.toString(), 340, tableY);
      
      // Taux avec couleur
      const tauxColor = day.stats.taux >= 80 ? '#27ae60' : day.stats.taux >= 50 ? '#f39c12' : '#e74c3c';
      doc.fillColor(tauxColor)
         .text(`${day.stats.taux}%`, 420, tableY)
         .fillColor('#2c3e50');
      
      tableY += 22;
      
      // Nouvelle page si nécessaire
      if (tableY > 750 && index < weeklyData.length - 1) {
        doc.addPage();
        tableY = 50;
        
        // Réafficher l'en-tête
        doc.fontSize(10)
           .font('Helvetica-Bold')
           .fillColor('#ffffff')
           .rect(45, tableY - 10, 510, 25)
           .fillAndStroke('#2c3e50', '#2c3e50');
        
        doc.fillColor('#ffffff')
           .text('DATE', 55, tableY)
           .text('JOUR', 110, tableY)
           .text('TOTAL', 200, tableY)
           .text('PRÉSENTS', 260, tableY)
           .text('ABSENTS', 340, tableY)
           .text('TAUX', 420, tableY);
        
        tableY += 30;
      }
    });
    
    // ===== DÉTAIL PAR JOUR =====
    if (tableY < 650) {
      doc.moveDown(2);
      
      doc.fontSize(12)
         .font('Helvetica-Bold')
         .fillColor('#7f8c8d')
         .text('DÉTAIL DES PRÉSENCES PAR JOUR', { underline: true });
      
      // Ajouter un tableau détaillé pour chaque jour
      weeklyData.forEach(day => {
        if (tableY > 700) {
          doc.addPage();
          tableY = 50;
        }
        
        doc.moveDown(1);
        doc.fontSize(11)
           .font('Helvetica-Bold')
           .fillColor('#3498db')
           .text(`${formatDateFr(day.date)} - ${day.stats.presents}/${day.stats.total} présents (${day.stats.taux}%)`);
        
        doc.moveDown(0.5);
        doc.fontSize(9)
           .font('Helvetica')
           .fillColor('#2c3e50');
        
        // Afficher quelques membres
        const sampleMembers = day.data.slice(0, 5);
        sampleMembers.forEach((member, idx) => {
          const status = member.present ? '✅ Présent' : '❌ Absent';
          doc.text(`  ${idx + 1}. ${member.nom} ${member.prenom} - ${status}`);
        });
        
        if (day.data.length > 5) {
          doc.text(`  ... et ${day.data.length - 5} autres membres`);
        }
        
        tableY = doc.y + 20;
      });
    }
    
    // ===== PIED DE PAGE =====
    try {
      const pageCount = doc.bufferedPageRange ? doc.bufferedPageRange().count : 1;
      
      if (pageCount > 0) {
        doc.switchToPage(pageCount - 1);
        
        doc.fontSize(8)
           .font('Helvetica')
           .fillColor('#7f8c8d')
           .text(
             `Document hebdomadaire super admin • Mega-data Église • Page ${pageCount}/${pageCount} • ${new Date().toLocaleDateString('fr-FR')}`,
             50,
             doc.page.height - 30,
             { align: 'center', width: doc.page.width - 100 }
           );
      }
    } catch (footerError) {
      console.log('ℹ️ Erreur pied de page mineure:', footerError.message);
    }
    
    doc.end();
    
    console.log(`✅ Rapport hebdomadaire PDF généré pour ${startDate} au ${endDate}`);
    console.log(`   ${weeklyData.length} jours avec données`);
    console.log(`   ${globalStats.uniqueMembers} membres uniques`);
    console.log(`   Taux moyen: ${globalStats.averageAttendance}%`);
    
  } catch (error) {
    console.error('❌ Erreur génération PDF hebdomadaire:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la génération du PDF hebdomadaire'
    });
  }
});

// Fonction pour formater la date en français
function formatDateFr(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

// Fonction pour calculer les statistiques globales
function calculateGlobalWeeklyStats(weeklyData) {
  const stats = {
    uniqueMembers: new Set(),
    totalDays: weeklyData.length,
    averageAttendance: 0,
    bestDay: { date: '', taux: 0 },
    worstDay: { date: '', taux: 100 }
  };
  
  let tauxSum = 0;
  
  weeklyData.forEach(day => {
    // Ajouter les membres uniques
    day.data.forEach(member => {
      stats.uniqueMembers.add(member.membre_id);
    });
    
    // Calculer la somme des taux
    tauxSum += day.stats.taux;
    
    // Meilleur jour
    if (day.stats.taux > stats.bestDay.taux) {
      stats.bestDay = { date: day.date, taux: day.stats.taux };
    }
    
    // Pire jour
    if (day.stats.taux < stats.worstDay.taux) {
      stats.worstDay = { date: day.date, taux: day.stats.taux };
    }
  });
  
  // Calculer la moyenne
  if (stats.totalDays > 0) {
    stats.averageAttendance = Math.round(tauxSum / stats.totalDays);
  }
  
  stats.uniqueMembers = stats.uniqueMembers.size;
  
  return stats;
}

module.exports = router;