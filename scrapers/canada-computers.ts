// ─── Canada Computers (Matériel Reconditionné / Refurbished) ───

import * as cheerio from 'cheerio';
import { gotScraping } from 'got-scraping';
import { scrapeHtmlStealth } from './browser-emulator.ts';
import type { ScraperModule, ScrapedListing, ScraperResult, LogFn } from './types.ts';
import { saveToCache, loadFromCache } from './cache.ts';
import { parseCADPrice, cleanProductUrl } from './utils.ts';

const SOURCE = 'Canada Computers (Refurbished)';
const SOURCE_KEY = 'canada-computers';

function randomHex(len: number): string {
  return [...Array(len)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
}

function buildSearchUrl(model: string): string {
  return `https://www.canadacomputers.com/search/results_details.php?keywords=${encodeURIComponent(model + ' refurbished')}`;
}

async function tier1Direct(model: string, log: LogFn): Promise<ScrapedListing[] | null> {
  const url = buildSearchUrl(model);
  log(`🌐 [${SOURCE_KEY}] Tier 1: Scraping direct Canada Computers (Stealth got-scraping)...`);

  try {
    let html = '';
    let gotSuccess = false;

    try {
      const resp = await gotScraping({
        url,
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-CA,en;q=0.9,fr-CA;q=0.8',
        },
        timeout: { request: 15000 },
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

      $('.product-card, .toggleGrid, div[class*="product"], article').each((_i, el) => {
        try {
          const $el = $(el);
          const title = $el.find('.product-title, .text-truncate, a[href*="product_info.php"], h3, h2').first().text().trim();
          if (!title || title.length < 5) return;

          const priceText = $el.find('.product-price, .price, [class*="price"]').first().text().trim();
          const price = parseCADPrice(priceText);
          if (!price || price < 15) return;

          const link = $el.find('a[href*="product_info.php"], a[href*="/product/"]').first().attr('href') || '';
          const fullUrl = cleanProductUrl(link, link.startsWith('http') ? link : `https://www.canadacomputers.com/${link}`);

          const titleLower = title.toLowerCase();
          const isOutlier = titleLower.includes('case') || titleLower.includes('cable') || titleLower.includes('adapter');

          idx++;
          listings.push({
            id: `canada-computers-${idx}-${randomHex(4)}`,
            title,
            price,
            source: SOURCE,
            sourceKey: SOURCE_KEY,
            date: new Date().toISOString(),
            url: fullUrl || url,
            included: !isOutlier,
            isOutlier,
            isSimulated: false,
            condition: 'Reconditionné',
            saleType: 'fixed',
          });
        } catch {
          // Ignorer
        }
      });

      if (listings.length > 0) {
        log(`✔️ [${SOURCE_KEY}] Tier 1: ${listings.length} produits trouvés`);
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

const canadaComputersScraper: ScraperModule = {
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

export default canadaComputersScraper;
