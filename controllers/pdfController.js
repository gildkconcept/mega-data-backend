const PDFDocument = require('pdfkit');
const Member = require('../models/Member');
const { normalizeServiceName } = require('../database');

const pdfController = {
  // Générer un PDF pour un berger - VERSION CORRIGÉE
  generateBergerPDF: (req, res) => {
    console.log('🔍 [PDF] ===== DÉBUT GÉNÉRATION PDF =====');
    console.log('🔍 [PDF] User:', req.user.username);
    console.log('🔍 [PDF] Service assigné:', req.user.service_assigne);
    console.log('🔍 [PDF] User ID:', req.user.id);
    
    const serviceAssigne = req.user.service_assigne;
    
    if (!serviceAssigne) {
      console.error('❌ [PDF] ERREUR: Pas de service assigné!');
      return res.status(400).json({
        success: false,
        message: 'Aucun service assigné à ce berger'
      });
    }
    
    // DEBUG: Test de normalisation
    console.log('🔍 [PDF] === TEST NORMALISATION ===');
    const testServices = ['Communication', 'COM', 'communication', 'La communication', 'Com'];
    testServices.forEach(test => {
      const result = normalizeServiceName(test);
      console.log(`   "${test}" → "${result}"`);
    });
    
    // Utiliser la MÊME méthode que le tableau de bord
    console.log(`🔍 [PDF] Appel de Member.getForBerger("${serviceAssigne}")`);
    
    Member.getForBerger(serviceAssigne, (err, membres) => {
      if (err) {
        console.error('❌ [PDF] Erreur getForBerger:', err);
        return res.status(500).json({
          success: false,
          message: 'Erreur lors de la récupération des membres'
        });
      }
      
      console.log(`✅ [PDF] ${membres.length} membres trouvés via getForBerger`);
      
      if (membres.length > 0) {
        console.log('🔍 [PDF] Exemple de membre:', {
          id: membres[0].id,
          nom: membres[0].nom,
          prenom: membres[0].prenom,
          service: membres[0].service
        });
      }
      
      // Création du PDF
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: `Liste des membres - ${serviceAssigne}`,
          Author: `Berger ${req.user.nom} ${req.user.prenom}`,
          Subject: 'Liste des membres du service',
          Keywords: 'membres, église, service, liste',
          Creator: 'Mega-Data Église',
          Producer: 'Mega-Data Église',
          CreationDate: new Date()
        }
      });
      
      // Headers
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 
        `attachment; filename="membres_${serviceAssigne.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf"`
      );
      
      doc.pipe(res);
      
      // ===== EN-TÊTE =====
      // Logo ou titre
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
         .text('LISTE DES MEMBRES DU SERVICE', { align: 'center' });
      
      doc.fontSize(20)
         .font('Helvetica-Bold')
         .fillColor('#e74c3c')
         .text(serviceAssigne.toUpperCase(), { align: 'center' });
      
      doc.moveDown(1);
      
      // ===== INFORMATIONS =====
      const infoY = 150;
      
      doc.fontSize(10)
         .font('Helvetica')
         .fillColor('#7f8c8d');
      
      doc.text('INFORMATIONS:', 50, infoY, { underline: true });
      
      doc.text(`• Berger responsable: ${req.user.nom} ${req.user.prenom}`, 70, infoY + 20);
      doc.text(`• Identifiant: ${req.user.username}`, 70, infoY + 40);
      doc.text(`• Rôle: ${req.user.role}`, 70, infoY + 60);
      
      const dateStr = new Date().toLocaleDateString('fr-FR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      doc.text(`• Date de génération: ${dateStr}`, 70, infoY + 80);
      doc.text(`• Total des membres: ${membres.length}`, 70, infoY + 100);
      
      // ===== CONTENU PRINCIPAL =====
      doc.moveDown(8);
      
      if (membres.length === 0) {
        doc.fontSize(16)
           .font('Helvetica')
           .fillColor('#95a5a6')
           .text('AUCUN MEMBRE DANS CE SERVICE', { 
             align: 'center',
             underline: true 
           });
        
        doc.moveDown();
        doc.fontSize(12)
           .text('Le service ne contient pas encore de membres enregistrés.', { align: 'center' });
      } else {
        // TABLEAU DES MEMBRES
        const tableTop = 280;
        let y = tableTop;
        
        // En-tête du tableau
        doc.fontSize(11)
           .font('Helvetica-Bold')
           .fillColor('#ffffff')
           .rect(45, y - 10, 510, 25)
           .fillAndStroke('#2c3e50', '#2c3e50');
        
        doc.fillColor('#ffffff')
           .text('#', 55, y)
           .text('NOM & PRÉNOM', 80, y)
           .text('TÉLÉPHONE', 220, y)
           .text('QUARTIER', 320, y)
           .text('DATE INSCRIPTION', 420, y);
        
        y += 30;
        
        // Données
        doc.font('Helvetica')
           .fontSize(10)
           .fillColor('#2c3e50');
        
        membres.forEach((membre, index) => {
          // Alternance des couleurs de fond
          if (index % 2 === 0) {
            doc.rect(45, y - 5, 510, 20)
               .fillColor('#f8f9fa')
               .fill();
          }
          
          // Numéro
          doc.fillColor('#2c3e50')
             .text((index + 1).toString(), 55, y);
          
          // Nom complet
          const nomComplet = `${membre.nom} ${membre.prenom}`;
          doc.text(nomComplet, 80, y, { 
            width: 130,
            ellipsis: true 
          });
          
          // Téléphone
          doc.text(membre.numero, 220, y, { 
            width: 90,
            ellipsis: true 
          });
          
          // Quartier
          doc.text(membre.quartier, 320, y, { 
            width: 90,
            ellipsis: true 
          });
          
          // Date
          const date = new Date(membre.created_at);
          const dateFormatted = date.toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          });
          
          doc.text(dateFormatted, 420, y);
          
          y += 22;
          
          // Nouvelle page si nécessaire (seulement si plus de 20 membres)
          if (y > 750 && index < membres.length - 1 && membres.length > 20) {
            doc.addPage();
            y = 50;
            
            // En-tête sur nouvelle page
            doc.fontSize(11)
               .font('Helvetica-Bold')
               .fillColor('#ffffff')
               .rect(45, y - 10, 510, 25)
               .fillAndStroke('#2c3e50', '#2c3e50');
            
            doc.fillColor('#ffffff')
               .text('#', 55, y)
               .text('NOM & PRÉNOM', 80, y)
               .text('TÉLÉPHONE', 220, y)
               .text('QUARTIER', 320, y)
               .text('DATE INSCRIPTION', 420, y);
            
            y += 30;
          }
        });
        
        // ===== STATISTIQUES (seulement si au moins 1 membre) =====
        if (membres.length > 0) {
          // Calcul des statistiques
          const aujourdhui = new Date().toDateString();
          const ilYa7Jours = new Date();
          ilYa7Jours.setDate(ilYa7Jours.getDate() - 7);
          
          const stats = {
            total: membres.length,
            aujourdhui: membres.filter(m => {
              const dateMembre = new Date(m.created_at).toDateString();
              return dateMembre === aujourdhui;
            }).length,
            cetteSemaine: membres.filter(m => {
              const dateMembre = new Date(m.created_at);
              return dateMembre >= ilYa7Jours;
            }).length,
            parQuartier: {}
          };
          
          // Par quartier
          membres.forEach(m => {
            const quartier = m.quartier || 'Non spécifié';
            stats.parQuartier[quartier] = (stats.parQuartier[quartier] || 0) + 1;
          });
          
          // Vérifier si on a assez d'espace pour les stats
          if (y < 600) { // Assez d'espace sur la même page
            // Stats sur la même page
            doc.moveDown(3);
            
            doc.fontSize(12)
               .font('Helvetica-Bold')
               .fillColor('#3498db')
               .text('STATISTIQUES:', { underline: true });
            
            doc.moveDown(0.5);
            doc.fontSize(11)
               .font('Helvetica')
               .fillColor('#2c3e50')
               .text(`• Total: ${stats.total} membres`);
            
            doc.text(`• Cette semaine: ${stats.cetteSemaine}`);
            doc.text(`• Aujourd'hui: ${stats.aujourdhui}`);
            
            // Répartition par quartier
            if (Object.keys(stats.parQuartier).length > 0) {
              doc.moveDown(1);
              doc.fontSize(11)
                 .font('Helvetica-Bold')
                 .fillColor('#3498db')
                 .text('Par quartier:');
              
              Object.entries(stats.parQuartier).forEach(([quartier, count]) => {
                doc.fontSize(10)
                   .font('Helvetica')
                   .fillColor('#2c3e50')
                   .text(`  - ${quartier}: ${count} membre${count > 1 ? 's' : ''}`);
              });
            }
          } else {
            // Nouvelle page pour les stats
            doc.addPage();
            
            doc.fontSize(18)
               .font('Helvetica-Bold')
               .fillColor('#2c3e50')
               .text('STATISTIQUES DU SERVICE', 50, 50, { underline: true });
            
            let statY = 100;
            
            doc.fontSize(12)
               .font('Helvetica-Bold')
               .fillColor('#3498db')
               .text('Résumé général:', 50, statY);
            
            statY += 25;
            doc.fontSize(11)
               .font('Helvetica')
               .fillColor('#2c3e50')
               .text(`• Total des membres: ${stats.total}`, 70, statY);
            
            statY += 20;
            doc.text(`• Inscrits cette semaine: ${stats.cetteSemaine}`, 70, statY);
            
            statY += 20;
            doc.text(`• Inscrits aujourd'hui: ${stats.aujourdhui}`, 70, statY);
            
            statY += 40;
            doc.fontSize(12)
               .font('Helvetica-Bold')
               .fillColor('#3498db')
               .text('Répartition par quartier:', 50, statY);
            
            statY += 25;
            
            // Trier par nombre décroissant
            const quartiersTries = Object.entries(stats.parQuartier)
              .sort((a, b) => b[1] - a[1]);
            
            quartiersTries.forEach(([quartier, count]) => {
              const pourcentage = ((count / stats.total) * 100).toFixed(1);
              doc.fontSize(11)
                 .font('Helvetica')
                 .fillColor('#2c3e50')
                 .text(`• ${quartier}: ${count} membre${count > 1 ? 's' : ''} (${pourcentage}%)`, 70, statY);
              statY += 20;
            });
          }
        }
      }
      
      // ===== PIED DE PAGE SIMPLIFIÉ (CORRIGÉ) =====
      try {
        // Attendre que le document soit prêt
        setTimeout(() => {
          try {
            // Méthode plus simple pour le pied de page
            const pageCount = doc.bufferedPageRange ? doc.bufferedPageRange().count : 1;
            
            if (pageCount > 0) {
              // Aller à la dernière page
              doc.switchToPage(pageCount - 1);
              
              // Pied de page
              doc.fontSize(8)
                 .font('Helvetica')
                 .fillColor('#7f8c8d')
                 .text(
                   `Document généré le ${new Date().toLocaleDateString('fr-FR')} • Mega-Data Église • Page ${pageCount}/${pageCount}`,
                   50,
                   doc.page.height - 30,
                   { align: 'center', width: doc.page.width - 100 }
                 );
            }
          } catch (footerError) {
            console.log('ℹ️ [PDF] Erreur pied de page mineure:', footerError.message);
            // Ignorer - le PDF sera généré sans pied de page
          }
          
          // Finaliser le PDF
          doc.end();
        }, 100);
        
      } catch (error) {
        console.log('⚠️ [PDF] Fin alternative du document');
        doc.end();
      }
      
      console.log(`✅ [PDF] PDF généré avec succès pour ${serviceAssigne} (${membres.length} membres)`);
      console.log('🔍 [PDF] ===== FIN GÉNÉRATION PDF =====\n');
    });
  },
  
  // Version simple pour admin
  generateAdminPDF: (req, res) => {
    if (!['admin', 'super_admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Accès réservé aux administrateurs'
      });
    }
    
    console.log('🔍 [PDF Admin] Génération PDF administratif');
    
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50
    });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="rapport_admin.pdf"');
    
    doc.pipe(res);
    
    doc.fontSize(24)
       .font('Helvetica-Bold')
       .fillColor('#2c3e50')
       .text('RAPPORT ADMINISTRATIF', { align: 'center' });
    
    doc.moveDown();
    doc.fontSize(16)
       .font('Helvetica')
       .fillColor('#3498db')
       .text('Mega-Data Église - Gestion des membres', { align: 'center' });
    
    doc.moveDown(2);
    
    doc.fontSize(12)
       .font('Helvetica')
       .fillColor('#2c3e50')
       .text(`Généré par: ${req.user.nom} ${req.user.prenom} (${req.user.username})`);
    
    doc.text(`Rôle: ${req.user.role}`);
    doc.text(`Date: ${new Date().toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })}`);
    
    doc.moveDown(2);
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .fillColor('#e74c3c')
       .text('Fonctionnalités disponibles:', { underline: true });
    
    doc.moveDown();
    doc.fontSize(11)
       .font('Helvetica')
       .fillColor('#2c3e50')
       .text('• Gestion complète des membres')
       .text('• Tableaux de bord par service')
       .text('• Export PDF pour chaque berger')
       .text('• Statistiques détaillées')
       .text('• Administration des utilisateurs')
       .text('• Normalisation des services');
    
    // Pied de page simple
    try {
      const pageCount = doc.bufferedPageRange ? doc.bufferedPageRange().count : 1;
      if (pageCount > 0) {
        doc.switchToPage(pageCount - 1);
        doc.fontSize(8)
           .font('Helvetica')
           .fillColor('#7f8c8d')
           .text(
             `Document administratif • Mega-Data Église • ${new Date().toLocaleDateString('fr-FR')}`,
             50,
             doc.page.height - 30,
             { align: 'center', width: doc.page.width - 100 }
           );
      }
    } catch (error) {
      // Ignorer l'erreur de pied de page
    }
    
    doc.end();
    
    console.log('✅ [PDF Admin] PDF administratif généré');
  }
};

module.exports = pdfController;