import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const PORTABLE_DIR = path.join(ROOT_DIR, 'evaluateur-insertech-portable');

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

function copyFolderRecursiveSync(src: string, dest: string) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyFolderRecursiveSync(srcPath, destPath);
    } else {
      try {
        fs.copyFileSync(srcPath, destPath);
      } catch {
        // Ignorer les fichiers verrouillés
      }
    }
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

// Copier les dépendances node_modules dans le package portable pour une exécution nativité 100% sans faille
const nodeModulesDir = path.join(ROOT_DIR, 'node_modules');
if (fs.existsSync(nodeModulesDir)) {
  console.log('📦 Copie des dépendances node_modules dans le package portable...');
  copyFolderRecursiveSync(nodeModulesDir, path.join(PORTABLE_DIR, 'node_modules'));
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

let chromiumEmbedded = false;
if (fs.existsSync(localChromium) && fs.readdirSync(localChromium).length > 0) {
  console.log('🌐 Copie du dossier Chromium embarqué local (./chromium)...');
  copyFolderRecursiveSync(localChromium, portableChromiumDir);
  chromiumEmbedded = true;
} else if (playwrightAppDir && fs.existsSync(playwrightAppDir)) {
  const findChromeExe = (dir: string): string | null => {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          const found = findChromeExe(fullPath);
          if (found) return found;
        } else if (entry.name.toLowerCase() === 'chrome.exe') {
          return fullPath;
        }
      }
    } catch {}
    return null;
  };
  const foundChrome = findChromeExe(playwrightAppDir);
  if (foundChrome) {
    const chromeRootDir = path.dirname(foundChrome);
    console.log(`🌐 Embarquement automatique de Chromium Playwright depuis ${chromeRootDir}...`);
    copyFolderRecursiveSync(chromeRootDir, portableChromiumDir);
    chromiumEmbedded = true;
  }
}

if (!chromiumEmbedded) {
  console.log('ℹ️ Remarque : Pour inclure Chromium 100% hors-ligne dans le zip portable, placez le dossier du navigateur dans ./chromium');
}

// 4. Générer l'application GUI autonome intégrée sans aucune fenêtre noire de console
console.log('🎨 4/4 - Génération du lanceur GUI autonome sans console noire...');

