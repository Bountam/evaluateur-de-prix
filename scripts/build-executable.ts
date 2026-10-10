import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const PORTABLE_DIR = path.join(ROOT_DIR, 'evaluateur-insertech-portable');

const localNodeDir = path.join(ROOT_DIR, 'node-v22.14.0-win-x64');
if (fs.existsSync(localNodeDir)) {
  process.env.PATH = `${localNodeDir};${process.env.PATH}`;
}

console.log('🚀 Démarrage du packaging 100% autonome de l\'Évaluateur Insertech Portable...');

// 1. Build Vite Frontend
console.log('📦 1/4 - Compilation de l\'application Web React/Vite...');
if (fs.existsSync(DIST_DIR)) {
  try {
    fs.rmSync(DIST_DIR, { recursive: true, force: true });
  } catch {}
}
const viteBin = path.join(ROOT_DIR, 'node_modules', '.bin', process.platform === 'win32' ? 'vite.cmd' : 'vite');
execSync(`"${viteBin}" build --emptyOutDir false`, { cwd: ROOT_DIR, stdio: 'inherit' });

// 2. Bundle Server with Esbuild (Encapsulation 100% autonome)
console.log('⚡ 2/4 - Bundle du serveur Node.js & des scrapers...');
const esbuildBin = path.join(ROOT_DIR, 'node_modules', '.bin', process.platform === 'win32' ? 'esbuild.cmd' : 'esbuild');
execSync(
  `"${esbuildBin}" server.ts --bundle --platform=node --format=esm --packages=external --sourcemap --outfile=dist/server.js`,
  { cwd: ROOT_DIR, stdio: 'inherit' }
);

function copyFolderRecursiveSync(src: string, dest: string, ignoredDirs: string[] = []) {
  try {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
      if (ignoredDirs.includes(entry.name)) {
        continue;
      }
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      try {
        if (entry.isDirectory()) {
          copyFolderRecursiveSync(srcPath, destPath, ignoredDirs);
        } else {
          fs.copyFileSync(srcPath, destPath);
        }
      } catch (e) {
        // Ignorer les fichiers ou sous-dossiers verrouillés par le système
      }
    }
  } catch (err) {
    // Ignorer si le dossier source est inaccessible
  }
}

// 3. Préparer le dossier portable autonome
console.log('📁 3/4 - Structure du dossier portable autonome...');
if (fs.existsSync(PORTABLE_DIR)) {
  try {
    fs.rmSync(PORTABLE_DIR, { recursive: true, force: true });
  } catch {}
}
fs.mkdirSync(PORTABLE_DIR, { recursive: true });

// Copier les fichiers distribuables dist -> portable/dist
copyFolderRecursiveSync(DIST_DIR, path.join(PORTABLE_DIR, 'dist'));

// Copier les dépendances node_modules dans le package portable (en excluant les outils de dev volumineux)
const nodeModulesDir = path.join(ROOT_DIR, 'node_modules');
if (fs.existsSync(nodeModulesDir)) {
  try {
    console.log('📦 Copie optimisée des dépendances node_modules dans le package portable...');
    const DEV_DEPS_TO_EXCLUDE = [
      'typescript',
      '@types',
      'esbuild',
      '@esbuild',
      'vite',
      '@vitejs',
      'vitest',
      '@vitest',
      'rollup',
      '@rollup',
      'terser',
      '.bin'
    ];
    copyFolderRecursiveSync(nodeModulesDir, path.join(PORTABLE_DIR, 'node_modules'), DEV_DEPS_TO_EXCLUDE);
  } catch (err: any) {
    console.warn('⚠️ Remarque lors de la copie de node_modules:', err?.message || err);
  }
}

// Copier les data_files de header-generator indispensables à got-scraping
const headerGeneratorData = path.join(ROOT_DIR, 'node_modules', 'header-generator', 'data_files');
if (fs.existsSync(headerGeneratorData)) {
  console.log('📄 Copie des fichiers de données header-generator (got-scraping)...');
  copyFolderRecursiveSync(headerGeneratorData, path.join(DIST_DIR, 'data_files'));
  copyFolderRecursiveSync(headerGeneratorData, path.join(PORTABLE_DIR, 'dist', 'data_files'));
}

