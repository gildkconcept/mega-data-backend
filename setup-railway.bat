@echo off
echo ========================================
echo PREPARATION POUR RAILWAY
echo ========================================
echo.

cd /d "C:\Users\GILDKCOMCEPT\Desktop\react\mega-data\backend"

echo 1. Nettoyage...
if exist node_modules rmdir /s /q node_modules
if exist package-lock.json del package-lock.json

echo.
echo 2. Package.json pour Railway...
(
echo {
echo   "name": "mega-data-server",
echo   "version": "1.0.0",
echo   "main": "server.js",
echo   "scripts": {
echo     "start": "node server.js",
echo     "dev": "nodemon server.js"
echo   },
echo   "engines": {
echo     "node": "18.x"
echo   },
echo   "dependencies": {
echo     "bcryptjs": "^2.4.3",
echo     "cors": "^2.8.5",
echo     "dotenv": "^16.0.3",
echo     "express": "^4.18.2",
echo     "jsonwebtoken": "^9.0.0",
echo     "pdfkit": "^0.17.2",
echo     "sqlite3": "^5.0.11"
echo   }
echo }
) > package.json

echo.
echo 3. Installation locale...
call npm install

echo.
echo 4. Test local...
echo Lancez dans un autre terminal:
echo npm start
echo.
echo 5. Allez sur https://railway.app
echo - Connectez GitHub
echo - New Project ^> Deploy from GitHub
echo - Choisissez votre repo
echo - Ajoutez les variables d'environnement
echo.
echo ✅ Pret pour Railway !
pause