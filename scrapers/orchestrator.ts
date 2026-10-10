// ─── Orchestrateur Central de Scraping Multi-Sources (Zéro-Échec) ───

// ─── Table de normalisation des modèles ─────────────────────────────────────
// Convertit les codes Dell P-series (numéros constructeur) et autres alias
// vers les noms commerciaux optimaux pour la recherche sur les places de marché.
// Exemple: "Dell XPS 15 P129F001" → "Dell XPS 15 9500"
const MODEL_ALIASES: Record<string, string> = {
  // Dell XPS — numéros P-series → nom commercial
  'dell xps 15 p129f001':   'Dell XPS 15 9500',   // P129F = XPS 15 9500/9510
  'dell xps 15 p129f':      'Dell XPS 15 9500',
  'dell xps 13 p117g':      'Dell XPS 13 9300',   // P117G = XPS 13 9300/9310
  'dell xps 13 p117g001':   'Dell XPS 13 9300',
  'dell xps 17 p92f':       'Dell XPS 17 9700',   // P92F = XPS 17 9700/9710
  'dell xps 17 p92f001':    'Dell XPS 17 9720',   // P92F001 = XPS 17 9720/9730
  // Codes raccourcis sans préfixe "Dell"
  'xps 15 p129f001':        'Dell XPS 15 9500',
  'xps 13 p117g':           'Dell XPS 13 9300',
  'xps 17 p92f001':         'Dell XPS 17 9720',
  // Lenovo — alias de générations
  'thinkpad t14 gen 1':     'ThinkPad T14 Gen 1',
  'thinkpad t14 gen 2':     'ThinkPad T14 Gen 2',
  // Ajouter d'autres alias au besoin
};

/**
 * Normalise un nom de modèle en résolvant les alias P-series et les variantes orthographiques.
 * Retourne le nom commercial standardisé si un alias existe, sinon retourne le nom original.
 */
function normalizeModelName(model: string): string {
  const key = model.toLowerCase().trim();
  return MODEL_ALIASES[key] || model;
}

import os from 'node:os';
import type { ScrapedListing, ScraperResult, LogFn } from './types.ts';
import { isPartOrAssembly, extractSpecsFromTitle, isModelMatch } from './utils.ts';
import ebayCompletedScraper from './ebay-completed.ts';
import ebayActiveScraper from './ebay-active.ts';
import backmarketScraper from './backmarket.ts';
import reebeloScraper from './reebelo.ts';
import amazonRenewedScraper from './amazon-renewed.ts';
import bestbuyScraper from './bestbuy.ts';
import gcsurplusScraper from './gcsurplus.ts';
import neweggScraper from './newegg.ts';
import refurbIoScraper from './refurb-io.ts';
import walmartScraper from './walmart.ts';
import dellScraper from './dell.ts';
import itRefurbsScraper from './it-refurbs.ts';
import canadaComputersScraper from './canada-computers.ts';
import seaoScraper from './seao.ts';
import insertechInternalScraper from './insertech-internal.ts';
import insertechArchivesScraper from './insertech-archives.ts';

export interface SourceSummary {
  source: string;
  sourceKey: string;
  count: number;
  method: string;
  success: boolean;
  error?: string;
}

export interface OrchestratedResult {
  allListings: ScrapedListing[];
  sourceResults: SourceSummary[];
  totalSources: number;
  successfulSources: number;
  totalListings: number;
  medianPrice: number;
  confidence: 'Élevé' | 'Moyen' | 'Faible' | 'Aucun';
  timestamp: string;
}

const ALL_SCRAPERS = [
  gcsurplusScraper,
  ebayCompletedScraper,
  ebayActiveScraper,
  backmarketScraper,
  reebeloScraper,
  amazonRenewedScraper,
  bestbuyScraper,
  neweggScraper,
  refurbIoScraper,
  walmartScraper,
  dellScraper,
  itRefurbsScraper,
  canadaComputersScraper,
  seaoScraper,
  insertechInternalScraper,
  insertechArchivesScraper,
];

// Expressions régulières pré-compilées globalement pour la détection de caractéristiques anormales (outliers)
const ANOMALY_KEYWORDS = [
  /\bno\s+ram\b/i,
  /\bno\s+ssd\b/i,
  /\bno\s+storage\b/i,
  /\bno\s+power\b/i,
  /\bno\s+os\b/i,
  /\bno\s+batt\b/i,
  /\bno\s+battery\b/i,
  /\bno\s+ac\b/i,
  /\bno\s+charger\b/i,
  /\bgrade\s+d\b/i,
  /\bparts\s+repair\b/i,
  /\b(?:i3|i5|i7|cpu)\s+7th\b/i,
  /\b(?:i3|i5|i7|cpu)\s+7e\b/i
];

/**
 * Calcul statistique des valeurs aberrantes (Outliers) via la méthode IQR (Interquartile Range)
 */
