// ─── Walmart Canada (Restored / Reconditionné) ───

import * as cheerio from 'cheerio';
import { scrapeHtmlStealth } from './browser-emulator.ts';
import type { ScraperModule, ScrapedListing, ScraperResult, LogFn } from './types.ts';
import { saveToCache, loadFromCache } from './cache.ts';
import { parseCADPrice, cleanProductUrl } from './utils.ts';
import { computeDiscount } from './exchange-rate.ts';

const SOURCE = 'Walmart Canada (Restored)';
const SOURCE_KEY = 'walmart';

function randomHex(len: number): string {
  return [...Array(len)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
}

function buildSearchUrl(model: string): string {
  return `https://www.walmart.ca/en/search?q=${encodeURIComponent(model)}`;
}

async function tier1Direct(model: string, log: LogFn): Promise<ScrapedListing[] | null> {
  const url = buildSearchUrl(model);
  log(`🌐 [${SOURCE_KEY}] Tier 1: Scraping direct Walmart Canada via Playwright Stealth...`);
  try {
    const html = await scrapeHtmlStealth(url);
    const $ = cheerio.load(html);
    const listings: ScrapedListing[] = [];
    let idx = 0;

    // 1. Extraction via __NEXT_DATA__
    const nextDataRaw = $('#__NEXT_DATA__').html();
    if (nextDataRaw) {
      try {
        const data = JSON.parse(nextDataRaw);
        const searchResults = data?.props?.pageProps?.initialData?.searchResult?.itemStacks?.[0]?.items ||
          data?.props?.pageProps?.searchResults?.itemStacks?.[0]?.items ||
          data?.props?.pageProps?.products || [];

        for (const item of searchResults) {
          const title = String(item.title || item.name || '');

          // Prix actuel (final après rabais)
          const priceObj = item.priceInfo?.currentPrice || item.price;
          const rawPrice = typeof priceObj === 'number' ? priceObj : (priceObj?.price || priceObj?.amount);
          const price = parseCADPrice(rawPrice);

          // Prix original / avant rabais (wasPrice / listPrice / compareAtPrice)
          const wasObj = item.priceInfo?.wasPrice || item.priceInfo?.listPrice || item.compareAtPrice;
          const rawWas = typeof wasObj === 'number' ? wasObj : (wasObj?.price || wasObj?.amount);
          const wasPrice = rawWas ? parseCADPrice(rawWas) : undefined;

          if (!title || !price || price < 15) continue;

          const discount = wasPrice ? computeDiscount(wasPrice, price) : undefined;

          let productUrl = '';
          if (item.canonicalUrl || item.url) {
            const u = item.canonicalUrl || item.url;
            productUrl = cleanProductUrl(u, u.startsWith('http') ? u : `https://www.walmart.ca${u}`);
          }
          if (!productUrl) continue;

          const titleLower = title.toLowerCase();
          const isOutlier = titleLower.includes('case') || titleLower.includes('cover') || titleLower.includes('charger');

          idx++;
          listings.push({
            id: `walmart-${idx}-${randomHex(4)}`,
            title,
            price,
            source: SOURCE,
            sourceKey: SOURCE_KEY,
            date: new Date().toISOString(),
            url: productUrl,
            included: !isOutlier,
            isOutlier,
            isSimulated: false,
            condition: 'Restored / Reconditionné',
            saleType: 'fixed',
            originalPrice: wasPrice && wasPrice > price ? wasPrice : undefined,
            discountAmount: discount?.discountAmount,
            discountPercent: discount?.discountPercent,
          });
        }

        if (listings.length > 0) {
          log(`✔️ [${SOURCE_KEY}] Tier 1: ${listings.length} produits trouvés via __NEXT_DATA__`);
          return listings;
        }
      } catch {
        // Ignorer
      }
    }

    // 2. Extraction DOM direct
    $('[data-item-id], [class*="product"], [class*="item-card"]').each((_i, el) => {
      try {
        const $el = $(el);
        const title = $el.find('[data-automation-id="product-title"], h3, span[dir="auto"]').first().text().trim();
        if (!title || title.length < 5) return;

        const priceText = $el.find('[data-automation-id="product-price"], [class*="price"]').first().text().trim();
        const price = parseCADPrice(priceText);
        if (!price || price < 15) return;

        const link = $el.find('a[href*="/ip/"]').first().attr('href') || '';
        if (!link) return;
        const fullUrl = cleanProductUrl(link, link.startsWith('http') ? link : `https://www.walmart.ca${link}`);

        const titleLower = title.toLowerCase();
        const isOutlier = titleLower.includes('case') || titleLower.includes('charger');

        idx++;
        listings.push({
          id: `walmart-${idx}-${randomHex(4)}`,
          title,
          price,
          source: SOURCE,
          sourceKey: SOURCE_KEY,
          date: new Date().toISOString(),
          url: fullUrl,
          included: !isOutlier,
          isOutlier,
          isSimulated: false,
          condition: 'Restored / Reconditionné',
          saleType: 'fixed',
        });
      } catch {
        // Ignorer
      }
    });

    if (listings.length > 0) {
      log(`✔️ [${SOURCE_KEY}] Tier 1: ${listings.length} produits trouvés via DOM HTML`);
      return listings;
    }

    log(`⚠️ [${SOURCE_KEY}] Tier 1: Aucun produit trouvé`);
    return null;
  } catch (err) {
    log(`⚠️ [${SOURCE_KEY}] Tier 1 Playwright échoué: ${err instanceof Error ? err.message : String(err)}`);
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

const walmartScraper: ScraperModule = {
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

export default walmartScraper;
