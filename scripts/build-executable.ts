import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const PORTABLE_DIR = path.join(ROOT_DIR, 'evaluateur-insertech-portable');

console.log('🚀 Démarrage du packaging de l\'Évaluateur Insertech Portable...');

// 1. Build Vite Frontend
console.log('📦 1/4 - Compilation de l\'application Web React/Vite...');
execSync('npx vite build', { cwd: ROOT_DIR, stdio: 'inherit' });

// 2. Bundle Server with Esbuild
console.log('⚡ 2/4 - Bundle du serveur Node.js & des scrapers...');
execSync(
  'npx esbuild server.ts --bundle --platform=node --format=esm --packages=external --sourcemap --outfile=dist/server.js',
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
      fs.copyFileSync(srcPath, destPath);
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

// Copier ou réserver le dossier Chromium embarqué s'il existe
const localChromium = path.join(ROOT_DIR, 'chromium');
if (fs.existsSync(localChromium)) {
  console.log('🌐 Copie du dossier Chromium embarqué local...');
  copyFolderRecursiveSync(localChromium, path.join(PORTABLE_DIR, 'chromium'));
} else {
  fs.mkdirSync(path.join(PORTABLE_DIR, 'chromium'), { recursive: true });
  console.log('ℹ️ Remarque : Pour inclure Chromium 100% hors-ligne dans le zip portable, placez le dossier du navigateur dans ./chromium');
}

// 4. Générer l'application GUI autonome intégrée sans aucune fenêtre noire de console
console.log('🎨 4/4 - Génération du lanceur GUI autonome sans console noire...');

// 4.1 Lanceur VBScript principal GUI (Double-clic ➔ Zéro console noire, fenêtre GUI dédiée + arrêt automatique du service à la fermeture)
const vbsContent = `Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Résolution dynamique du dossier d'exécution exact (résout l'erreur 80070002 si lancé depuis un raccourci ou sous-dossier)
Dim scriptDir
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = scriptDir

WshShell.Environment("PROCESS")("NODE_ENV") = "production"
WshShell.Environment("PROCESS")("HOST") = "127.0.0.1"

If fso.FileExists(scriptDir & "\\chromium\\chrome.exe") Then
  WshShell.Environment("PROCESS")("CHROMIUM_PATH") = scriptDir & "\\chromium\\chrome.exe"
End If

' 1. Recherche du serveur compilé dist\\server.js
Dim serverJsPath
serverJsPath = scriptDir & "\\dist\\server.js"
If Not fso.FileExists(serverJsPath) Then
  MsgBox "Erreur d'initialisation : Le fichier compilé dist\\server.js est introuvable." & vbCrLf & vbCrLf & "Veuillez vous assurer d'avoir téléchargé la version portable pré-compilée (evaluateur-insertech-portable.zip).", 16, "Évaluateur Insertech"
  WScript.Quit 1
End If

' 2. Détermination de la commande Node.js (Node local portable ou Node système)
Dim nodeCmd
If fso.FileExists(scriptDir & "\\node.exe") Then
  nodeCmd = """" & scriptDir & "\\node.exe"""
Else
  nodeCmd = "node"
End If

' 3. Démarrer le serveur local en arrière-plan (0 = masqué, zéro fenêtre de console)
On Error Resume Next
WshShell.Run nodeCmd & " """ & serverJsPath & """", 0, False
If Err.Number <> 0 Then
  MsgBox "Erreur lors du démarrage du serveur Node.js (" & Err.Description & ")." & vbCrLf & vbCrLf & "Veuillez vous assurer que Node.js est installé sur cet ordinateur ou inclus dans le dossier portable.", 16, "Évaluateur Insertech"
  WScript.Quit 1
End If
On Error GoTo 0

WScript.Sleep 2000

' 4. Lancer la fenêtre d'application GUI dédiée et attendre la fermeture par l'utilisateur
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
  WshShell.Run """" & edgePath & """ --app=http://127.0.0.1:3000 --user-data-dir=""" & WshShell.ExpandEnvironmentStrings("%TEMP%") & "\\InsertechApp""", 1, True
Else
  WshShell.Run "http://127.0.0.1:3000", 1, True
End If

' 5. Dès que l'utilisateur ferme la fenêtre GUI ➔ Arrêter immédiatement le service Node local !
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

// Supprimer les anciens fichiers HTA obsolètes qui ouvraient Internet Explorer
if (fs.existsSync(path.join(PORTABLE_DIR, 'Lancer-Insertech-GUI.hta'))) {
  fs.unlinkSync(path.join(PORTABLE_DIR, 'Lancer-Insertech-GUI.hta'));
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

console.log('\n=============================================================');
console.log('✅ EMBALLAGE ZÉRO-BLOCAGE SÉCURISÉ POUR WINDOWS & MAC !');
console.log(`📁 Dossier Portable : ${PORTABLE_DIR}`);
console.log('✨ 2. Démarrer-Insertech-macOS.command : Lanceur macOS double-cliquable');
console.log('✨ 3. GARANTIE_ZERO_BLOCAGE.md : Documentation de conformité IT');
console.log('=============================================================\n');