export function flagOutliers(listings: ScrapedListing[]): ScrapedListing[] {
  let flagged = listings.map(l => {
    const titleLower = l.title.toLowerCase();
    if (ANOMALY_KEYWORDS.some(regex => regex.test(titleLower))) {
      return { ...l, isOutlier: true, included: false };
    }
    return l;
  });

  if (flagged.length < 4) {
    return flagged;
  }

  const prices = flagged
    .filter(l => !l.isOutlier && l.included !== false)
    .map(l => l.price)
    .sort((a, b) => a - b);

  if (prices.length < 4) {
    return flagged;
  }

  const q1Index = Math.floor(prices.length * 0.25);
  const q3Index = Math.floor(prices.length * 0.75);
  const q1 = prices[q1Index];
  const q3 = prices[q3Index];
  const iqr = q3 - q1;

  const lowerBound = Math.max(15, q1 - 1.5 * iqr);
  const upperBound = q3 + 1.5 * iqr;

  return flagged.map(l => {
    if (l.isOutlier) return l; // Déjà identifié par mot-clé
    if (l.price < lowerBound || l.price > upperBound) {
      return { ...l, isOutlier: true, included: false };
    }
    return l;
  });
}

/**
 * Calcul de la médiane d'un ensemble de prix CAD
 */
export function calculateMedian(listings: ScrapedListing[]): number {
  const validPrices = listings
    .filter(l => l.included && !l.isOutlier)
    .map(l => l.price)
    .sort((a, b) => a - b);

  if (validPrices.length === 0) {
    // Si tout a été exclu, on prend la médiane de tous les prix bruts > 0
    const rawPrices = listings.map(l => l.price).filter(p => p > 0).sort((a, b) => a - b);
    if (rawPrices.length === 0) return 0;
    const mid = Math.floor(rawPrices.length / 2);
    return rawPrices.length % 2 !== 0
      ? rawPrices[mid]
      : Math.round(((rawPrices[mid - 1] + rawPrices[mid]) / 2) * 100) / 100;
  }

  const mid = Math.floor(validPrices.length / 2);
  return validPrices.length % 2 !== 0
    ? validPrices[mid]
    : Math.round(((validPrices[mid - 1] + validPrices[mid]) / 2) * 100) / 100;
}

/**
 * Détermination de l'indice de confiance selon le volume et la source des données
 */
export function determineConfidence(listings: ScrapedListing[], successfulSourcesCount: number): 'Élevé' | 'Moyen' | 'Faible' | 'Aucun' {
  const validCount = listings.filter(l => l.included && !l.isOutlier).length;
  if (validCount === 0) return 'Aucun';
  if (validCount >= 10 && successfulSourcesCount >= 4) return 'Élevé';
  if (validCount >= 5 && successfulSourcesCount >= 2) return 'Moyen';
  return 'Faible';
}

/**
 * Déduplication intelligente des annonces fusionnées
 */
function deduplicateListings(listings: ScrapedListing[]): ScrapedListing[] {
  const seenUrls = new Set<string>();
  const seenTitlePrice = new Set<string>();
  const unique: ScrapedListing[] = [];

  for (const l of listings) {
    let cleanUrl = l.url ? l.url.toLowerCase() : '';
    if (cleanUrl && !cleanUrl.includes('reebelo') && !cleanUrl.includes('backmarket')) {
      cleanUrl = cleanUrl.split('?')[0];
    }
    const titlePriceKey = `${l.title.toLowerCase().trim()}::${l.price}`;

    if (cleanUrl && cleanUrl !== '#' && cleanUrl !== 'https://www.insertech.ca' && seenUrls.has(cleanUrl)) {
      continue;
    }
    if (seenTitlePrice.has(titlePriceKey)) {
      continue;
    }

    if (cleanUrl && cleanUrl !== '#' && cleanUrl !== 'https://www.insertech.ca') {
      seenUrls.add(cleanUrl);
    }
    seenTitlePrice.add(titlePriceKey);
    unique.push(l);
  }

  return unique;
}

/**
 * Exécute des tâches asynchrones en limitant le niveau de parallélisme (Concurrence Pool)
 */
async function runWithConcurrencyLimit<T, R>(
  items: T[],
  concurrency: number,
  taskFn: (item: T) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const currentIndex = index++;
      const item = items[currentIndex];
      try {
        const value = await taskFn(item);
        results[currentIndex] = { status: 'fulfilled', value };
      } catch (reason) {
        results[currentIndex] = { status: 'rejected', reason };
      }
    }
  }

  // Lancer les workers parallèles
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, worker);
  await Promise.all(workers);
  return results;
}

/**
 * Moteur d'orchestration multi-sources — Exécution parallèle contrôlée et résiliente (Zéro-Échec)
 */
