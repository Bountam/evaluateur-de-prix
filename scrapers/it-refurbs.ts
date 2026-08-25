// ─── IT Refurbs Canada (Équipements Informatiques Reconditionnés) ───

import * as cheerio from 'cheerio';
import { gotScraping } from 'got-scraping';
import { scrapeHtmlStealth } from './browser-emulator.ts';
import type { ScraperModule, ScrapedListing, ScraperResult, LogFn } from './types.ts';
import { saveToCache, loadFromCache } from './cache.ts';
import { parseCADPrice, cleanProductUrl } from './utils.ts';

const SOURCE = 'IT Refurbs Canada';
const SOURCE_KEY = 'it-refurbs';

function randomHex(len: number): string {
  return [...Array(len)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
}

function buildSearchUrl(model: string): string {
  return `https://itrefurbs.ca/search?q=${encodeURIComponent(model)}`;
}

async function tier1Direct(model: string, log: LogFn): Promise<ScrapedListing[] | null> {
  log(`🌐 [${SOURCE_KEY}] Tier 1: Scraping API & direct IT Refurbs Canada...`);

  // 1. Tentative API Shopify JSON
  try {
    const apiUrl = `https://itrefurbs.ca/search/suggest.json?q=${encodeURIComponent(model)}&resources[type]=product&resources[limit]=20`;
    const resp = await gotScraping({
      url: apiUrl,
      headers: { 'Accept': 'application/json' },
      timeout: { request: 10000 },
    });

    if (resp.statusCode === 200) {
      const json = JSON.parse(resp.body) as any;
      const products = json?.resources?.results?.products || [];
      if (Array.isArray(products) && products.length > 0) {
        const listings: ScrapedListing[] = [];
        let idx = 0;

        for (const p of products) {
          const title = String(p.title || '');
          const price = parseCADPrice(p.price || p.compare_at_price);
          if (!title || !price || price < 15) continue;

          const url = cleanProductUrl(p.url, p.url.startsWith('http') ? p.url : `https://itrefurbs.ca${p.url}`);

          idx++;
          listings.push({
            id: `it-refurbs-${idx}-${randomHex(4)}`,
            title,
            price,
            source: SOURCE,
            sourceKey: SOURCE_KEY,
            date: new Date().toISOString(),
            url,
            included: true,
            isOutlier: false,
            isSimulated: false,
            condition: 'Reconditionné',
            saleType: 'fixed',
          });
        }

        if (listings.length > 0) {
          log(`✔️ [${SOURCE_KEY}] Tier 1: ${listings.length} produits trouvés via API Shopify`);
          return listings;
        }
      }
    }
  } catch {
    // Ignorer
  }

  // 2. Scraping HTML direct
  const searchUrl = buildSearchUrl(model);
  try {
    let html = '';
    try {
      const resp = await gotScraping({
        url: searchUrl,
        headers: { 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
        timeout: { request: 15000 },
      });
      if (resp.statusCode === 200) html = resp.body;
    } catch {
      // Ignorer
    }

    if (!html || html.length < 3000) {
      log(`🔎 [${SOURCE_KEY}] Tier 1 Alt: Tentative avec Playwright Stealth...`);
      try {
        html = await scrapeHtmlStealth(searchUrl);
      } catch (err) {
        log(`⚠️ [${SOURCE_KEY}] Tier 1 Alt Playwright échoué: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (html) {
      const $ = cheerio.load(html);
      const listings: ScrapedListing[] = [];
      let idx = 0;

      $('.product-item, .product-card, .grid-product, article').each((_i, el) => {
        try {
          const $el = $(el);
          const title = $el.find('.product-item__title, a[href*="/products/"], h3').first().text().trim();
          if (!title || title.length < 5) return;

          const priceText = $el.find('.price, .product-item__price, [class*="price"]').first().text().trim();
          const price = parseCADPrice(priceText);
          if (!price || price < 15) return;

          const link = $el.find('a[href*="/products/"]').first().attr('href') || '';
          const fullUrl = cleanProductUrl(link, link.startsWith('http') ? link : `https://itrefurbs.ca${link}`);

          idx++;
          listings.push({
            id: `it-refurbs-${idx}-${randomHex(4)}`,
            title,
            price,
            source: SOURCE,
            sourceKey: SOURCE_KEY,
            date: new Date().toISOString(),
            url: fullUrl || searchUrl,
            included: true,
            isOutlier: false,
            isSimulated: false,
            condition: 'Reconditionné',
            saleType: 'fixed',
          });
        } catch {
          // Ignorer
        }
      });

      if (listings.length > 0) {
        log(`✔️ [${SOURCE_KEY}] Tier 1: ${listings.length} produits trouvés via HTML`);
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

const itRefurbsScraper: ScraperModule = {
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

export default itRefurbsScraper;
