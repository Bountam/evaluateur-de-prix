// ─── Anciennes analyses de valeur Insertech — Archives historiques d'évaluation ───

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';
import type { ScraperModule, ScrapedListing, ScraperResult, LogFn } from './types.ts';
import { saveToCache, loadFromCache } from './cache.ts';
import { getCredentials } from './credentials.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

const SOURCE = 'Insertech (Archives)';
const SOURCE_KEY = 'insertech-archives';

function randomHex(len: number): string {
  return [...Array(len)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
}

function parseCADPrice(raw: any): number | null {
  if (typeof raw === 'number') return raw > 0 ? Math.round(raw * 100) / 100 : null;
  if (!raw) return null;
  const cleaned = raw
    .toString()
    .replace(/C\s*\$/gi, '')
    .replace(/CA\s*\$/gi, '')
    .replace(/\$/g, '')
    .replace(/,/g, '')
    .replace(/\s/g, '')
    .trim();
  const val = parseFloat(cleaned);
  if (isNaN(val) || val <= 0) return null;
  return Math.round(val * 100) / 100;
}

function tier1ScanArchiveExcel(model: string, log: LogFn): ScrapedListing[] | null {
  const { INSERTECH_ARCHIVES_PATH: customPath } = getCredentials();
  const archivesDir = customPath || process.env.INSERTECH_ARCHIVES_PATH || path.join(PROJECT_ROOT, 'data', 'archives');
  const fullDir = path.isAbsolute(archivesDir) ? archivesDir : path.join(PROJECT_ROOT, archivesDir);

  log(`📁 [${SOURCE_KEY}] Tier 1: Balayage des fichiers Excel dans le dossier d'archives (${fullDir})...`);

  try {
    if (!fs.existsSync(fullDir)) {
      log(`ℹ️ [${SOURCE_KEY}] Dossier d'archives absent à ${fullDir}`);
      return null;
    }

    const files = fs.readdirSync(fullDir).filter(f => f.endsWith('.xlsx') || f.endsWith('.xls'));
    if (files.length === 0) return null;

    const listings: ScrapedListing[] = [];
    const modelLower = model.toLowerCase().trim();
    let idx = 0;

    for (const file of files) {
      try {
        const filePath = path.join(fullDir, file);
        const workbook = XLSX.readFile(filePath);
        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);

          for (const row of rows) {
            const titleCol = Object.keys(row).find(k => /mod[èe]le|titre|produit|item|description|name/i.test(k)) || Object.keys(row)[0];
            const priceCol = Object.keys(row).find(k => /prix|price|m[ée]diane|valeur|montant/i.test(k));

            const titleVal = row[titleCol] ? row[titleCol].toString().trim() : '';
            if (!titleVal || !titleVal.toLowerCase().includes(modelLower)) continue;

            const priceVal = priceCol ? parseCADPrice(row[priceCol]) : null;
            if (!priceVal) continue;

            // Extraire la date si disponible ou utiliser la date de modification du fichier
            const dateCol = Object.keys(row).find(k => /date|p[ée]riode|ann[ée]e/i.test(k));
            const stat = fs.statSync(filePath);
            const dateStr = dateCol && row[dateCol] ? row[dateCol].toString() : stat.mtime.toISOString();

            idx++;
            listings.push({
              id: `insertech-arch-${idx}-${randomHex(4)}`,
              title: `[Archive: ${file}] ${titleVal}`,
              price: priceVal,
              source: SOURCE,
              sourceKey: SOURCE_KEY,
              date: new Date(dateStr).toISOString(),
              url: `https://www.insertech.ca/archives/${encodeURIComponent(file)}`,
              included: true,
              isOutlier: false,
              isSimulated: false,
              condition: 'Valeur historique certifiée',
              saleType: 'internal',
            });
          }
        }
      } catch {
        // Ignorer fichier corrompu ou illisible
      }
    }

    if (listings.length > 0) {
      log(`✔️ [${SOURCE_KEY}] Tier 1: ${listings.length} évaluations historiques trouvées dans ${files.length} fichiers Excel`);
      return listings;
    }
  } catch (err) {
    log(`⚠️ [${SOURCE_KEY}] Erreur lecture archives Excel: ${err instanceof Error ? err.message : String(err)}`);
  }

  return null;
}

