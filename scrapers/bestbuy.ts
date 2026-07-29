// ─── Best Buy Marketplace Canada ───

import * as cheerio from 'cheerio';
import { gotScraping } from 'got-scraping';
import type { ScraperModule, ScrapedListing, ScraperResult, LogFn } from './types.ts';
import { saveToCache, loadFromCache } from './cache.ts';
import { parseCADPrice, cleanProductUrl } from './utils.ts';
import { computeDiscount } from './exchange-rate.ts';

const SOURCE = 'Best Buy Marketplace';
const SOURCE_KEY = 'bestbuy';

function randomHex(len: number): string {
  return [...Array(len)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
}

function buildSearchUrl(model: string): string {
  return `https://www.bestbuy.ca/en-ca/search?search=${encodeURIComponent(model)}`;
}

async function tier1Direct(model: string, log: LogFn): Promise<ScrapedListing[] | null> {
  const url = buildSearchUrl(model);
  log(`🌐 [${SOURCE_KEY}] Tier 1: Scraping direct Best Buy (Stealth got-scraping)...`);
  try {
    const resp = await gotScraping({
      url,
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-CA,en;q=0.9,fr-CA;q=0.8',
        'Cache-Control': 'no-cache',
        'Upgrade-Insecure-Requests': '1',
      },
      timeout: { request: 15000 },
    });

    if (resp.statusCode !== 200) {
      log(`⚠️ [${SOURCE_KEY}] Tier 1: HTTP ${resp.statusCode}`);
      return null;
    }

    const html = resp.body;
    const $ = cheerio.load(html);
    const listings: ScrapedListing[] = [];
    let idx = 0;

    // Best Buy product containers
    $('[class*="productListItem"], [class*="product-item"], .x-product, [data-sku]').each((_i, el) => {
      try {
        const $el = $(el);

        const title = $el.find('[class*="productItemName"], [data-automation="productItemName"], h3, [itemprop="name"]').first().text().trim() ||
          $el.find('a[href*="/product/"]').first().text().trim();
        if (!title || title.length < 5) return;

        // Tenter de capturer les deux prix (barré + réduit)
        const salePriceText = $el.find('[class*="productItemPrice"], [data-automation*="price"], [class*="sale-price"], [class*="currentPrice"]').first().text().trim();
        const wasText = $el.find('[class*="was-price"], [class*="regularPrice"], [class*="strikethrough"], s, del').first().text().trim();

        const salePrice = parseCADPrice(salePriceText);
        const wasPrice = wasText ? parseCADPrice(wasText) : undefined;
        const finalPrice = salePrice || parseCADPrice($el.find('[itemprop="price"]').first().text().trim());
        if (!finalPrice || finalPrice < 15) return;

        const discount = wasPrice ? computeDiscount(wasPrice, finalPrice) : undefined;

        const link = $el.find('a[href*="/product/"]').attr('href') || '';
        if (!link || !link.includes('/product/')) return;
        const fullUrl = cleanProductUrl(link, `https://www.bestbuy.ca${link}`);

        const titleLower = title.toLowerCase();
        const isOutlier = titleLower.includes('case') || titleLower.includes('étui') ||
          titleLower.includes('screen protector') || titleLower.includes('charger') ||
          titleLower.includes('cable') || titleLower.includes('mount');

        idx++;
        listings.push({
          id: `bestbuy-${idx}-${randomHex(4)}`,
          title,
          price: finalPrice,
          source: SOURCE,
          sourceKey: SOURCE_KEY,
          date: new Date().toISOString(),
          url: fullUrl,
          included: !isOutlier,
          isOutlier,
          isSimulated: false,
          saleType: 'fixed',
          originalPrice: wasPrice,
          discountAmount: discount?.discountAmount,
          discountPercent: discount?.discountPercent,
        });
      } catch {
        // Ignorer
      }
    });

    if (listings.length === 0) {
      log(`⚠️ [${SOURCE_KEY}] Tier 1: Aucun produit trouvé`);
      return null;
    }

    log(`✔️ [${SOURCE_KEY}] Tier 1: ${listings.length} produits trouvés`);
    return listings;
  } catch (err) {
    log(`⚠️ [${SOURCE_KEY}] Tier 1 échoué: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

async function tier2API(model: string, log: LogFn): Promise<ScrapedListing[] | null> {
  log(`📡 [${SOURCE_KEY}] Tier 2: Tentative API JSON Best Buy...`);
  const apiUrl = `https://www.bestbuy.ca/api/v2/json/search?query=${encodeURIComponent(model)}&page=1&pageSize=24&lang=en-CA&sortBy=relevance&sortDir=desc`;

  try {
    const resp = await gotScraping({
      url: apiUrl,
      headers: {
        'Accept': 'application/json',
        'Accept-Language': 'en-CA,en;q=0.9',
        'Referer': buildSearchUrl(model),
        'Origin': 'https://www.bestbuy.ca',
      },
      timeout: { request: 10000 },
    });

    if (resp.statusCode !== 200) {
      log(`⚠️ [${SOURCE_KEY}] Tier 2: API HTTP ${resp.statusCode}`);
      return null;
    }

    const json = JSON.parse(resp.body) as Record<string, unknown>;
    const products = (json.products || json.results || []) as Array<Record<string, unknown>>;
    if (!Array.isArray(products) || products.length === 0) {
      log(`⚠️ [${SOURCE_KEY}] Tier 2: API retourne 0 produits`);
      return null;
    }

    const listings: ScrapedListing[] = [];
    let idx = 0;

    for (const p of products) {
      const title = String(p.name || p.title || p.shortName || '');
      if (!title || title.length < 5) continue;

      // Best Buy API fournit regularPrice (prix conseillé) et salePrice (prix actuel)
      const regularPrice = typeof p.regularPrice === 'number' ? p.regularPrice : parseCADPrice(String(p.regularPrice || ''));
      const salePrice = typeof p.salePrice === 'number' ? p.salePrice : parseCADPrice(String(p.salePrice || ''));
      // Le vrai prix payé est toujours le plus bas des deux
      const finalPrice = (salePrice && regularPrice)
        ? Math.min(salePrice, regularPrice)
        : salePrice || regularPrice || parseCADPrice(String(p.price || ''));
      if (!finalPrice || finalPrice < 15) continue;

      // Prix original (pour affichage barré) = regularPrice si supérieur au prix final
      const wasPrice = regularPrice && regularPrice > finalPrice ? regularPrice : undefined;
      const discount = wasPrice ? computeDiscount(wasPrice, finalPrice) : undefined;

      const sku = String(p.sku || p.productId || '');
      const seoText = String(p.seoText || p.seoUrl || '');
      let productUrl = '';
      if (seoText && sku) {
        productUrl = `https://www.bestbuy.ca/en-ca/product/${seoText}/${sku}`;
      } else if (sku) {
        productUrl = `https://www.bestbuy.ca/en-ca/product/${sku}`;
      } else if (typeof p.url === 'string' && p.url.startsWith('http') && p.url.includes('/product/')) {
        productUrl = cleanProductUrl(p.url, p.url);
      }
      if (!productUrl || productUrl.includes('/search')) continue;

      const titleLower = title.toLowerCase();
      const isOutlier = titleLower.includes('case') || titleLower.includes('étui') ||
        titleLower.includes('charger') || titleLower.includes('cable');

      idx++;
      listings.push({
        id: `bestbuy-${idx}-${randomHex(4)}`,
        title,
        price: finalPrice,
        source: SOURCE,
        sourceKey: SOURCE_KEY,
        date: new Date().toISOString(),
        url: productUrl,
        included: !isOutlier,
        isOutlier,
        isSimulated: false,
        condition: String(p.condition || ''),
        saleType: 'fixed',
        originalPrice: wasPrice,
        discountAmount: discount?.discountAmount,
        discountPercent: discount?.discountPercent,
      });
    }

    if (listings.length === 0) {
      log(`⚠️ [${SOURCE_KEY}] Tier 2: Aucun produit parsable`);
      return null;
    }

    log(`✔️ [${SOURCE_KEY}] Tier 2: ${listings.length} produits via API`);
    return listings;
  } catch (err) {
    log(`⚠️ [${SOURCE_KEY}] Tier 2 échoué: ${err instanceof Error ? err.message : String(err)}`);
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

const bestbuyScraper: ScraperModule = {
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

      const apiListings = await tier2API(model, log);
      if (apiListings && apiListings.length > 0) {
        saveToCache(SOURCE_KEY, model, apiListings);
        return { listings: apiListings, source: SOURCE, sourceKey: SOURCE_KEY, method: 'api', timestamp, success: true };
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
        source: SOURCE, sourceKey: SOURCE_KEY, method: 'cache', timestamp,
        success: cachedListings !== null && cachedListings.length > 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};

export default bestbuyScraper;
