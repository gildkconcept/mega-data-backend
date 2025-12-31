@echo off
echo ========================================
echo NETTOYAGE COMPLET POUR RENDER
echo ========================================
echo.

cd /d "C:\Users\GILDKCOMCEPT\Desktop\react\mega-data\backend"

echo 1. Sauvegarde package.json...
copy package.json package.json.backup

echo 2. Suppression node_modules...
if exist node_modules rmdir /s /q node_modules

echo 3. Suppression package-lock.json...
if exist package-lock.json del package-lock.json

echo 4. Reinstallation...
call npm install

echo 5. Verification iconv-lite...
call npm ls iconv-lite

echo.
echo 6. Git...
git add package.json package-lock.json
git commit -m "Clean install for Render compatibility"
git push origin main

echo.
echo ✅ Nettoyage termine ! Render va redéployer.
echo.
pause