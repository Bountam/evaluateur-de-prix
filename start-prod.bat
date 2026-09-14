@echo off
setlocal
echo ========================================================
echo   Evaluateur de Prix Insertech - Mode Production
echo ========================================================
echo.

set NODE_BIN=node
if exist "node-v22.14.0-win-x64\node.exe" set NODE_BIN="%~dp0node-v22.14.0-win-x64\node.exe"
if exist "%~dp0node.exe" set NODE_BIN="%~dp0node.exe"

set NODE_ENV=production
set HOST=127.0.0.1
set PORT=3000

echo [INFO] Environnement: %NODE_ENV%
echo [INFO] Port: %PORT%
echo [INFO] Utilisation de Node.js: %NODE_BIN%
echo.

if not exist "%~dp0dist\server.js" (
    echo [INFO] Fichier dist\server.js manquant. Generation du build...
    %NODE_BIN% "%~dp0node_modules\esbuild\bin\esbuild" server.ts --bundle --platform=node --format=esm --packages=external --outfile=dist/server.js
)

start "" "http://127.0.0.1:3000"

:restart
echo [INFO] Demarrage du serveur Insertech...
%NODE_BIN% "%~dp0dist\server.js"
echo.
echo [ATTENTION] Le serveur s'est arrete (crash ou fermeture manuelle).
echo Redemarrage automatique dans 5 secondes... Appuyez sur Ctrl+C pour annuler.
timeout /t 5 /nobreak > nul
goto restart
