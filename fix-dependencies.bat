@echo off
echo ========================================
echo AJOUT DES DEPENDANCES MANQUANTES
echo ========================================
echo.

cd /d "C:\Users\GILDKCOMCEPT\Desktop\react\mega-data\backend"

echo 1. Installation des dependances manquantes...
call npm install json2csv@^5.0.7 express-validator@^6.15.0 body-parser@^1.20.2

echo.
echo 2. Mise a jour package.json...
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
echo     "body-parser": "^1.20.2",
echo     "cors": "^2.8.5",
echo     "dotenv": "^16.0.3",
echo     "express": "^4.18.2",
echo     "express-validator": "^6.15.0",
echo     "json2csv": "^5.0.7",
echo     "jsonwebtoken": "^9.0.0",
echo     "pdfkit": "^0.17.2",
echo     "sqlite3": "^5.1.6"
echo   },
echo   "devDependencies": {
echo     "nodemon": "^2.0.22"
echo   }
echo }
) > package.json

echo.
echo 3. Reinstallation complete...
if exist node_modules rmdir /s /q node_modules
if exist package-lock.json del package-lock.json
call npm install

echo.
echo 4. Test local...
echo Lancez dans un autre terminal: npm start
echo Si ca fonctionne, continuez...

echo.
echo 5. Git...
git add package.json package-lock.json
git commit -m "Fix: Add missing dependencies (json2csv, express-validator, body-parser)"
git push origin main

echo.
echo ========================================
echo ✅ DEPENDANCES AJOUTEES !
echo ========================================
echo.
echo Railway va redéployer automatiquement.
echo Plus d'erreur 'Cannot find module json2csv' !
echo.
pause