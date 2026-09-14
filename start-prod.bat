@echo off
setlocal
echo ========================================================
echo   Evaluateur de Prix Insertech - Mode Production Portable
echo ========================================================
echo.

:: Vérifier la présence de Node.js local (portable)
if not exist "node-v22.14.0-win-x64\node.exe" (
    echo [ERREUR] Node.js n'est pas installe dans node-v22.14.0-win-x64.
    echo Veuillez l'extraire ou executer "Lancer-Insertech-GUI.vbs" en dev.
    pause
    exit /b 1
)

:: Definir les variables d'environnement
set NODE_ENV=production
set PORT=3000

echo [INFO] Environnement: %NODE_ENV%
echo [INFO] Port: %PORT%
echo.

:: Demarrage du serveur avec une boucle infinie de redemarrage (PM2 like simple)
:restart
echo [INFO] Demarrage du serveur...
"node-v22.14.0-win-x64\node.exe" server.ts
echo.
echo [ATTENTION] Le serveur s'est arrete (crash ou fermeture manuelle).
echo Redemarrage automatique dans 5 secondes... Appuyez sur Ctrl+C pour annuler.
timeout /t 5 /nobreak > nul
goto restart
