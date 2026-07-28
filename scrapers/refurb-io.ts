// ─── Refurb.io Canada (Spécialiste Informatique Reconditionnée) ───

import * as cheerio from 'cheerio';
import { gotScraping } from 'got-scraping';
import { scrapeHtmlStealth } from './browser-emulator.ts';
import type { ScraperModule, ScrapedListing, ScraperResult, LogFn } from './types.ts';
import { saveToCache, loadFromCache } from './cache.ts';
import { parseCADPrice, cleanProductUrl } from './utils.ts';
import { computeDiscount } from './exchange-rate.ts';

const SOURCE = 'Refurb.io Canada';
const SOURCE_KEY = 'refurb-io';

function randomHex(len: number): string {
  return [...Array(len)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
}

function buildSearchUrl(model: string): string {
  return `https://refurb.io/search?q=${encodeURIComponent(model)}`;
}

async function tier1Direct(model: string, log: LogFn): Promise<ScrapedListing[] | null> {
  log(`🌐 [${SOURCE_KEY}] Tier 1: Scraping API Shopify & direct Refurb.io...`);

  // 1. Essayer l'API JSON de recherche instantanée Shopify
  try {
    const apiUrl = `https://refurb.io/search/suggest.json?q=${encodeURIComponent(model)}&resources[type]=product&resources[limit]=20`;
    const resp = await gotScraping({
      url: apiUrl,
      headers: {
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
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
          // price = prix actuel (en cents Shopify pour les items en promotion, en dollars sinon)
          const rawPrice = p.price || p.price_min;
          const price = parseCADPrice(rawPrice);
          if (!title || !price || price < 15) continue;

          // compare_at_price = prix avant promotion chez Shopify (en cents ou dollars selon API)
          const rawCompare = p.compare_at_price || p.compareAtPrice || p.compare_at_price_min;
          const comparePrice = rawCompare ? parseCADPrice(rawCompare) : undefined;
          const discount = comparePrice ? computeDiscount(comparePrice, price) : undefined;

          const url = cleanProductUrl(p.url, p.url.startsWith('http') ? p.url : `https://refurb.io${p.url}`);

          idx++;
          listings.push({
            id: `refurb-io-${idx}-${randomHex(4)}`,
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
            originalPrice: comparePrice && comparePrice > price ? comparePrice : undefined,
            discountAmount: discount?.discountAmount,
            discountPercent: discount?.discountPercent,
          });
        }

        if (listings.length > 0) {
          log(`✔️ [${SOURCE_KEY}] Tier 1: ${listings.length} produits trouvés via API Shopify`);
          return listings;
        }
      }
    }
  } catch {
    // Ignorer, passer au scraping HTML direct
  }

  // 2. Scraping HTML direct avec got-scraping ou Playwright Stealth
  const searchUrl = buildSearchUrl(model);
  try {
    let html = '';
    try {
      const resp = await gotScraping({
        url: searchUrl,
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        timeout: { request: 15000 },
      });
      if (resp.statusCode === 200) html = resp.body;
    } catch {
      // Ignorer
    }

    if (!html || html.length < 5000) {
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

      $('.product-card, .grid-product, article, [class*="product"]').each((_i, el) => {
        try {
          const $el = $(el);
          const title = $el.find('.product-card__title, .grid-product__title, a[href*="/products/"]').first().text().trim();
          if (!title || title.length < 5) return;

          const priceText = $el.find('.product-card__price, .grid-product__price, [class*="price"]').first().text().trim();
          const price = parseCADPrice(priceText);
          if (!price || price < 15) return;

          const link = $el.find('a[href*="/products/"]').first().attr('href') || '';
          if (!link) return;
          const fullUrl = cleanProductUrl(link, link.startsWith('http') ? link : `https://refurb.io${link}`);

          idx++;
          listings.push({
            id: `refurb-io-${idx}-${randomHex(4)}`,
            title,
            price,
            source: SOURCE,
            sourceKey: SOURCE_KEY,
            date: new Date().toISOString(),
            url: fullUrl,
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

const refurbIoScraper: ScraperModule = {
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

export default refurbIoScraper;