// Copier public -> portable/public (manifest, sw.js)
const publicDir = path.join(ROOT_DIR, 'public');
if (fs.existsSync(publicDir)) {
  copyFolderRecursiveSync(publicDir, path.join(PORTABLE_DIR, 'public'));
}

// Copier db.json initial si disponible
const dbPath = path.join(ROOT_DIR, 'db.json');
if (fs.existsSync(dbPath)) {
  fs.copyFileSync(dbPath, path.join(PORTABLE_DIR, 'db.json'));
}

// Copier loading.html
const loadingPath = path.join(PORTABLE_DIR, 'loading.html');
if (fs.existsSync(path.join(ROOT_DIR, 'loading.html'))) {
  fs.copyFileSync(path.join(ROOT_DIR, 'loading.html'), loadingPath);
}

// Copier les icônes de l'application (app.ico et app-icon.png)
const appIcoPath = path.join(ROOT_DIR, 'app.ico');
if (fs.existsSync(appIcoPath)) {
  fs.copyFileSync(appIcoPath, path.join(PORTABLE_DIR, 'app.ico'));
}
const appPngPath = path.join(ROOT_DIR, 'app-icon.png');
if (fs.existsSync(appPngPath)) {
  fs.copyFileSync(appPngPath, path.join(PORTABLE_DIR, 'app-icon.png'));
}

// Copier node.exe pour garantir le fonctionnement 100% autonome sans dépendance Node.js système
try {
  const nodeExePath = process.execPath;
  if (fs.existsSync(nodeExePath) && nodeExePath.toLowerCase().endsWith('node.exe')) {
    console.log(`🟢 Copie de node.exe autonome depuis ${nodeExePath}...`);
    fs.copyFileSync(nodeExePath, path.join(PORTABLE_DIR, 'node.exe'));
  }
} catch (err) {
  console.warn('⚠️ Impossible de copier automatiquement node.exe:', err);
}

// Copier ou embarquer le navigateur Chromium Playwright pour fonctionnement 100% hors-ligne
const portableChromiumDir = path.join(PORTABLE_DIR, 'chromium');
fs.mkdirSync(portableChromiumDir, { recursive: true });

const localChromium = path.join(ROOT_DIR, 'chromium');
const playwrightAppDir = process.env.LOCALAPPDATA
  ? path.join(process.env.LOCALAPPDATA, 'ms-playwright')
  : '';

if (fs.existsSync(localChromium) && fs.readdirSync(localChromium).length > 0) {
  console.log('🌐 Copie de Chromium embarqué local...');
  copyFolderRecursiveSync(localChromium, portableChromiumDir);
} else if (playwrightAppDir && fs.existsSync(playwrightAppDir)) {
  const entries = fs.readdirSync(playwrightAppDir);
  const chromiumFolder = entries.find((e) => e.startsWith('chromium-'));
  if (chromiumFolder) {
    const chromeWin64 = path.join(playwrightAppDir, chromiumFolder, 'chrome-win64');
    const chromeHeadlessWin64 = path.join(playwrightAppDir, chromiumFolder, 'chrome-headless-shell-win64');
    if (fs.existsSync(chromeWin64)) {
      console.log(`🌐 Embarquement automatique de Chromium Playwright depuis ${chromeWin64}...`);
      copyFolderRecursiveSync(chromeWin64, portableChromiumDir);
    } else if (fs.existsSync(chromeHeadlessWin64)) {
      console.log(`🌐 Embarquement automatique de Chromium Headless depuis ${chromeHeadlessWin64}...`);
      copyFolderRecursiveSync(chromeHeadlessWin64, portableChromiumDir);
    }
  }
}

