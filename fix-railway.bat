@echo off
echo ========================================
echo CORRECTION POUR RAILWAY
echo ========================================
echo.

cd /d "C:\Users\GILDKCOMCEPT\Desktop\react\mega-data\backend"

echo 1. Nettoyage complet...
if exist node_modules rmdir /s /q node_modules
if exist package-lock.json del package-lock.json

echo.
echo 2. Creation package.json simplifie...
(
echo {
echo   "name": "mega-data-server",
echo   "version": "1.0.0",
echo   "main": "server.js",
echo   "scripts": {
echo     "start": "node server.js",
echo     "dev": "nodemon server.js"
echo   },
echo   "dependencies": {
echo     "bcryptjs": "^2.4.3",
echo     "cors": "^2.8.5",
echo     "dotenv": "^16.0.3",
echo     "express": "^4.18.2",
echo     "jsonwebtoken": "^9.0.0",
echo     "pdfkit": "^0.17.2",
echo     "sqlite3": "^5.1.6"
echo   }
echo }
) > package.json

echo.
echo 3. Installation...
call npm install

echo.
echo 4. Creation railway.toml...
(
echo [build]
echo builder = "nixpacks"
echo buildCommand = "npm install"
echo 
echo [deploy]
echo startCommand = "node server.js"
echo healthcheckPath = "/api/health"
echo port = 3000
) > railway.toml

echo.
echo 5. Git...
git add package.json package-lock.json railway.toml
git commit -m "Fix: Railway deployment with clean setup"
git push origin main

echo.
echo ========================================
echo ✅ CORRIGE POUR RAILWAY !
echo ========================================
echo.
echo Railway va maintenant:
echo 1. Utiliser npm install au lieu de npm ci
echo 2. Installer les dependances correctement
echo 3. Demarrer sur le port 3000
echo.
echo Laissez Railway redéployer automatiquement...
pause