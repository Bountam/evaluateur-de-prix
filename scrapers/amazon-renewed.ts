import * as cheerio from 'cheerio';
import { gotScraping } from 'got-scraping';
import type { ScraperModule, ScrapedListing, ScraperResult, LogFn } from './types.ts';
import { saveToCache, loadFromCache } from './cache.ts';
import { parseCADPrice, cleanProductUrl } from './utils.ts';
import { scrapeHtmlStealth } from './browser-emulator.ts';
import { computeDiscount } from './exchange-rate.ts';

const SOURCE = 'Amazon Renewed';
const SOURCE_KEY = 'amazon-renewed';

function randomHex(len: number): string {
  return [...Array(len)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
}

function buildSearchUrl(model: string): string {
  return `https://www.amazon.ca/s?k=${encodeURIComponent(model + ' renewed')}`;
}

function parseAmazonHtml($: cheerio.CheerioAPI): ScrapedListing[] {
  const listings: ScrapedListing[] = [];
  let idx = 0;

  $('[data-asin]:not([data-asin=""])').each((_i, el) => {
    try {
      const $el = $(el);
      const asin = $el.attr('data-asin') || '';
      if (!asin || asin.length < 5) return;

      const title = $el.find('h2 a span, h2 span, [data-cy="title-recipe"] h2, h2').first().text().trim();
      if (!title || title.length < 10) return;

      const priceText = $el.find('.a-price .a-offscreen, .a-price-whole').first().text().trim();
      const price = parseCADPrice(priceText);
      if (!price || price < 15) return;

      const wasPriceText = $el.find('.a-price.a-text-price .a-offscreen, .a-text-price .a-offscreen, [data-a-strike] .a-offscreen').first().text().trim();
      const wasPrice = wasPriceText ? parseCADPrice(wasPriceText) : undefined;
      const discount = wasPrice && wasPrice > price ? computeDiscount(wasPrice, price) : undefined;

      const canonicalUrl = `https://www.amazon.ca/dp/${asin}`;
      const cleanUrl = cleanProductUrl(canonicalUrl, canonicalUrl);

      const titleLower = title.toLowerCase();
      const isOutlier = titleLower.includes('case') || titleLower.includes('étui') ||
        titleLower.includes('screen protector') || titleLower.includes('charger') ||
        titleLower.includes('cable') || titleLower.includes('accessoire');

      idx++;
      listings.push({
        id: `amazon-renewed-${idx}-${randomHex(4)}`,
        title,
        price,
        source: SOURCE,
        sourceKey: SOURCE_KEY,
        date: new Date().toISOString(),
        url: cleanUrl,
        included: !isOutlier,
        isOutlier,
        isSimulated: false,
        condition: 'Renewed / Reconditionné',
        saleType: 'fixed',
        originalPrice: wasPrice && wasPrice > price ? wasPrice : undefined,
        discountAmount: discount?.discountAmount,
        discountPercent: discount?.discountPercent,
      });
    } catch {
      // Ignorer
    }
  });

  return listings;
}

async function tier1Direct(model: string, log: LogFn): Promise<ScrapedListing[] | null> {
  const url = buildSearchUrl(model);
  log(`🌐 [${SOURCE_KEY}] Tier 1: Scraping direct Amazon Renewed (got-scraping)...`);
  try {
    let listings: ScrapedListing[] = [];

    // Tentative 1 : got-scraping (ultra-rapide, 1-2s)
    try {
      const resp = await gotScraping({
        url,
        headers: {
          'Accept-Language': 'fr-CA,fr;q=0.9,en-CA;q=0.8,en;q=0.7',
        },
        timeout: { request: 8000 },
      });

      if (resp.statusCode === 200) {
        const $ = cheerio.load(resp.body);
        listings = parseAmazonHtml($);
      }
    } catch {
      // Ignorer, fallback Playwright Stealth
    }

    // Tentative 2 : Playwright Stealth (si got-scraping ne retourne rien)
    if (listings.length === 0) {
      log(`🔎 [${SOURCE_KEY}] Tier 1 Alt: Tentative Playwright Stealth...`);
      try {
        const html = await scrapeHtmlStealth(url, '[data-component-type="s-search-result"]');
        const $ = cheerio.load(html);
        listings = parseAmazonHtml($);
      } catch (err) {
        log(`⚠️ [${SOURCE_KEY}] Tier 1 Alt Playwright échoué: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (listings.length === 0) {
      log(`⚠️ [${SOURCE_KEY}] Tier 1: Aucun résultat trouvé (possible CAPTCHA)`);
      return null;
    }

    log(`✔️ [${SOURCE_KEY}] Tier 1: ${listings.length} produits trouvés`);
    return listings;
  } catch (err) {
    log(`⚠️ [${SOURCE_KEY}] Tier 1 échoué: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

async function tier2DataAsin(model: string, log: LogFn): Promise<ScrapedListing[] | null> {
  const url = buildSearchUrl(model);
  log(`📡 [${SOURCE_KEY}] Tier 2: Parsing alternatif via Playwright Stealth...`);
  try {
    const html = await scrapeHtmlStealth(url, '[data-asin]');
    const $ = cheerio.load(html);
    const listings: ScrapedListing[] = [];
    let idx = 0;

    // Parsing alternatif via data-component-type
    $('[data-asin]:not([data-asin=""])').each((_i, el) => {
      try {
        const $el = $(el);
        const asin = $el.attr('data-asin') || '';
        if (!asin) return;

        // Chercher le titre dans différents sélecteurs
        const title = $el.find('[data-cy="title-recipe"] span').text().trim() ||
          $el.find('.a-text-normal').first().text().trim() ||
          $el.find('img[alt]').first().attr('alt') || '';
        if (!title || title.length < 10) return;

        // Chercher le prix dans différents sélecteurs
        const priceText = $el.find('.a-price .a-offscreen').first().text().trim() ||
          $el.find('[data-a-color="price"] .a-offscreen').first().text().trim() ||
          $el.find('.a-price-whole').first().text().trim();
        const price = parseCADPrice(priceText);
        if (!price || price < 15) return;

        const href = $el.find('a.a-link-normal, a[href*="/dp/"]').first().attr('href') || `/dp/${asin}`;
        const cleanUrl = cleanProductUrl(href, `https://www.amazon.ca/dp/${asin}`);

        const titleLower = title.toLowerCase();
        const isOutlier = titleLower.includes('case') || titleLower.includes('étui') ||
          titleLower.includes('charger') || titleLower.includes('cable');

        idx++;
        listings.push({
          id: `amazon-renewed-${idx}-${randomHex(4)}`,
          title,
          price,
          source: SOURCE,
          sourceKey: SOURCE_KEY,
          date: new Date().toISOString(),
          url: cleanUrl,
          included: !isOutlier,
          isOutlier,
          isSimulated: false,
          condition: 'Renewed / Reconditionné',
          saleType: 'fixed',
        });
      } catch {
        // Ignorer
      }
    });

    if (listings.length === 0) {
      log(`⚠️ [${SOURCE_KEY}] Tier 2: Aucun résultat via data-asin`);
      return null;
    }

    log(`✔️ [${SOURCE_KEY}] Tier 2: ${listings.length} produits via data-asin`);
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

const amazonRenewedScraper: ScraperModule = {
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

      const asinListings = await tier2DataAsin(model, log);
      if (asinListings && asinListings.length > 0) {
        saveToCache(SOURCE_KEY, model, asinListings);
        return { listings: asinListings, source: SOURCE, sourceKey: SOURCE_KEY, method: 'api', timestamp, success: true };
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

export default amazonRenewedScraper;