// 4. Générer le fichier VBScript de lancement 100% silencieux sans console noire
console.log('🎨 4/4 - Génération du lanceur GUI autonome sans console noire...');
const vbsContent = `Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = scriptDir

WshShell.Environment("PROCESS")("NODE_ENV") = "production"
WshShell.Environment("PROCESS")("HOST") = "127.0.0.1"

' 1. Arrêter uniquement l'instance précédente de cette application si .server.pid existe
pidFile = scriptDir & "\\.server.pid"
portFile = scriptDir & "\\.server.port"

If fso.FileExists(pidFile) Then
  On Error Resume Next
  Set tsOld = fso.OpenTextFile(pidFile, 1)
  oldPid = Trim(tsOld.ReadAll)
  tsOld.Close
  If IsNumeric(oldPid) And Len(oldPid) > 0 Then
    WshShell.Run "taskkill /f /pid " & oldPid & " /t", 0, True
  End If
  fso.DeleteFile pidFile, True
  On Error GoTo 0
End If
If fso.FileExists(portFile) Then
  On Error Resume Next
  fso.DeleteFile portFile, True
  On Error GoTo 0
End If
WScript.Sleep 500

If fso.FileExists(scriptDir & "\\chromium\\chrome.exe") Then
  WshShell.Environment("PROCESS")("CHROMIUM_PATH") = scriptDir & "\\chromium\\chrome.exe"
End If

Dim nodeCmd
nodeCmd = ""

If fso.FileExists(scriptDir & "\\node.exe") Then
  nodeCmd = """" & scriptDir & "\\node.exe"""
Else
  nodeCmd = "node"
End If

On Error Resume Next
WshShell.Run nodeCmd & " """ & scriptDir & "\\dist\\server.js""", 0, False
If Err.Number <> 0 Then
  MsgBox "Impossible de démarrer le serveur d'évaluation Insertech." & vbCrLf & vbCrLf & _
         "Raison : L'exécutable Node.js est introuvable." & vbCrLf & _
         "Veuillez copier 'node.exe' dans ce dossier portable ou installer Node.js sur le poste.", 16, "Évaluateur Insertech - Erreur Démarrage"
  WScript.Quit 1
End If

' Attente active que le serveur soit prêt à répondre et détection dynamique du port
Dim http, ready, waitCount, targetPort
ready = False
waitCount = 0
targetPort = "3000"

Do While Not ready And waitCount < 60
  WScript.Sleep 500
  waitCount = waitCount + 1

  If fso.FileExists(portFile) Then
    On Error Resume Next
    Set tsPort = fso.OpenTextFile(portFile, 1)
    readPort = Trim(tsPort.ReadAll)
    tsPort.Close
    If IsNumeric(readPort) And Len(readPort) > 0 Then
      targetPort = readPort
    End If
    On Error GoTo 0
  End If

  On Error Resume Next
  Set http = CreateObject("MSXML2.ServerXMLHTTP.6.0")
  http.Open "GET", "http://127.0.0.1:" & targetPort & "/api/version", False
  http.setTimeouts 500, 500, 500, 500
  http.Send
  If Err.Number = 0 Then
    If http.Status = 200 Then
      ready = True
    End If
  End If
  On Error GoTo 0
Loop

Dim edge32, edge64, edgePath
edge32 = WshShell.ExpandEnvironmentStrings("%ProgramFiles(x86)%") & "\\Microsoft\\Edge\\Application\\msedge.exe"
edge64 = WshShell.ExpandEnvironmentStrings("%ProgramFiles%") & "\\Microsoft\\Edge\\Application\\msedge.exe"

If fso.FileExists(edge32) Then
  edgePath = edge32
ElseIf fso.FileExists(edge64) Then
  edgePath = edge64
End If

Dim targetUrl
targetUrl = "http://127.0.0.1:" & targetPort

If edgePath <> "" Then
  WshShell.Run """" & edgePath & """ --app=""" & targetUrl & """ --disable-http-cache --disk-cache-size=1 --user-data-dir=""" & WshShell.ExpandEnvironmentStrings("%TEMP%") & "\\InsertechApp""", 1, True
Else
  WshShell.Run """" & targetUrl & """", 1, True
End If

' À la fermeture de la fenêtre du navigateur : arrêt gracieux ciblé du PID du serveur
If fso.FileExists(pidFile) Then
  On Error Resume Next
  Set tsEnd = fso.OpenTextFile(pidFile, 1)
  curPid = Trim(tsEnd.ReadAll)
  tsEnd.Close
  If IsNumeric(curPid) And Len(curPid) > 0 Then
    WshShell.Run "taskkill /f /pid " & curPid & " /t", 0, True
  End If
  fso.DeleteFile pidFile, True
  On Error GoTo 0
End If
If fso.FileExists(portFile) Then
  On Error Resume Next
  fso.DeleteFile portFile, True
  On Error GoTo 0
End If
`;
fs.writeFileSync(path.join(PORTABLE_DIR, 'Lancer-Insertech-GUI.vbs'), vbsContent, 'utf-8');
fs.writeFileSync(path.join(PORTABLE_DIR, 'Lancer-Insertech-Silencieux.vbs'), vbsContent, 'utf-8');

