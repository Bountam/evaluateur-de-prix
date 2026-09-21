@echo off
chcp 65001 > nul
title Envoi vers GitHub - Évaluateur de Prix Insertech

echo =============================================================
echo   ENVOI DU PROJET VERS GITHUB (Bountam/evaluateur-de-prix)
echo =============================================================
echo.
echo Cette commande va synchroniser vos modifications locales vers GitHub.
echo Une fenetre de connexion GitHub va s'ouvrir si vous n'etes pas encore connecte.
echo.

echo Branche locale : master (v1.4.1 + Synchronisation demarrage + Export Excel)
echo Depot distant  : https://github.com/Bountam/evaluateur-de-prix.git
echo.

echo Options d'envoi :
echo  1. Mettre a jour la branche principale 'main' (Recommande)
echo  2. Pousser sur une nouvelle branche 'master'
echo.
set /p CHOICE="Entrez votre choix [1 ou 2] (Defaut: 1) : "

if "%CHOICE%"=="2" (
    echo.
    echo Envoi en cours vers 'master'...
    git push -u origin master
) else (
    echo.
    echo Envoi en cours vers 'main' (mise a jour complete)...
    git push -u origin master:main --force
)

echo.
if %ERRORLEVEL% equ 0 (
    echo =============================================================
    echo   SUCCES : Toutes les modifications sont en ligne sur GitHub !
    echo =============================================================
) else (
    echo =============================================================
    echo   ATTENTION : L'envoi a echoue. Verifiez votre compte GitHub.
    echo =============================================================
)
echo.
pause
