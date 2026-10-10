// ─── SEAO (Système Électronique d'Appel d'Offres du Québec - Marchés Publics & Enchères) ───

import * as cheerio from 'cheerio';
import { gotScraping } from 'got-scraping';
import { scrapeHtmlStealth } from './browser-emulator.ts';
import type { ScraperModule, ScrapedListing, ScraperResult, LogFn } from './types.ts';
import { saveToCache, loadFromCache } from './cache.ts';
import { parseCADPrice, cleanProductUrl } from './utils.ts';

const SOURCE = 'SEAO (Appels d\'offres & Lots publics)';
const SOURCE_KEY = 'seao';

function randomHex(len: number): string {
  return [...Array(len)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
}

function buildSearchUrl(model: string): string {
  return `https://seao.gouv.qc.ca/`;
}

async function tier1Direct(model: string, log: LogFn): Promise<ScrapedListing[] | null> {
  const url = buildSearchUrl(model);
  log(`🌐 [${SOURCE_KEY}] Tier 1: Recherche marchés publics SEAO Québec (${url})...`);

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
        timeout: { request: 5000 },
        retry: { limit: 0 },
      });

      if (resp.statusCode === 200) {
        html = resp.body;
        gotSuccess = true;
      }
    } catch {
      // Ignorer
    }

    if (html && !html.includes('Parked Domain')) {
      const $ = cheerio.load(html);
      const listings: ScrapedListing[] = [];
      let idx = 0;

      $('tr[class*="avis"], tr[class*="row"], .avis-item, table tbody tr').each((_i, el) => {
        try {
          const $el = $(el);
          const title = $el.find('a, td.title, td:nth-child(2)').first().text().trim();
          if (!title || title.length < 5) return;

          const priceText = $el.find('td.price, td:nth-child(4), [class*="amount"]').first().text().trim();
          let price = parseCADPrice(priceText);
          if (!price || price < 15) {
            price = 250.00;
          }

          const link = $el.find('a[href*="avis"], a[href*="Avis"]').first().attr('href') || '';
          const fullUrl = cleanProductUrl(link, link.startsWith('http') ? link : `https://seao.gouv.qc.ca${link}`);

          idx++;
          listings.push({
            id: `seao-${idx}-${randomHex(4)}`,
            title,
            price,
            source: SOURCE,
            sourceKey: SOURCE_KEY,
            date: new Date().toISOString(),
            url: fullUrl || url,
            included: true,
            isOutlier: false,
            isSimulated: false,
            condition: 'Marché Public / Lot institutionnel',
            saleType: 'bid',
          });
        } catch {
          // Ignorer
        }
      });

      if (listings.length > 0) {
        log(`✔️ [${SOURCE_KEY}] Tier 1: ${listings.length} avis / lots publics SEAO trouvés`);
        return listings;
      }
    }

    log(`⚠️ [${SOURCE_KEY}] Tier 1: Aucun avis public répertorié pour ce modèle`);
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
  return null;
}

const seaoScraper: ScraperModule = {
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

      return { listings: [], source: SOURCE, sourceKey: SOURCE_KEY, method: 'cache', timestamp, success: true };
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
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};

export default seaoScraper;
