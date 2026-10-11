import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const PORTABLE_DIR = path.join(ROOT_DIR, 'evaluateur-insertech-portable');
const APP_DIR = path.join(PORTABLE_DIR, 'app');

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
fs.mkdirSync(APP_DIR, { recursive: true });

// Copier les fichiers distribuables dist -> portable/app/dist
copyFolderRecursiveSync(DIST_DIR, path.join(APP_DIR, 'dist'));

// Copier les dépendances node_modules dans le sous-dossier technique app/
const nodeModulesDir = path.join(ROOT_DIR, 'node_modules');
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
if (fs.existsSync(nodeModulesDir)) {
  try {
    console.log('📦 Copie optimisée des dépendances node_modules dans app/node_modules...');
    copyFolderRecursiveSync(nodeModulesDir, path.join(APP_DIR, 'node_modules'), DEV_DEPS_TO_EXCLUDE);
  } catch (err: any) {
    console.warn('⚠️ Remarque lors de la copie de node_modules:', err?.message || err);
  }
}

// Copier les data_files de header-generator indispensables à got-scraping
const headerGeneratorData = path.join(ROOT_DIR, 'node_modules', 'header-generator', 'data_files');
if (fs.existsSync(headerGeneratorData)) {
  console.log('📄 Copie des fichiers de données header-generator (got-scraping)...');
  copyFolderRecursiveSync(headerGeneratorData, path.join(DIST_DIR, 'data_files'));
  copyFolderRecursiveSync(headerGeneratorData, path.join(APP_DIR, 'dist', 'data_files'));
}

// Copier public -> portable/app/public (manifest, sw.js, favicons)
const publicDir = path.join(ROOT_DIR, 'public');
if (fs.existsSync(publicDir)) {
  copyFolderRecursiveSync(publicDir, path.join(APP_DIR, 'public'));
}

// Copier db.json initial si disponible dans app/
const dbPath = path.join(ROOT_DIR, 'db.json');
if (fs.existsSync(dbPath)) {
  fs.copyFileSync(dbPath, path.join(APP_DIR, 'db.json'));
}

// Copier loading.html dans app/
const loadingPath = path.join(APP_DIR, 'loading.html');
if (fs.existsSync(path.join(ROOT_DIR, 'loading.html'))) {
  fs.copyFileSync(path.join(ROOT_DIR, 'loading.html'), loadingPath);
}

// Copier les icônes de l'application dans app/ (pour PWA / affichage web, JAMAIS en racine)
const appPngPath = path.join(ROOT_DIR, 'assets', 'icon', 'app-icon.png');
if (fs.existsSync(appPngPath)) {
  fs.copyFileSync(appPngPath, path.join(APP_DIR, 'app-icon.png'));
}

// Copier node.exe dans app/ pour garantir le fonctionnement 100% autonome
try {
  const nodeExePath = process.execPath;
  if (fs.existsSync(nodeExePath) && nodeExePath.toLowerCase().endsWith('node.exe')) {
    console.log(`🟢 Copie de node.exe autonome dans app/node.exe depuis ${nodeExePath}...`);
    fs.copyFileSync(nodeExePath, path.join(APP_DIR, 'node.exe'));
  }
} catch (err) {
  console.warn('⚠️ Impossible de copier automatiquement node.exe:', err);
}

// Copier ou embarquer le navigateur Chromium Playwright dans app/chromium
const portableChromiumDir = path.join(APP_DIR, 'chromium');
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

// 4. Compiler le lanceur natif Windows C# avec icône intégrée et manifeste non-admin
console.log('🎨 4/4 - Compilation du lanceur natif avec icône intégrée et manifeste non-admin...');
const cscPath = 'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe';
const launcherSource = path.join(ROOT_DIR, 'launcher', 'Launcher.cs');
const iconPath = path.join(ROOT_DIR, 'assets', 'icon', 'app.ico');
const manifestPath = path.join(ROOT_DIR, 'launcher', 'app.manifest');
const targetExe = path.join(PORTABLE_DIR, 'Évaluateur Insertech.exe');

if (fs.existsSync(cscPath) && fs.existsSync(launcherSource) && fs.existsSync(iconPath)) {
  try {
    let cscCmd = `"${cscPath}" /target:winexe /win32icon:"${iconPath}"`;
    if (fs.existsSync(manifestPath)) {
      cscCmd += ` /win32manifest:"${manifestPath}"`;
    }
    cscCmd += ` /out:"${targetExe}" "${launcherSource}"`;

    execSync(cscCmd, { cwd: ROOT_DIR, stdio: 'inherit' });
    console.log(`✨ Exécutable natif compilé avec succès (avec manifeste asInvoker) : ${targetExe}`);
  } catch (err: any) {
    console.error('❌ Échec de la compilation du lanceur C# :', err?.message || err);
    process.exit(1);
  }
} else {
  console.error('❌ Fichiers requis pour la compilation du lanceur introuvables.');
  process.exit(1);
}

// Notice de conformité et zéro blocage
const securityNotice = `# Évaluateur de Prix Insertech - Version Portable Autonome

Bienvenue dans l'Évaluateur de Prix Insertech.

## 🚀 Démarrage
Pour démarrer l'application, double-cliquez simplement sur **Évaluateur Insertech.exe**.

L'application s'ouvre dans une fenêtre dédiée sans console noire et se ferme proprement à la fermeture de la fenêtre.
`;
fs.writeFileSync(path.join(PORTABLE_DIR, 'LISEZMOI.md'), securityNotice, 'utf-8');

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

// Rendre le sous-dossier technique app/ discret (attribut masqué sous Windows)
if (process.platform === 'win32') {
  try {
    execSync(`attrib +h "${APP_DIR}"`, { stdio: 'ignore' });
    console.log('🔒 Dossier technique app/ masqué sous Windows Explorer.');
  } catch {}
}

console.log('\n=============================================================');
console.log('✅ EMBALLAGE 100% AUTONOME TERMINÉ !');
console.log(`📁 Dossier Portable : ${PORTABLE_DIR}`);
console.log(`🎯 Lanceur Unique : ${targetExe}`);
if (fs.existsSync(zipPath)) {
  console.log(`📦 Archive ZIP prête : ${zipPath}`);
}
console.log('=============================================================\n');