function tier2LocalDbHistory(model: string, log: LogFn): ScrapedListing[] | null {
  const dbPath = path.join(PROJECT_ROOT, 'db.json');
  log(`📁 [${SOURCE_KEY}] Tier 2: Lecture de l'historique dans la base locale db.json...`);

  try {
    if (!fs.existsSync(dbPath)) return null;
    const raw = fs.readFileSync(dbPath, 'utf-8');
    const db = JSON.parse(raw);

    const listings: ScrapedListing[] = [];
    const modelLower = model.toLowerCase().trim();
    let idx = 0;

    // Vérifier les historicalPrices de l'évaluation du modèle
    if (db.evaluations) {
      for (const [modelKey, evalData] of Object.entries(db.evaluations) as [string, any][]) {
        if (modelKey.toLowerCase().includes(modelLower) || evalData.modelName?.toLowerCase().includes(modelLower)) {
          if (Array.isArray(evalData.historicalPrices)) {
            for (const hist of evalData.historicalPrices) {
              const price = parseCADPrice(hist.price);
              if (!price) continue;
              idx++;
              listings.push({
                id: `insertech-arch-${idx}-${randomHex(4)}`,
                title: `[Archive DB] ${evalData.modelName} (Médiane historique du ${new Date(hist.date).toLocaleDateString('fr-CA')})`,
                price,
                source: SOURCE,
                sourceKey: SOURCE_KEY,
                date: hist.date || new Date().toISOString(),
                url: '#',
                included: true,
                isOutlier: false,
                isSimulated: false,
                condition: 'Médiane historique',
                saleType: 'internal',
              });
            }
          }
        }
      }
    }

    // Vérifier aussi le journal historicalLog
    if (Array.isArray(db.historicalLog)) {
      for (const logEntry of db.historicalLog) {
        if (logEntry.model && logEntry.model.toLowerCase().includes(modelLower) && logEntry.currentPrice > 0) {
          idx++;
          listings.push({
            id: `insertech-arch-${idx}-${randomHex(4)}`,
            title: `[Journal Audit] ${logEntry.model} - ${logEntry.action}`,
            price: logEntry.currentPrice,
            source: SOURCE,
            sourceKey: SOURCE_KEY,
            date: logEntry.date || new Date().toISOString(),
            url: '#',
            included: true,
            isOutlier: false,
            isSimulated: false,
            condition: 'Journal audit',
            saleType: 'internal',
          });
        }
      }
    }

    if (listings.length > 0) {
      log(`✔️ [${SOURCE_KEY}] Tier 2: ${listings.length} valeurs historiques trouvées dans db.json`);
      return listings;
    }
  } catch (err) {
    log(`⚠️ [${SOURCE_KEY}] Erreur lecture db.json: ${err instanceof Error ? err.message : String(err)}`);
  }

  return null;
}

function tier3Cache(model: string, log: LogFn): ScrapedListing[] | null {
  log(`🩺 [${SOURCE_KEY}] Tier 3: Chargement depuis le cache des archives...`);
  const cached = loadFromCache(SOURCE_KEY, model);
  if (cached && cached.length > 0) {
    log(`✔️ [${SOURCE_KEY}] Tier 3: ${cached.length} résultats depuis le cache`);
    return cached;
  }
  return null;
}

const insertechArchivesScraper: ScraperModule = {
  name: SOURCE,
  sourceKey: SOURCE_KEY,

  async scrape(model: string, log: LogFn): Promise<ScraperResult> {
    const timestamp = new Date().toISOString();
    try {
      const excelArchives = tier1ScanArchiveExcel(model, log);
      if (excelArchives && excelArchives.length > 0) {
        saveToCache(SOURCE_KEY, model, excelArchives);
        return {
          listings: excelArchives,
          source: SOURCE,
          sourceKey: SOURCE_KEY,
          method: 'direct',
          timestamp,
          success: true,
        };
      }

      const dbHistory = tier2LocalDbHistory(model, log);
      if (dbHistory && dbHistory.length > 0) {
        saveToCache(SOURCE_KEY, model, dbHistory);
        return {
          listings: dbHistory,
          source: SOURCE,
          sourceKey: SOURCE_KEY,
          method: 'api',
          timestamp,
          success: true,
        };
      }

      const cachedListings = tier3Cache(model, log);
      if (cachedListings && cachedListings.length > 0) {
        return {
          listings: cachedListings,
          source: SOURCE,
          sourceKey: SOURCE_KEY,
          method: 'cache',
          timestamp,
          success: true,
        };
      }

      return {
        listings: [],
        source: SOURCE,
        sourceKey: SOURCE_KEY,
        method: 'cache',
        timestamp,
        success: true,
      };
    } catch (err) {
      log(`⚠️ [${SOURCE_KEY}] Erreur globale: ${err instanceof Error ? err.message : String(err)}`);
      const cachedListings = tier3Cache(model, log);
      return {
        listings: cachedListings || [],
        source: SOURCE,
        sourceKey: SOURCE_KEY,
        method: 'cache',
        timestamp,
        success: true,
      };
    }
  },
};

export default insertechArchivesScraper;
