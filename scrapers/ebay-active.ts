// ─── eBay Annonces Actives — État instantané du marché ───

import * as cheerio from 'cheerio';
import { gotScraping } from 'got-scraping';
import { scrapeHtmlStealth } from './browser-emulator.ts';
import type { ScraperModule, ScrapedListing, ScraperResult, LogFn } from './types.ts';
import { saveToCache, loadFromCache } from './cache.ts';
import { getCredentials } from './credentials.ts';
import { parseCADPrice, cleanProductUrl } from './utils.ts';
import { getExchangeRates } from './exchange-rate.ts';
import { randomHex, isOutlierTitle } from './shared.ts';

const SOURCE = 'eBay (Annonces actives)';
const SOURCE_KEY = 'ebay-active';

function buildSearchUrl(model: string): string {
  return `https://www.ebay.ca/sch/i.html?_nkw=${encodeURIComponent(model)}&_sacat=0&_ipg=60`;
}

function parseHtmlListings($: cheerio.CheerioAPI, isUsd = false, usdRate = 1.42): ScrapedListing[] {
  const listings: ScrapedListing[] = [];
  const seenUrls = new Set<string>();
  let idx = 0;

  $('.s-card, .su-card-container, .srp-results .s-item, .s-item__wrapper, .s-item, li[id^="item"]').each((_i, el) => {
    try {
      const $el = $(el);
      
      // Extraction du lien produit
      const link = $el.find('a[href*="/itm/"]').first().attr('href') ||
                   $el.find('a.s-item__link, a.s-card__link').first().attr('href') || '';
      if (!link || link.includes('item123456') || !link.includes('/itm/')) return;
      const cleanUrl = cleanProductUrl(link, link);
      if (seenUrls.has(cleanUrl)) return;

      // Extraction du titre
      let title = $el.find('[class*="title"], h3, h2, .s-item__title span[role="heading"]').first().text().trim() ||
        $el.find('a[href*="/itm/"]').first().text().trim();

      title = title.replace(/Opens in a new window or tab/gi, '')
                   .replace(/Pre-Owned/gi, '')
                   .replace(/Brand New/gi, '')
                   .replace(/^Nouveau listing\s*/i, '').trim();
      if (!title || title.toLowerCase() === 'shop on ebay' || title.toLowerCase().includes('error page') || title.length < 5) return;

      // Extraction du prix
      const priceText = $el.find('[class*="price"], .s-item__price').first().text().trim();
      let price = parseCADPrice(priceText);
      if (!price || price < 10) return;

      if (isUsd && !priceText.includes('C $') && !priceText.includes('CA $') && !priceText.includes('CDN $')) {
        price = Math.round(price * usdRate * 100) / 100;
      }

      seenUrls.add(cleanUrl);
      const condition = $el.find('.SECONDARY_INFO, .s-item__subtitle').text().trim();
      const isOutlier = isOutlierTitle(title);

      idx++;
      listings.push({
        id: `ebay-active-${idx}-${randomHex(4)}`,
        title,
        price,
        source: SOURCE,
        sourceKey: SOURCE_KEY,
        date: new Date().toISOString().split('T')[0],
        url: cleanUrl,
        included: !isOutlier,
        isOutlier,
        isSimulated: false,
        condition: condition || undefined,
        saleType: 'active',
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
    log(`🌐 [${SOURCE_KEY}] Tier 1: Utilisation de l'API eBay actives (AppID: ${appId.slice(0, 8)}...)...`);
    try {
      const apiUrl = `https://svcs.ebay.com/services/search/FindingService/v1?OPERATION-NAME=findItemsAdvanced&SERVICE-VERSION=1.13.0&SECURITY-APPNAME=${appId}&RESPONSE-DATA-FORMAT=JSON&REST-PAYLOAD&keywords=${encodeURIComponent(model)}&itemFilter(0).name=ListingType&itemFilter(0).value(0)=FixedPrice&itemFilter(0).value(1)=AuctionWithBIN&paginationInput.entriesPerPage=60`;
      const apiResp = await gotScraping({
        url: apiUrl,
        headers: { 'X-EBAY-SOA-GLOBAL-ID': 'EBAY-ENCA' },
        timeout: { request: 15000 }
      });
      if (apiResp.statusCode === 200) {
        const apiJson = JSON.parse(apiResp.body) as any;
        const items = apiJson?.findItemsAdvancedResponse?.[0]?.searchResult?.[0]?.item || [];
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
              id: `ebay-active-api-${idx}-${randomHex(4)}`,
              title,
              price: Math.round(priceVal * 100) / 100,
              source: SOURCE,
              sourceKey: SOURCE_KEY,
              date: new Date().toISOString().split('T')[0],
              url: cleanProductUrl(itemUrl, itemUrl),
              included: !isOutlier,
              isOutlier,
              isSimulated: false,
              saleType: 'fixed'
            });
          }
          if (listings.length > 0) {
            log(`✔️ [${SOURCE_KEY}] Tier 1: ${listings.length} annonces via l'API eBay`);
            return listings;
          }
        }
      }
    } catch {
      log(`⚠️ [${SOURCE_KEY}] Tier 1 API actives échoué, bascule en scraping direct HTML...`);
    }
  }

  const url = buildSearchUrl(model);
  log(`🌐 [${SOURCE_KEY}] Tier 1: Scraping direct eBay actives HTML (Stealth got-scraping)...`);
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
        timeout: { request: 6000 },
      });

      if (resp.statusCode === 200) {
        const $ = cheerio.load(resp.body);
        const pageTitle = $('title').text().trim().toLowerCase();
        if (!pageTitle.includes('pardon our interruption') && !pageTitle.includes('error page')) {
          listings = parseHtmlListings($);
        }
      }
    } catch {
      // Ignorer, on tente Playwright en secours
    }

    // Tentative 2 : Playwright Stealth (si 0 produit trouvé)
    if (listings.length === 0) {
      log(`🔎 [${SOURCE_KEY}] Tier 1 Alt: Tentative Playwright Stealth sur ebay.ca...`);
      try {
        const html = await scrapeHtmlStealth(url);
        const $ = cheerio.load(html);
        const pageTitle = $('title').text().trim().toLowerCase();
        if (!pageTitle.includes('pardon our interruption') && !pageTitle.includes('error page')) {
          listings = parseHtmlListings($);
        } else {
          log(`⚠️ [${SOURCE_KEY}] ebay.ca protégé par Akamai Bot Manager ("${$('title').text().trim()}").`);
        }
      } catch (err) {
        log(`⚠️ [${SOURCE_KEY}] Tier 1 Alt Playwright échoué: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Tentative 3 : Fallback vers catalogue étendu ebay.com si ebay.ca est restreint
    if (listings.length === 0) {
      log(`🔎 [${SOURCE_KEY}] Tier 1 Alt: ebay.ca restreint, tentative via catalogue étendu ebay.com...`);
      try {
        const rates = await getExchangeRates();
        const usdRate = rates['USD'] ?? 1.42;
        const fallbackUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(model)}&_sacat=0&_ipg=60`;
        const html = await scrapeHtmlStealth(fallbackUrl);
        const $ = cheerio.load(html);
        const pageTitle = $('title').text().trim().toLowerCase();
        if (!pageTitle.includes('pardon our interruption') && !pageTitle.includes('error page')) {
          listings = parseHtmlListings($, true, usdRate);
        } else {
          log(`⚠️ [${SOURCE_KEY}] ebay.com également protégé par Akamai Bot Manager ("${$('title').text().trim()}").`);
        }
      } catch (err) {
        log(`⚠️ [${SOURCE_KEY}] Tier 1 Alt ebay.com échoué: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (listings.length > 0) {
      log(`✔️ [${SOURCE_KEY}] Tier 1: ${listings.length} annonces actives trouvées`);
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
  const rssUrl = `https://www.ebay.ca/sch/i.html?_nkw=${encodeURIComponent(model)}&_rss=1`;
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
            id: `ebay-active-rss-${idx}-${randomHex(4)}`,
            title,
            price,
            source: SOURCE,
            sourceKey: SOURCE_KEY,
            date: new Date().toISOString().split('T')[0],
            url: cleanUrl,
            included: !isOutlier,
            isOutlier,
            isSimulated: false,
            saleType: 'active',
          });
        } catch {
          // Ignorer
        }
      });

      if (listings.length > 0) {
        log(`✔️ [${SOURCE_KEY}] Tier 2: ${listings.length} annonces actives trouvées via RSS`);
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
      timeout: { request: 10000 }
    });

    if (resp.statusCode === 402 || resp.statusCode === 429) {
      log(`⏳ [${SOURCE_KEY}] Jina a renvoyé ${resp.statusCode} (Limite de taux dépassée).`);
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
          if (priceMatch && priceMatch[1]) {
            const price = parseCADPrice(priceMatch[0]);
            if (price && price >= 15) {
              idx++;
              const cleanUrl = cleanProductUrl(rawUrl, rawUrl);
              const isOutlier = isOutlierTitle(rawTitle);
              listings.push({
                id: `ebay-active-jina-${idx}-${randomHex(4)}`,
                title: rawTitle,
                price,
                source: SOURCE,
                sourceKey: SOURCE_KEY,
                date: new Date().toISOString().split('T')[0],
                url: cleanUrl,
                included: !isOutlier,
                isOutlier,
                isSimulated: false,
                saleType: 'active'
              });
            }
          }
        }
      }

      if (listings.length > 0) {
        log(`✔️ [${SOURCE_KEY}] Tier 2: ${listings.length} annonces actives exactes extraites par Jina Bridge`);
        return listings;
      }
    }
  } catch (err) {
    log(`⚠️ [${SOURCE_KEY}] Tier 2 Jina échoué (${err instanceof Error ? err.message : String(err)}), tentative RSS...`);
  }

  // Fallback RSS
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
            id: `ebay-active-rss-${idx}-${randomHex(4)}`,
            title,
            price,
            source: SOURCE,
            sourceKey: SOURCE_KEY,
            date: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
            url: cleanProductUrl(link, link),
            included: !isOutlier,
            isOutlier,
            isSimulated: false,
            saleType: 'active',
          });
        } catch {
          // Ignorer
        }
      });

      if (listings.length > 0) {
        log(`✔️ [${SOURCE_KEY}] Tier 2: ${listings.length} annonces via RSS`);
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

const ebayActiveScraper: ScraperModule = {
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

      // Tier 2: Jina Bridge & RSS
      const tier2Listings = await tier2JinaAndRSS(model, log);
      if (tier2Listings && tier2Listings.length > 0) {
        saveToCache(SOURCE_KEY, model, tier2Listings);
        return {
          listings: tier2Listings,
          source: SOURCE,
          sourceKey: SOURCE_KEY,
          method: 'api',
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

export default ebayActiveScraper;
