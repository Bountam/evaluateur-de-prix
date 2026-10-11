// ─── Émulateur de Navigateur Local Haute Fidélité (Playwright Stealth) ───
// Permet de contourner les challenges JS de Cloudflare et d'exécuter le JavaScript localement.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const PROFILE_DIR = path.join(PROJECT_ROOT, 'data', 'puppeteer_profile');

// Activer le plugin stealth sur l'instance Playwright-Chromium
// @ts-ignore - Résout la compatibilité de types entre puppeteer-extra-plugin et playwright-extra
chromium.use(stealthPlugin());

function getEmbeddedChromiumPath(): string | undefined {
  if (process.env.CHROMIUM_PATH && fs.existsSync(process.env.CHROMIUM_PATH)) {
    return process.env.CHROMIUM_PATH;
  }
  
  const exeName = process.platform === 'win32' ? 'chrome.exe' : 'chrome';
  const possiblePaths = [
    path.join(PROJECT_ROOT, 'chromium', exeName),
    path.join(PROJECT_ROOT, 'chromium', 'win64-chrome', exeName),
    path.join(process.cwd(), 'chromium', exeName),
    path.join(process.cwd(), 'chromium', 'win64-chrome', exeName),
    path.join(path.dirname(process.execPath), 'chromium', exeName),
  ];

  if (process.platform === 'win32') {
    const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
    const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    const localAppData = process.env['LOCALAPPDATA'] || '';

    possiblePaths.push(
      path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe')
    );
  } else if (process.platform === 'darwin') {
    possiblePaths.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
    );
  } else if (process.platform === 'linux') {
    possiblePaths.push(
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium'
    );
  }

  for (const p of possiblePaths) {
    if (p && fs.existsSync(p)) {
      return p;
    }
  }

  return undefined;
}

import { execSync } from 'node:child_process';

let sharedBrowser: any = null;
let sharedBrowserPromise: Promise<any> | null = null;
let browserPid: number | null = null;

export async function getSharedBrowser(): Promise<any> {
  if (sharedBrowser && sharedBrowser.isConnected()) {
    return sharedBrowser;
  }

  if (sharedBrowserPromise) {
    return sharedBrowserPromise;
  }

  const embeddedExecutable = getEmbeddedChromiumPath();

  const launchOptions: any = {
    headless: true,
    args: [
      '--headless=new',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-background-networking',
      '--disable-default-apps',
      '--disable-sync',
      '--disable-component-update',
      '--disable-domain-reliability',
      '--disable-client-side-phishing-detection',
      '--no-default-browser-check',
      '--no-first-run',
      '--webrtc-ip-handling-policy=disable_non_proxied_udp',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--no-zygote',
      '--disable-accelerated-2d-canvas',
      '--disable-infobars',
      '--window-position=0,0',
      '--ignore-certificate-errors',
      '--ignore-certificate-errors-spki-list',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process,MediaRouter,CalculateNativeWinOcclusion,CertificateTransparencyComponentUpdater',
      '--blink-settings=imagesEnabled=false',
    ],
    timeout: 25000,
  };

  if (embeddedExecutable) {
    launchOptions.executablePath = embeddedExecutable;
  }

  sharedBrowserPromise = (async () => {
    try {
      const browser = await chromium.launch(launchOptions);
      const anyBrowser = browser as any;
      browserPid = typeof anyBrowser.process === "function" ? (anyBrowser.process()?.pid ?? null) : null;
      browser.on('disconnected', () => {
        sharedBrowser = null;
        browserPid = null;
      });
      sharedBrowser = browser;
      return browser;
    } catch (err) {
      sharedBrowser = null;
      browserPid = null;
      throw err;
    } finally {
      sharedBrowserPromise = null;
    }
  })();

  return sharedBrowserPromise;
}

export async function closeSharedBrowser(): Promise<void> {
  const currentPid = browserPid;
  if (sharedBrowser) {
    try {
      await sharedBrowser.close();
    } catch {
      // Ignorer
    }
    sharedBrowser = null;
  }

  // Sur Windows, si l'arborescence du processus Playwright est encore active, la fermer de manière ciblée
  if (currentPid && process.platform === 'win32') {
    try {
      execSync(`taskkill /pid ${currentPid} /t /f`, { stdio: 'ignore' });
    } catch {
      // Déjà terminé normalement
    }
    browserPid = null;
  }
}

/**
 * Lance un navigateur Chromium local réutilisable en arrière-plan avec des propriétés stealth,
 * exécute le JavaScript de la page et retourne le HTML complet compilé.
 */
export async function scrapeHtmlStealth(url: string, waitForSelector?: string): Promise<string> {
  const browser = await getSharedBrowser();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'fr-CA',
    timezoneId: 'America/Toronto',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();

  try {
    // Éviter la détection navigator.webdriver
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      // @ts-ignore
      window.chrome = { runtime: {} };
    });

    // Navigation rapide sur la page (12s timeout max)
    try {
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 12000,
      });
    } catch (err: any) {
      if (!err.message?.includes('navigating and changing')) {
        throw err;
      }
    }

    // Si un sélecteur spécifique est attendu
    if (waitForSelector) {
      try {
        await page.waitForSelector(waitForSelector, { timeout: 4000 });
      } catch {
        // Poursuivre même si le sélecteur spécifique n'apparaît pas
      }
    } else {
      try {
        // Défilement rapide simulé pour déclencher l'affichage dynamique
        await page.evaluate(() => window.scrollBy(0, 400));
        await page.waitForTimeout(500);
      } catch {
        // Ignorer si la page redirige
      }
    }

    let html = '';
    try {
      html = await page.content();
    } catch {
      await page.waitForTimeout(800);
      html = await page.content();
    }
    return html;
  } finally {
    try {
      await page.close();
    } catch {
      // Ignorer l'erreur de fermeture
    }
    try {
      await context.close();
    } catch {
      // Ignorer l'erreur de fermeture
    }
  }
}