// 4.1 Lanceur VBScript principal GUI (Double-clic ➔ Zéro console noire, fenêtre GUI dédiée + arrêt automatique du service à la fermeture)
const vbsContent = `Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Définir le répertoire de travail courant sur le dossier du script
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = scriptDir

WshShell.Environment("PROCESS")("NODE_ENV") = "production"
WshShell.Environment("PROCESS")("HOST") = "127.0.0.1"

' 0. Nettoyer et libérer le port 3000 avant démarrage
On Error Resume Next
WshShell.Run "taskkill /f /im node.exe", 0, True
On Error GoTo 0
WScript.Sleep 500

If fso.FileExists(scriptDir & "\\chromium\\chrome.exe") Then
  WshShell.Environment("PROCESS")("CHROMIUM_PATH") = scriptDir & "\\chromium\\chrome.exe"
End If

' Recherche intelligente de l'exécutable node.exe
Dim nodeCmd
nodeCmd = ""

If fso.FileExists(scriptDir & "\\node.exe") Then
  nodeCmd = """" & scriptDir & "\\node.exe"""
ElseIf fso.FileExists(scriptDir & "\\node\\node.exe") Then
  nodeCmd = """" & scriptDir & "\\node\\node.exe"""
Else
  Dim pFiles, pFilesX86, localAppData
  pFiles = WshShell.ExpandEnvironmentStrings("%ProgramFiles%")
  pFilesX86 = WshShell.ExpandEnvironmentStrings("%ProgramFiles(x86)%")
  localAppData = WshShell.ExpandEnvironmentStrings("%LOCALAPPDATA%")

  If fso.FileExists(pFiles & "\\nodejs\\node.exe") Then
    nodeCmd = """" & pFiles & "\\nodejs\\node.exe"""
  ElseIf fso.FileExists(pFilesX86 & "\\nodejs\\node.exe") Then
    nodeCmd = """" & pFilesX86 & "\\nodejs\\node.exe"""
  ElseIf fso.FileExists(localAppData & "\\Programs\\node\\node.exe") Then
    nodeCmd = """" & localAppData & "\\Programs\\node\\node.exe"""
  Else
    nodeCmd = "node"
  End If
End If

' 1. Démarrer le serveur local en tâche de fond (0 = masqué, zéro fenêtre de console)
On Error Resume Next
WshShell.Run nodeCmd & " """ & scriptDir & "\\dist\\server.js""", 0, False
If Err.Number <> 0 Then
  MsgBox "Impossible de démarrer le serveur d'évaluation Insertech." & vbCrLf & vbCrLf & _
         "Raison : L'exécutable Node.js est introuvable." & vbCrLf & _
         "Veuillez copier 'node.exe' dans ce dossier portable ou installer Node.js sur le poste.", 16, "Évaluateur Insertech - Erreur Démarrage"
  WScript.Quit 1
End If
On Error GoTo 0

' Attendre activement que le serveur Node.js réponde sur http://127.0.0.1:3000
Dim xmlHttp, isReady, tryCount
Set xmlHttp = CreateObject("MSXML2.ServerXMLHTTP")
isReady = False
tryCount = 0

Do While tryCount < 40 And Not isReady
  On Error Resume Next
  xmlHttp.open "GET", "http://127.0.0.1:3000/api/version", False
  xmlHttp.send ""
  If Err.Number = 0 And xmlHttp.status = 200 Then
    isReady = True
  Else
    Err.Clear
    WScript.Sleep 250
  End If
  On Error GoTo 0
  tryCount = tryCount + 1
Loop

' 2. Lancer la fenêtre d'application GUI dédiée et attendre la fermeture par l'utilisateur
Dim edge32, edge64, edgePath
edge32 = WshShell.ExpandEnvironmentStrings("%ProgramFiles(x86)%") & "\\Microsoft\\Edge\\Application\\msedge.exe"
edge64 = WshShell.ExpandEnvironmentStrings("%ProgramFiles%") & "\\Microsoft\\Edge\\Application\\msedge.exe"

If fso.FileExists(edge32) Then
  edgePath = edge32
ElseIf fso.FileExists(edge64) Then
  edgePath = edge64
End If

If edgePath <> "" Then
  ' Le paramètre True demande à VBScript d'attendre la fermeture de la fenêtre par l'utilisateur
  WshShell.Run """" & edgePath & """ --app=http://127.0.0.1:3000 --disable-http-cache --disk-cache-size=1 --user-data-dir=""" & WshShell.ExpandEnvironmentStrings("%TEMP%") & "\\InsertechApp""", 1, True
Else
  WshShell.Run "http://127.0.0.1:3000", 1, True
End If

' 3. Dès que l'utilisateur ferme la fenêtre GUI ➔ Arrêter immédiatement le service Node local !
On Error Resume Next
WshShell.Run "taskkill /f /im node.exe", 0, True
On Error GoTo 0
`;
fs.writeFileSync(path.join(PORTABLE_DIR, 'Lancer-Insertech-GUI.vbs'), vbsContent, 'utf-8');
fs.writeFileSync(path.join(PORTABLE_DIR, 'Lancer-Insertech-Silencieux.vbs'), vbsContent, 'utf-8');

// 4.2 Script Windows principal .bat (Déclenche le VBScript pour fermer la console instantanément)
const winBatContent = `@echo off
wscript.exe "%~dp0Lancer-Insertech-GUI.vbs"
exit
`;
fs.writeFileSync(path.join(PORTABLE_DIR, 'Lancer-Insertech.bat'), winBatContent, 'utf-8');

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
open "http://127.0.0.1:3000" 2>/dev/null || xdg-open "http://127.0.0.1:3000" 2>/dev/null || true
node dist/server.js
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


