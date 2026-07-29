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

let sharedContextPromise: Promise<any> | null = null;

async function getSharedContext(): Promise<any> {
  if (sharedContextPromise) {
    try {
      const ctx = await sharedContextPromise;
      if (ctx.browser() && ctx.browser().isConnected()) {
        return ctx;
      }
    } catch {
      sharedContextPromise = null;
    }
  }

  try {
    fs.mkdirSync(PROFILE_DIR, { recursive: true });
  } catch {
    // Ignorer si existe déjà
  }

  const embeddedExecutable = getEmbeddedChromiumPath();

  const launchOptions: any = {
    headless: true,
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    locale: 'fr-CA,fr;q=0.9,en-CA;q=0.8,en;q=0.7',
    timezoneId: 'America/Toronto',
    extraHTTPHeaders: {
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'accept-language': 'fr-CA,fr;q=0.9,en-CA;q=0.8,en;q=0.7',
      'sec-ch-ua': '"Not/A)Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'sec-fetch-dest': 'document',
      'sec-fetch-mode': 'navigate',
      'sec-fetch-site': 'none',
      'sec-fetch-user': '?1',
      'upgrade-insecure-requests': '1',
    },
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--no-zygote',
      '--disable-accelerated-2d-canvas',
      '--disable-infobars',
      '--window-position=0,0',
      '--ignore-certificate-errors',
      '--ignore-certificate-errors-spki-list',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
    ],
  };

  if (embeddedExecutable) {
    launchOptions.executablePath = embeddedExecutable;
  }

  sharedContextPromise = chromium.launchPersistentContext(PROFILE_DIR, launchOptions);
  return sharedContextPromise;
}

/**
 * Lance un navigateur Chromium local réutilisable en arrière-plan avec des propriétés stealth,
 * exécute le JavaScript de la page et retourne le HTML complet compilé.
 */
export async function scrapeHtmlStealth(url: string, waitForSelector?: string): Promise<string> {
  const context = await getSharedContext();
  const page = await context.newPage();

  try {
    // Intercepter et annuler le chargement des images, polices, vidéos et traqueurs (gain de 70% de vitesse)
    await page.route('**/*', (route: any) => {
      const type = route.request().resourceType();
      const reqUrl = route.request().url().toLowerCase();
      if (
        type === 'image' ||
        type === 'media' ||
        type === 'font' ||
        reqUrl.includes('google-analytics') ||
        reqUrl.includes('doubleclick') ||
        reqUrl.includes('facebook') ||
        reqUrl.includes('analytics') ||
        reqUrl.includes('gtm.js')
      ) {
        return route.abort();
      }
      return route.continue();
    });

    // Eviter la détection navigator.webdriver
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      // @ts-ignore
      window.chrome = { runtime: {} };
    });

    // Navigation rapide sur la page (16s timeout max)
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 16000,
    });

    // Si un sélecteur spécifique est attendu
    if (waitForSelector) {
      try {
        await page.waitForSelector(waitForSelector, { timeout: 4000 });
      } catch {
        // Poursuivre même si le sélecteur spécifique n'apparaît pas
      }
    } else {
      // Défilement rapide simulé pour déclencher l'affichage dynamique
      await page.evaluate(() => window.scrollBy(0, 400));
      await page.waitForTimeout(600);
    }

    const html = await page.content();
    await page.close();
    return html;
  } catch (err) {
    try {
      await page.close();
    } catch {
      // Ignorer l'erreur de fermeture
    }
    throw err;
  }
}

