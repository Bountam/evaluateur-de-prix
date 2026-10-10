// ─── Dell Refurbished Canada (Matériel d'Entreprise Reconditionné Off-Lease) ───

import * as cheerio from 'cheerio';
import { gotScraping } from 'got-scraping';
import { scrapeHtmlStealth } from './browser-emulator.ts';
import type { ScraperModule, ScrapedListing, ScraperResult, LogFn } from './types.ts';
import { saveToCache, loadFromCache } from './cache.ts';
import { parseCADPrice, cleanProductUrl } from './utils.ts';

const SOURCE = 'Dell Refurbished Canada';
const SOURCE_KEY = 'dell';

function randomHex(len: number): string {
  return [...Array(len)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
}

function buildSearchUrl(model: string): string {
  return `https://www.dellrefurbished.ca/index.php?page=seek&id[m]=pattern&id[q]=${encodeURIComponent(model)}`;
}

async function tier1Direct(model: string, log: LogFn): Promise<ScrapedListing[] | null> {
  const url = buildSearchUrl(model);
  log(`🌐 [${SOURCE_KEY}] Tier 1: Scraping direct Dell Refurbished Canada (Stealth got-scraping)...`);

  try {
    let html = '';
    let gotSuccess = false;

    try {
      const resp = await gotScraping({
        url,
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'fr-CA,fr;q=0.9,en-CA;q=0.8,en;q=0.7',
        },
        timeout: { request: 10000 },
        retry: { limit: 0 },
      });

      if (resp.statusCode === 200) {
        html = resp.body;
        gotSuccess = true;
      }
    } catch {
      // Ignorer, fallback Playwright
    }

    if (!gotSuccess || !html || html.length < 3000) {
      log(`🔎 [${SOURCE_KEY}] Tier 1 Alt: Tentative avec Playwright Stealth...`);
      try {
        html = await scrapeHtmlStealth(url);
      } catch (err) {
        log(`⚠️ [${SOURCE_KEY}] Tier 1 Alt Playwright échoué: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (html) {
      const $ = cheerio.load(html);
      const listings: ScrapedListing[] = [];
      let idx = 0;

      $('.thumb-grid, .product-item, .productCard, article, [class*="product-card"], .product-item-info').each((_i, el) => {
        try {
          const $el = $(el);
          const title = $el.find('a[href*="/item/"]').last().text().trim() ||
                        $el.find('.product-name, .product-item-name, a.product-item-link, h2, h3').first().text().trim();
          if (!title || title.length < 5) return;

          const priceText = $el.find('.sale-price, .price, .price-wrapper, [class*="price"]').first().text().trim();
          const price = parseCADPrice(priceText);
          if (!price || price < 15) return;

          const link = $el.find('a[href*="/item/"], a[href*=".html"], a[href*="dellrefurbished.ca"]').first().attr('href') || '';
          const fullUrl = cleanProductUrl(link, link.startsWith('http') ? link : `https://www.dellrefurbished.ca${link}`);

          const gradeMatch = $el.text().match(/Grade\s+[A-C]/i);
          const condition = gradeMatch ? gradeMatch[0].replace(/\s+/g, ' ') : ($el.find('.grade, [class*="grade"], .condition').first().text().trim() || 'Grade A Reconditionné');

          idx++;
          listings.push({
            id: `dell-${idx}-${randomHex(4)}`,
            title,
            price,
            source: SOURCE,
            sourceKey: SOURCE_KEY,
            date: new Date().toISOString(),
            url: fullUrl || url,
            included: true,
            isOutlier: false,
            isSimulated: false,
            condition,
            saleType: 'fixed',
          });
        } catch {
          // Ignorer
        }
      });

      if (listings.length > 0) {
        log(`✔️ [${SOURCE_KEY}] Tier 1: ${listings.length} produits Dell Reconditionnés trouvés`);
        return listings;
      }
    }

    log(`⚠️ [${SOURCE_KEY}] Tier 1: Aucun produit trouvé`);
    return null;
  } catch (err) {
    log(`⚠️ [${SOURCE_KEY}] Tier 1 échoué: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

function tier3Cache(model: string, log: LogFn): ScrapedListing[] | null {
  log(`🩺 [${SOURCE_KEY}] Tier 3: Chargement depuis le cache...`);
  const cached = loadFromCache(SOURCE_KEY, model);
  if (cached && cached.length > 0) {
    log(`✔️ [${SOURCE_KEY}] Tier 3: ${cached.length} résultats depuis le cache`);
    return cached;
  }
  log(`⚠️ [${SOURCE_KEY}] Tier 3: Aucune donnée en cache`);
  return null;
}

const dellScraper: ScraperModule = {
  name: SOURCE,
  sourceKey: SOURCE_KEY,

  async scrape(model: string, log: LogFn): Promise<ScraperResult> {
    const timestamp = new Date().toISOString();

    try {
      const directListings = await tier1Direct(model, log);
      if (directListings && directListings.length > 0) {
        saveToCache(SOURCE_KEY, model, directListings);
        return { listings: directListings, source: SOURCE, sourceKey: SOURCE_KEY, method: 'direct', timestamp, success: true };
      }

      const cachedListings = tier3Cache(model, log);
      if (cachedListings && cachedListings.length > 0) {
        return { listings: cachedListings, source: SOURCE, sourceKey: SOURCE_KEY, method: 'cache', timestamp, success: true };
      }

      return { listings: [], source: SOURCE, sourceKey: SOURCE_KEY, method: 'cache', timestamp, success: false, error: 'Aucune donnée disponible' };
    } catch (err) {
      log(`⚠️ [${SOURCE_KEY}] Erreur globale: ${err instanceof Error ? err.message : String(err)}`);
      const cachedListings = tier3Cache(model, log);
      return {
        listings: cachedListings || [],
        source: SOURCE,
        sourceKey: SOURCE_KEY,
        method: 'cache',
        timestamp,
        success: cachedListings !== null && cachedListings.length > 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};

export default dellScraper;