export async function orchestrateScraping(
  model: string, 
  category: string, 
  log: LogFn,
  onSourceComplete?: (result: ScraperResult, completedCount: number, totalSources: number) => void,
  customConcurrency?: number
): Promise<OrchestratedResult> {
  const timestamp = new Date().toISOString();
  const searchModel = normalizeModelName(model);
  if (searchModel !== model) {
    log(`🔄 [Orchestrateur] Normalisation de l'alias : "${model}" → "${searchModel}"`);
  }

  const systemCores = os.cpus()?.length || 4;
  const defaultConcurrency = Math.max(1, Math.min(3, Math.floor(systemCores / 2)));
  const CONCURRENCY_LIMIT = customConcurrency && customConcurrency > 0
    ? Math.min(16, Math.max(1, customConcurrency))
    : (process.env.SCRAPER_CONCURRENCY ? parseInt(process.env.SCRAPER_CONCURRENCY, 10) : defaultConcurrency);

  log(`🚀 Démarre la collecte multi-sources pour : "${searchModel}" (${category}) sur ${ALL_SCRAPERS.length} sources (Concurrence configurée : ${CONCURRENCY_LIMIT})`);

  let completedCount = 0;
  const settled = await runWithConcurrencyLimit(ALL_SCRAPERS, CONCURRENCY_LIMIT, async s => {
    let res: ScraperResult;
    try {
      res = await s.scrape(searchModel, log);
    } catch (err) {
      log(`⚠️ [${s.sourceKey || s.name}] Erreur de collecte : ${err instanceof Error ? err.message : String(err)}`);
      res = {
        listings: [],
        source: s.name,
        sourceKey: s.sourceKey,
        method: 'direct',
        timestamp: new Date().toISOString(),
        success: false,
        error: err instanceof Error ? err.message : String(err)
      };
    } finally {
      completedCount++;
      if (onSourceComplete) {
        try {
          onSourceComplete(res!, completedCount, ALL_SCRAPERS.length);
        } catch {
          // Ignorer
        }
      }
    }
    return res;
  });

  const rawListings: ScrapedListing[] = [];
  const sourceResults: SourceSummary[] = [];
  let successfulSources = 0;

  settled.forEach((res, idx) => {
    const scraper = ALL_SCRAPERS[idx];
    if (res.status === 'fulfilled') {
      const result: ScraperResult = res.value;
      if (result.success || result.listings.length > 0) {
        successfulSources++;
      }
      sourceResults.push({
        source: result.source,
        sourceKey: result.sourceKey,
        count: result.listings.length,
        method: result.method,
        success: result.success,
        error: result.error,
      });
      rawListings.push(...result.listings);
    } else {
      sourceResults.push({
        source: scraper.name,
        sourceKey: scraper.sourceKey,
        count: 0,
        method: 'cache',
        success: false,
        error: res.reason instanceof Error ? res.reason.message : String(res.reason),
      });
    }
  });

  // 1. Filtrer impérativement les pièces détachées / assemblages et les modèles non correspondants
  // 2. Extraire la granularité (specs) si pas encore renseignée
  const cleanAndSpecListings: ScrapedListing[] = [];
  let excludedPartsCount = 0;
  let excludedMismatchedModelsCount = 0;

  for (const l of rawListings) {
    if (isPartOrAssembly(l.title)) {
      excludedPartsCount++;
      continue;
    }
    // Validation du modèle recherché pour éliminer les faux positifs (ex: XPS 15 7590 vs XPS 17 9730)
    if (!isModelMatch(l.title, searchModel)) {
      excludedMismatchedModelsCount++;
      continue;
    }
    if (!l.specs) {
      l.specs = extractSpecsFromTitle(l.title);
    }
    cleanAndSpecListings.push(l);
  }

  if (excludedPartsCount > 0) {
    log(`🛡️ [Filtre Anti-Pièces] ${excludedPartsCount} annonces de pièces/assemblages éliminées.`);
  }
  if (excludedMismatchedModelsCount > 0) {
    log(`🛡️ [Filtre Modèle] ${excludedMismatchedModelsCount} annonces de modèles non correspondants (recherche floue) éliminées.`);
  }

  // Déduplication + détection d'outliers
  const deduplicated = deduplicateListings(cleanAndSpecListings);
  const processedListings = flagOutliers(deduplicated);
  const medianPrice = calculateMedian(processedListings);
  const confidence = determineConfidence(processedListings, successfulSources);

  log(`📊 Collecte terminée : ${processedListings.length} annonces valides extraites de ${successfulSources}/${ALL_SCRAPERS.length} sources. Médiane calculée : ${medianPrice}$ (${confidence}).`);

  return {
    allListings: processedListings,
    sourceResults,
    totalSources: ALL_SCRAPERS.length,
    successfulSources,
    totalListings: processedListings.length,
    medianPrice,
    confidence,
    timestamp,
  };
}
