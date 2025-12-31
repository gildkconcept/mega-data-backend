const jwt = require('jsonwebtoken');
require('dotenv').config();

// Middleware d'authentification principal
const authMiddleware = (requiredRole = null) => {
  return (req, res, next) => {
    // Récupérer le token depuis les headers
    const authHeader = req.header('Authorization');
    
    // Vérifier la présence du header
    if (!authHeader) {
      return res.status(401).json({ 
        success: false, 
        message: 'Accès refusé. Token manquant.' 
      });
    }
    
    // Vérifier le format Bearer
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Format Authorization invalide. Utilisez: Bearer <token>'
      });
    }
    
    const token = authHeader.substring(7); // "Bearer ".length = 7
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Accès refusé. Token manquant.' 
      });
    }
    
    try {
      // Vérifier le token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Vérifier la structure du token décodé
      if (!decoded.id || !decoded.username || !decoded.role) {
        return res.status(401).json({
          success: false,
          message: 'Token corrompu: données utilisateur manquantes'
        });
      }
      
      req.user = decoded;
      
      // Vérifier le rôle si nécessaire
      if (requiredRole) {
        // Définir la hiérarchie des rôles
        const roleHierarchy = {
          'member': ['member'],
          'berger': ['berger', 'admin', 'super_admin'],
          'admin': ['admin', 'super_admin'],
          'super_admin': ['super_admin']
        };
        
        const allowedRoles = roleHierarchy[requiredRole] || [requiredRole];
        
        if (!allowedRoles.includes(decoded.role)) {
          return res.status(403).json({ 
            success: false, 
            message: 'Accès interdit. Rôle insuffisant.' 
          });
        }
      }
      
      // Logging optionnel en développement
      if (process.env.NODE_ENV === 'development') {
        console.log(`✅ Authentifié: ${decoded.username} (${decoded.role})`);
      }
      
      next();
    } catch (error) {
      console.error('❌ Erreur vérification token:', error.message);
      
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ 
          success: false, 
          message: 'Token expiré. Veuillez vous reconnecter.' 
        });
      }
      
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({ 
          success: false, 
          message: 'Token invalide.' 
        });
      }
      
      return res.status(401).json({ 
        success: false, 
        message: 'Erreur d\'authentification.' 
      });
    }
  };
};

module.exports = authMiddleware;