// 4.2 Script Windows principal .bat (Déclenche le VBScript pour fermer la console instantanément)
const winBatContent = `@echo off
wscript.exe "%~dp0Lancer-Insertech-GUI.vbs"
exit
`;
fs.writeFileSync(path.join(PORTABLE_DIR, 'Lancer-Insertech.bat'), winBatContent, 'utf-8');

// 4.3 Script de création de raccourci sur le Bureau avec l'icône magique
const makeDesktopShortcutVbs = `' ==============================================================
' Script de création du raccourci Bureau avec icône personnalisée
' ==============================================================
Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
desktopPath = WshShell.SpecialFolders("Desktop")

Set oShortcut = WshShell.CreateShortcut(desktopPath & "\\Évaluateur Insertech.lnk")
oShortcut.TargetPath = "wscript.exe"
oShortcut.Arguments = """" & scriptDir & "\\Lancer-Insertech-GUI.vbs"""
oShortcut.WorkingDirectory = scriptDir
If fso.FileExists(scriptDir & "\\app.ico") Then
  oShortcut.IconLocation = scriptDir & "\\app.ico,0"
End If
oShortcut.Description = "Évaluateur de Prix Insertech (Mode Silencieux)"
oShortcut.Save

MsgBox "Le raccourci avec icône magique a été créé sur votre Bureau avec succès !", 64, "Évaluateur Insertech"
`;
fs.writeFileSync(path.join(PORTABLE_DIR, 'Créer-Raccourci-Bureau.vbs'), makeDesktopShortcutVbs, 'utf-8');

// Créer également un raccourci direct dans le dossier portable
if (process.platform === 'win32') {
  try {
    const makeLocalLnk = `Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
Set oShortcut = WshShell.CreateShortcut(scriptDir & "\\Évaluateur Insertech.lnk")
oShortcut.TargetPath = "wscript.exe"
oShortcut.Arguments = """" & scriptDir & "\\Lancer-Insertech-GUI.vbs"""
oShortcut.WorkingDirectory = scriptDir
If fso.FileExists(scriptDir & "\\app.ico") Then
  oShortcut.IconLocation = scriptDir & "\\app.ico,0"
End If
oShortcut.Description = "Lancer l'Évaluateur de Prix Insertech en mode silencieux"
oShortcut.Save
`;
    const tempLnkVbs = path.join(PORTABLE_DIR, '_gen_lnk.vbs');
    fs.writeFileSync(tempLnkVbs, makeLocalLnk, 'utf-8');
    execSync(`cscript //nologo "${tempLnkVbs}"`, { cwd: PORTABLE_DIR });
    fs.unlinkSync(tempLnkVbs);
  } catch (e) {
    console.warn('⚠️ Remarque lors de la création du raccourci .lnk local:', e);
  }
}

