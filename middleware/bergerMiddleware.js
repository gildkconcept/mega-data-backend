const jwt = require('jsonwebtoken');
require('dotenv').config();

const bergerMiddleware = () => {
  return (req, res, next) => {
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        message: 'Accès refusé. Token manquant.' 
      });
    }
    
    const token = authHeader.substring(7);
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Vérifier que c'est un berger
      if (decoded.role !== 'berger') {
        return res.status(403).json({ 
          success: false, 
          message: 'Accès réservé aux bergers.' 
        });
      }
      
      req.user = decoded;
      next();
    } catch (error) {
      // ... gestion erreurs ...
    }
  };
};

module.exports = bergerMiddleware;