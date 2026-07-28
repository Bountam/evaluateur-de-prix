// ─── eBay Ventes Complétées — Référence la plus fiable pour la JVM ───

import * as cheerio from 'cheerio';
import { gotScraping } from 'got-scraping';
import { scrapeHtmlStealth } from './browser-emulator.ts';
import type { ScraperModule, ScrapedListing, ScraperResult, LogFn } from './types.ts';
import { saveToCache, loadFromCache } from './cache.ts';
import { getCredentials } from './credentials.ts';
import { parseCADPrice, cleanProductUrl } from './utils.ts';

const SOURCE = 'eBay (Ventes complétées)';
const SOURCE_KEY = 'ebay-completed';

function randomHex(len: number): string {
  return [...Array(len)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
}

function buildSearchUrl(model: string): string {
  const encoded = encodeURIComponent(model);
  return `https://www.ebay.ca/sch/i.html?_nkw=${encoded}&_sacat=0&LH_Complete=1&LH_Sold=1&_ipg=60`;
}

function isOutlierTitle(title: string): boolean {
  const titleLower = title.toLowerCase();
  return titleLower.includes('pièces') || titleLower.includes('parts') ||
    titleLower.includes('réparation') || titleLower.includes('repair') ||
    titleLower.includes('case only') || titleLower.includes('boîtier seulement') ||
    titleLower.includes('for parts') || titleLower.includes('broken') ||
    titleLower.includes('cassé') || titleLower.includes('box only') ||
    titleLower.includes('boîte seulement');
}

function parseHtmlListings($: cheerio.CheerioAPI): ScrapedListing[] {
  const listings: ScrapedListing[] = [];
  let idx = 0;

  $('.srp-results .s-item, .s-item__wrapper, .s-item, .s-card, li[id^="item"]').each((_i, el) => {
    try {
      const $el = $(el);
      
      // Extraction du titre : éliminer les faux headers "Shop on eBay"
      let title = $el.find('.s-item__title span[role="heading"]').text().trim() ||
        $el.find('.s-item__title').text().trim() ||
        $el.find('h3, [class*="title"]').first().text().trim();

      title = title.replace(/Opens in a new window or tab/gi, '').replace(/^Nouveau listing\s*/i, '').trim();
      if (!title || title.toLowerCase() === 'shop on ebay' || title.toLowerCase().includes('error page') || title.length < 5) return;

      // Extraction du prix : capturer le prix de vente final
      const priceText = $el.find('.s-item__price .POSITIVE, .s-item__price, [class*="price"]').first().text().trim();
      const price = parseCADPrice(priceText);
      if (!price || price < 10) return;

      // Extraction de la URL
      const link = $el.find('a.s-item__link, a[href*="/itm/"]').first().attr('href') || '';
      if (!link || (!link.includes('/itm/') && !link.includes('ebay.ca/itm'))) return;
      const cleanUrl = cleanProductUrl(link, link);

      // Date de vente
      const dateText = $el.find('.s-item__ended-date, .s-item__endedDate, .POSITIVE, .s-item__caption--signal').first().text().trim();
      const date = dateText || new Date().toISOString().split('T')[0];

      const isOutlier = isOutlierTitle(title);

      idx++;
      listings.push({
        id: `ebay-completed-${idx}-${randomHex(4)}`,
        title,
        price,
        source: SOURCE,
        sourceKey: SOURCE_KEY,
        date,
        url: cleanUrl,
        included: !isOutlier,
        isOutlier,
        isSimulated: false,
        condition: $el.find('.SECONDARY_INFO, .s-item__subtitle').text().trim() || undefined,
        saleType: 'completed',
      });
    } catch {
      // Ignorer
    }
  });

  return listings;
}

async function tier1Direct(model: string, log: LogFn): Promise<ScrapedListing[] | null> {
  const { EBAY_APP_ID: appId } = getCredentials();
  if (appId) {
    log(`🌐 [${SOURCE_KEY}] Tier 1: Utilisation de l'API eBay certifiée (AppID: ${appId.slice(0, 8)}...)...`);
    try {
      const apiUrl = `https://svcs.ebay.com/services/search/FindingService/v1?OPERATION-NAME=findCompletedItems&SERVICE-VERSION=1.13.0&SECURITY-APPNAME=${appId}&RESPONSE-DATA-FORMAT=JSON&REST-PAYLOAD&keywords=${encodeURIComponent(model)}&itemFilter(0).name=SoldItemsOnly&itemFilter(0).value=true&paginationInput.entriesPerPage=60`;
      const apiResp = await gotScraping({
        url: apiUrl,
        headers: { 'X-EBAY-SOA-GLOBAL-ID': 'EBAY-ENCA' },
        timeout: { request: 15000 }
      });
      if (apiResp.statusCode === 200) {
        const apiJson = JSON.parse(apiResp.body) as any;
        const items = apiJson?.findCompletedItemsResponse?.[0]?.searchResult?.[0]?.item || [];
        if (Array.isArray(items) && items.length > 0) {
          const listings: ScrapedListing[] = [];
          let idx = 0;
          for (const item of items) {
            const title = item.title?.[0] || '';
            const priceVal = parseFloat(item.sellingStatus?.[0]?.currentPrice?.[0]?.['__value__']);
            const itemUrl = item.viewItemURL?.[0] || '';
            if (!title || isNaN(priceVal) || priceVal < 15 || !itemUrl) continue;
            const isOutlier = isOutlierTitle(title);
            idx++;
            listings.push({
              id: `ebay-completed-api-${idx}-${randomHex(4)}`,
              title,
              price: Math.round(priceVal * 100) / 100,
              source: SOURCE,
              sourceKey: SOURCE_KEY,
              date: item.listingInfo?.[0]?.endTime?.[0] || new Date().toISOString(),
              url: cleanProductUrl(itemUrl, itemUrl),
              included: !isOutlier,
              isOutlier,
              isSimulated: false,
              saleType: 'completed'
            });
          }
          if (listings.length > 0) {
            log(`✔️ [${SOURCE_KEY}] Tier 1: ${listings.length} ventes via l'API eBay`);
            return listings;
          }
        }
      }
    } catch {
      log(`⚠️ [${SOURCE_KEY}] Tier 1 API échoué, bascule en scraping direct HTML...`);
    }
  }

  const url = buildSearchUrl(model);
  log(`🌐 [${SOURCE_KEY}] Tier 1: Scraping direct eBay complétées HTML (Stealth got-scraping)...`);
  try {
    let listings: ScrapedListing[] = [];

    // Tentative 1 : got-scraping (rapide)
    try {
      const resp = await gotScraping({
        url,
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'fr-CA,fr;q=0.9,en-CA;q=0.8,en;q=0.7',
        },
        timeout: { request: 15000 },
      });

      if (resp.statusCode === 200) {
        const $ = cheerio.load(resp.body);
        listings = parseHtmlListings($);
      }
    } catch {
      // Ignorer, on tente Playwright en secours
    }

    // Tentative 2 : Playwright Stealth (si 0 produit trouvé)
    if (listings.length === 0) {
      log(`🔎 [${SOURCE_KEY}] Tier 1 Alt: Aucun résultat direct, tentative avec Playwright Stealth...`);
      try {
        const html = await scrapeHtmlStealth(url);
        const $ = cheerio.load(html);
        listings = parseHtmlListings($);
      } catch (err) {
        log(`⚠️ [${SOURCE_KEY}] Tier 1 Alt Playwright échoué: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (listings.length > 0) {
      log(`✔️ [${SOURCE_KEY}] Tier 1: ${listings.length} ventes complétées trouvées`);
      return listings;
    }

    log(`⚠️ [${SOURCE_KEY}] Tier 1: DOM HTML bloqué ou vide, bascule en Tier 2 Jina Bridge...`);
    return null;
  } catch (err) {
    log(`⚠️ [${SOURCE_KEY}] Tier 1 échoué: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

async function tier2RSS(model: string, log: LogFn): Promise<ScrapedListing[] | null> {
  log(`📡 [${SOURCE_KEY}] Tier 2: Extraction via flux RSS direct eBay...`);
  const rssUrl = `https://www.ebay.ca/sch/i.html?_nkw=${encodeURIComponent(model)}&LH_Sold=1&LH_Complete=1&_rss=1`;
  try {
    const resp = await gotScraping({
      url: rssUrl,
      headers: {
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
      timeout: { request: 15000 }
    });

    if (resp.statusCode === 200) {
      const $ = cheerio.load(resp.body, { xmlMode: true });
      const listings: ScrapedListing[] = [];
      let idx = 0;

      $('item').each((_i, el) => {
        try {
          const $item = $(el);
          const title = $item.find('title').text().trim();
          if (!title || title.toLowerCase() === 'shop on ebay' || title.length < 5) return;

          const link = $item.find('link').text().trim() || $item.find('guid').text().trim();
          if (!link || !link.includes('/itm/')) return;

          const description = $item.find('description').text().trim();
          const priceMatch = description.match(/(?:C\s*\$|CA\$|CDN\$|\$)\s*(\d[\d,]*\.?\d*)/i);
          const price = priceMatch ? parseCADPrice(priceMatch[1]) : null;
          if (!price || price < 15) return;

          const cleanUrl = cleanProductUrl(link, link);
          const isOutlier = isOutlierTitle(title);

          idx++;
          listings.push({
            id: `ebay-completed-rss-${idx}-${randomHex(4)}`,
            title,
            price,
            source: SOURCE,
            sourceKey: SOURCE_KEY,
            date: new Date().toISOString().split('T')[0],
            url: cleanUrl,
            included: !isOutlier,
            isOutlier,
            isSimulated: false,
            saleType: 'completed',
          });
        } catch {
          // Ignorer
        }
      });

      if (listings.length > 0) {
        log(`✔️ [${SOURCE_KEY}] Tier 2: ${listings.length} ventes complétées trouvées via RSS`);
        return listings;
      }
    }

    log(`⚠️ [${SOURCE_KEY}] Tier 2 RSS: Aucun résultat`);
    return null;
  } catch (err) {
    log(`⚠️ [${SOURCE_KEY}] Tier 2 RSS échoué: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

async function tier2JinaAndRSS(model: string, log: LogFn): Promise<ScrapedListing[] | null> {
  log(`📡 [${SOURCE_KEY}] Tier 2: Extraction via pont Jina AI / Markdown exact...`);
  const searchUrl = buildSearchUrl(model);
  const jinaUrl = `https://r.jina.ai/${encodeURIComponent(searchUrl)}`;
  try {
    const creds = getCredentials();
    const headers: Record<string, string> = {
      'X-Timeout': '40',
    };

    if (creds.JINA_API_KEY && creds.JINA_API_KEY.trim() !== '') {
      headers['Authorization'] = `Bearer ${creds.JINA_API_KEY.trim()}`;
    }

    let resp = await gotScraping({
      url: jinaUrl,
      headers,
      timeout: { request: 45000 }
    });

    if (resp.statusCode === 402 || resp.statusCode === 429) {
      log(`⏳ [${SOURCE_KEY}] Jina a renvoyé ${resp.statusCode} (Limite de taux dépassée). Retrying in 3s...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
      resp = await gotScraping({
        url: jinaUrl,
        headers,
        timeout: { request: 45000 }
      });
    }

    if (resp.statusCode === 200) {
      const md = resp.body;
      const lines = md.split('\n');
      const listings: ScrapedListing[] = [];
      let idx = 0;

      for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        const linkMatch = l.match(/\[([^\]]+)\]\((https?:\/\/[^\s)]*ebay\.(?:ca|com)\/itm\/[^\s)]+)\)/i);
        if (linkMatch) {
          const rawTitle = linkMatch[1].replace(/Opens in a new window or tab/gi, '').trim();
          if (!rawTitle || rawTitle.toLowerCase() === 'shop on ebay' || rawTitle.toLowerCase().includes('error page')) continue;
          const rawUrl = linkMatch[2];
          const context = (l + ' ' + (lines[i+1]||'') + ' ' + (lines[i+2]||''));
          const priceMatch = context.match(/(?:C\s*\$|CA\$|CDN\$|\$)\s*(\d[\d,]*\.?\d*)/i);
          const dateMatch = context.match(/Sold\s+([0-9]{1,2}\s+[A-Za-z]+\s+[0-9]{4})/i);
          if (priceMatch && priceMatch[1]) {
            const price = parseCADPrice(priceMatch[0]);
            if (price && price >= 15) {
              idx++;
              const cleanUrl = cleanProductUrl(rawUrl, rawUrl);
              const isOutlier = isOutlierTitle(rawTitle);
              listings.push({
                id: `ebay-completed-jina-${idx}-${randomHex(4)}`,
                title: rawTitle,
                price,
                source: SOURCE,
                sourceKey: SOURCE_KEY,
                date: dateMatch ? dateMatch[1] : new Date().toISOString().split('T')[0],
                url: cleanUrl,
                included: !isOutlier,
                isOutlier,
                isSimulated: false,
                saleType: 'completed'
              });
            }
          }
        }
      }

      if (listings.length > 0) {
        log(`✔️ [${SOURCE_KEY}] Tier 2: ${listings.length} ventes complétées exactes extraites par Jina Bridge`);
        return listings;
      }
    }
  } catch (err) {
    log(`⚠️ [${SOURCE_KEY}] Tier 2 Jina échoué (${err instanceof Error ? err.message : String(err)}), tentative RSS...`);
  }

  // Fallback RSS feed
  const rssUrl = buildSearchUrl(model) + '&_rss=1';
  try {
    const resp = await gotScraping({
      url: rssUrl,
      timeout: { request: 15000 },
    });

    if (resp.statusCode === 200) {
      const xml = resp.body;
      const $ = cheerio.load(xml, { xmlMode: true });
      const listings: ScrapedListing[] = [];
      let idx = 0;

      $('item').each((_i, el) => {
        try {
          const $item = $(el);
          const title = $item.find('title').text().trim();
          if (!title) return;
          const desc = $item.find('description').text() || '';
          const priceMatch = desc.match(/(?:C\s*\$|CA\$|CDN\$)?\s*(\d[\d,]*\.?\d*)/i);
          const price = priceMatch ? parseCADPrice(priceMatch[0]) : null;
          if (!price || price < 15) return;
          const link = $item.find('link').text().trim() || '';
          const pubDate = $item.find('pubDate').text().trim();
          const isOutlier = isOutlierTitle(title);
          idx++;
          listings.push({
            id: `ebay-completed-rss-${idx}-${randomHex(4)}`,
            title,
            price,
            source: SOURCE,
            sourceKey: SOURCE_KEY,
            date: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
            url: cleanProductUrl(link, link),
            included: !isOutlier,
            isOutlier,
            isSimulated: false,
            saleType: 'completed',
          });
        } catch {
          // Ignorer
        }
      });

      if (listings.length > 0) {
        log(`✔️ [${SOURCE_KEY}] Tier 2: ${listings.length} ventes via RSS`);
        return listings;
      }
    }
  } catch {
    // Ignorer RSS
  }

  return null;
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

const ebayCompletedScraper: ScraperModule = {
  name: SOURCE,
  sourceKey: SOURCE_KEY,

  async scrape(model: string, log: LogFn): Promise<ScraperResult> {
    const timestamp = new Date().toISOString();

    try {
      // Tier 1: Scraping direct / API
      const directListings = await tier1Direct(model, log);
      if (directListings && directListings.length > 0) {
        saveToCache(SOURCE_KEY, model, directListings);
        return {
          listings: directListings,
          source: SOURCE,
          sourceKey: SOURCE_KEY,
          method: 'direct',
          timestamp,
          success: true,
        };
      }

      // Tier 2: RSS Direct
      const tier2Listings = await tier2RSS(model, log);
      if (tier2Listings && tier2Listings.length > 0) {
        saveToCache(SOURCE_KEY, model, tier2Listings);
        return {
          listings: tier2Listings,
          source: SOURCE,
          sourceKey: SOURCE_KEY,
          method: 'rss',
          timestamp,
          success: true,
        };
      }

      // Tier 3: Cache
      const cachedListings = tier3Cache(model, log);
      if (cachedListings && cachedListings.length > 0) {
        return {
          listings: cachedListings,
          source: SOURCE,
          sourceKey: SOURCE_KEY,
          method: 'cache',
          timestamp,
          success: true,
        };
      }

      return {
        listings: [],
        source: SOURCE,
        sourceKey: SOURCE_KEY,
        method: 'cache',
        timestamp,
        success: false,
        error: 'Aucune donnée disponible',
      };
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

export default ebayCompletedScraper;
