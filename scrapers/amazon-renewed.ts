import * as cheerio from 'cheerio';
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

async function tier1Direct(model: string, log: LogFn): Promise<ScrapedListing[] | null> {
  const url = buildSearchUrl(model);
  log(`🌐 [${SOURCE_KEY}] Tier 1: Scraping direct Amazon Renewed via Playwright Stealth...`);
  try {
    const html = await scrapeHtmlStealth(url, '[data-component-type="s-search-result"]');
    const $ = cheerio.load(html);
    const listings: ScrapedListing[] = [];
    let idx = 0;

    $('.s-result-item[data-asin]').each((_i, el) => {
      try {
        const $el = $(el);
        const asin = $el.attr('data-asin') || '';
        if (!asin || asin === '') return;

        // Ignorer les résultats sponsorisés trop proéminents
        const title = $el.find('h2 a span').first().text().trim() ||
          $el.find('h2 span').first().text().trim();
        if (!title || title.length < 10) return;

        // Prix actuel (.a-price .a-offscreen)
        const priceText = $el.find('.a-price .a-offscreen').first().text().trim();
        const price = parseCADPrice(priceText);
        if (!price || price < 15) return;

        // Prix "Was" (Amazon affiche le prix avant rabais dans .a-price.a-text-price)
        const wasPriceText = $el.find('.a-price.a-text-price .a-offscreen, .a-text-price .a-offscreen, [data-a-strike] .a-offscreen').first().text().trim();
        const wasPrice = wasPriceText ? parseCADPrice(wasPriceText) : undefined;
        const discount = wasPrice && wasPrice > price ? computeDiscount(wasPrice, price) : undefined;

        const href = $el.find('h2 a, a.a-link-normal').first().attr('href') || `/dp/${asin}`;
        const cleanUrl = cleanProductUrl(href, `https://www.amazon.ca/dp/${asin}`);

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
