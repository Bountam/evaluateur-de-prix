// ─── Sources internes Insertech — Historique d'atelier et prix en boutique solidaire ───

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

const SOURCE = 'Insertech (Interne)';
const SOURCE_KEY = 'insertech-internal';

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

function tier1ExcelReader(model: string, log: LogFn): ScrapedListing[] | null {
  const { INSERTECH_DATA_PATH: customPath } = getCredentials();
  const filePath = customPath || process.env.INSERTECH_DATA_PATH || path.join(PROJECT_ROOT, 'data', 'insertech-prices.xlsx');
  const fullPath = path.isAbsolute(filePath) ? filePath : path.join(PROJECT_ROOT, filePath);

  log(`📁 [${SOURCE_KEY}] Tier 1: Lecture du fichier Excel interne (${fullPath})...`);

  try {
    if (!fs.existsSync(fullPath)) {
      log(`ℹ️ [${SOURCE_KEY}] Fichier Excel absent à ${fullPath}`);
      return null;
    }

    const workbook = XLSX.readFile(fullPath);
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) return null;

    const sheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);

    const listings: ScrapedListing[] = [];
    const modelLower = model.toLowerCase().trim();
    const modelTerms = modelLower.split(/\s+/).filter(t => t.length > 1);
    let idx = 0;

    for (const row of rows) {
      // Identifier la colonne du modèle/titre et celle du prix
      const titleCol = Object.keys(row).find(k => /mod[èe]le|titre|produit|item|description|name/i.test(k)) || Object.keys(row)[0];
      const priceCol = Object.keys(row).find(k => /prix|price|vente|solidaire|montant|cost/i.test(k));

      const titleVal = row[titleCol] ? row[titleCol].toString().trim() : '';
      if (!titleVal) continue;

      // Vérification de correspondance (exacte ou par mots-clés du modèle)
      const titleValLower = titleVal.toLowerCase();
      const isMatch = titleValLower.includes(modelLower) ||
        (modelTerms.length >= 2 && modelTerms.every(term => titleValLower.includes(term)));

      if (!isMatch) continue;

      const priceVal = priceCol ? parseCADPrice(row[priceCol]) : null;
      if (!priceVal) continue;

      const conditionCol = Object.keys(row).find(k => /grade|condition|[ée]tat/i.test(k));
      const condition = conditionCol ? row[conditionCol].toString() : 'Reconditionné Insertech (Garantie 1 an)';

      idx++;
      listings.push({
        id: `insertech-int-${idx}-${randomHex(4)}`,
        title: `[Boutique Solidaire] ${titleVal}`,
        price: priceVal,
        source: SOURCE,
        sourceKey: SOURCE_KEY,
        date: new Date().toISOString(),
        url: `https://www.insertech.ca/recherche?q=${encodeURIComponent(titleVal)}`,
        included: true,
        isOutlier: false,
        isSimulated: false,
        condition,
        saleType: 'internal',
      });
    }

    if (listings.length > 0) {
      log(`✔️ [${SOURCE_KEY}] Tier 1: ${listings.length} prix internes trouvés dans le fichier Excel`);
      return listings;
    }
  } catch (err) {
    log(`⚠️ [${SOURCE_KEY}] Erreur lecture Excel interne: ${err instanceof Error ? err.message : String(err)}`);
  }

  return null;
}

function tier2JsonFallback(model: string, log: LogFn): ScrapedListing[] | null {
  const jsonPath = path.join(PROJECT_ROOT, 'data', 'insertech-prices.json');
  log(`📁 [${SOURCE_KEY}] Tier 2: Vérification du fichier JSON fallback (${jsonPath})...`);

  try {
    if (!fs.existsSync(jsonPath)) return null;
    const raw = fs.readFileSync(jsonPath, 'utf-8');
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return null;

    const listings: ScrapedListing[] = [];
    const modelLower = model.toLowerCase().trim();
    let idx = 0;

    for (const item of data) {
      if (!item.title || !item.title.toLowerCase().includes(modelLower)) continue;
      const price = parseCADPrice(item.price);
      if (!price) continue;

      idx++;
      listings.push({
        id: `insertech-int-${idx}-${randomHex(4)}`,
        title: `[Interne] ${item.title.trim()}`,
        price,
        source: SOURCE,
        sourceKey: SOURCE_KEY,
        date: item.date || new Date().toISOString(),
        url: 'https://www.insertech.ca',
        included: true,
        isOutlier: false,
        isSimulated: false,
        condition: item.condition || 'Reconditionné Insertech',
        saleType: 'internal',
      });
    }

    if (listings.length > 0) {
      log(`✔️ [${SOURCE_KEY}] Tier 2: ${listings.length} prix internes chargés depuis JSON`);
      return listings;
    }
  } catch (err) {
    log(`⚠️ [${SOURCE_KEY}] Erreur lecture JSON interne: ${err instanceof Error ? err.message : String(err)}`);
  }

  return null;
}

function tier3Cache(model: string, log: LogFn): ScrapedListing[] | null {
  log(`🩺 [${SOURCE_KEY}] Tier 3: Chargement depuis l'historique du cache...`);
  const cached = loadFromCache(SOURCE_KEY, model);
  if (cached && cached.length > 0) {
    log(`✔️ [${SOURCE_KEY}] Tier 3: ${cached.length} prix internes chargés depuis le cache`);
    return cached;
  }
  return null;
}

const insertechInternalScraper: ScraperModule = {
  name: SOURCE,
  sourceKey: SOURCE_KEY,

  async scrape(model: string, log: LogFn): Promise<ScraperResult> {
    const timestamp = new Date().toISOString();
    try {
      const excelListings = tier1ExcelReader(model, log);
      if (excelListings && excelListings.length > 0) {
        saveToCache(SOURCE_KEY, model, excelListings);
        return {
          listings: excelListings,
          source: SOURCE,
          sourceKey: SOURCE_KEY,
          method: 'direct',
          timestamp,
          success: true,
        };
      }

      const jsonListings = tier2JsonFallback(model, log);
      if (jsonListings && jsonListings.length > 0) {
        saveToCache(SOURCE_KEY, model, jsonListings);
        return {
          listings: jsonListings,
          source: SOURCE,
          sourceKey: SOURCE_KEY,
          method: 'json-embedded',
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
        success: true, // Succès même si 0 (pas de stock en boutique)
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

export default insertechInternalScraper;