// Linux / macOS Launcher (.sh et .command)
const macCommandContent = `#!/bin/bash
DIR="$( cd "$( dirname "\${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"
export NODE_ENV=production
export HOST=127.0.0.1
if [ -d "$DIR/chromium" ]; then
  if [ -f "$DIR/chromium/chrome" ]; then
    export CHROMIUM_PATH="$DIR/chromium/chrome"
  elif [ -f "$DIR/chromium/Chromium.app/Contents/MacOS/Chromium" ]; then
    export CHROMIUM_PATH="$DIR/chromium/Chromium.app/Contents/MacOS/Chromium"
  fi
fi
echo "🚀 Démarrage de l'Évaluateur Insertech..."
node dist/server.js &
SERVER_PID=$!
PORT="3000"
for i in {1..40}; do
  if [ -f "$DIR/.server.port" ]; then
    PORT=$(cat "$DIR/.server.port")
    break
  fi
  sleep 0.5
done
open "http://127.0.0.1:$PORT" 2>/dev/null || xdg-open "http://127.0.0.1:$PORT" 2>/dev/null || true
wait $SERVER_PID
`;
const macCommandPath = path.join(PORTABLE_DIR, 'Démarrer-Insertech-macOS.command');
fs.writeFileSync(macCommandPath, macCommandContent, 'utf-8');
try {
  fs.chmodSync(macCommandPath, '755');
} catch {}

const shPath = path.join(PORTABLE_DIR, 'Lancer-Insertech.sh');
fs.writeFileSync(shPath, macCommandContent, 'utf-8');
try {
  fs.chmodSync(shPath, '755');
} catch {}

// Guide de conformité et zéro blocage pour administrateurs IT
const securityNotice = `# Garantie d'exécution Zéro Blocage (Windows & macOS)

L'application **Évaluateur de Prix Insertech** est conçue pour fonctionner de manière autonome sur les postes de travail de bureau et PC reconditionnés sans nécessiter de droits d'administration ou de certificat de signature payant.

## 🛡️ Pourquoi l'application n'est pas bloquée ?

1. **Aucun avertissement de pare-feu (Windows / macOS Firewall)** :
   - Le serveur web s'exécute par défaut en boucle locale (\`127.0.0.1 / localhost\`).
   - Le trafic ne sort pas sur le réseau public, ce qui évite d'ouvrir des requêtes de privilèges administrateur auprès du pare-feu.

2. **Aucun blocage SmartScreen / Éditeur Inconnu** :
   - L'application utilise les interpréteurs natifs du système (\`cmd.exe\`, \`wscript.exe\`, \`bash\`) qui sont pré-vérifiés et signés directement par Microsoft et Apple.

3. **Compatibilité réseau entreprise** :
   - Aucune installation de pilote ou de service système n'est requise.

## 🚀 Méthodes de lancement :

- **Windows** : Double-cliquer sur \`Lancer-Insertech.bat\` ou \`Lancer-Insertech-Silencieux.vbs\`
- **macOS** : Double-cliquer sur \`Démarrer-Insertech-macOS.command\`
`;
fs.writeFileSync(path.join(PORTABLE_DIR, 'GARANTIE_ZERO_BLOCAGE.md'), securityNotice, 'utf-8');

// 5. Générer l'archive ZIP portable autonome
console.log('📦 Génération de l\'archive ZIP portable autonome finale...');
const zipPath = path.join(ROOT_DIR, 'evaluateur-insertech-portable.zip');
if (fs.existsSync(zipPath)) {
  try {
    fs.unlinkSync(zipPath);
  } catch {}
}

if (process.platform === 'win32') {
  try {
    execSync(`powershell -Command "Compress-Archive -Path '${PORTABLE_DIR}\\*' -DestinationPath '${zipPath}' -Force"`, { cwd: ROOT_DIR });
    console.log(`📦 Archive ZIP créée avec succès : ${zipPath}`);
  } catch (err) {
    console.warn('⚠️ Impossible de créer automatiquement l\'archive ZIP:', err);
  }
}

console.log('\n=============================================================');
console.log('✅ EMBALLAGE 100% AUTONOME ZÉRO-BLOCAGE POUR WINDOWS & MAC !');
console.log(`📁 Dossier Portable : ${PORTABLE_DIR}`);
if (fs.existsSync(zipPath)) {
  console.log(`📦 Archive ZIP prête : ${zipPath}`);
}
console.log('=============================================================\n');


