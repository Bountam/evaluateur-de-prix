// ─── Back Market Canada — Reconditionné certifié haut de gamme ───

import * as cheerio from 'cheerio';
import { gotScraping } from 'got-scraping';
import { scrapeHtmlStealth } from './browser-emulator.ts';
import type { ScraperModule, ScrapedListing, ScraperResult, LogFn } from './types.ts';
import { saveToCache, loadFromCache } from './cache.ts';
import { getCredentials } from './credentials.ts';
import { parseCADPrice, cleanProductUrl } from './utils.ts';
import { getExchangeRates, convertToCAD } from './exchange-rate.ts';
import { randomHex } from './shared.ts';

const SOURCE = 'Back Market Canada';
const SOURCE_KEY = 'backmarket';

function buildSearchUrl(model: string): string {
  return `https://www.backmarket.com/en-us/search?q=${encodeURIComponent(model)}`;
}

async function tier1Direct(model: string, log: LogFn): Promise<ScrapedListing[] | null> {
  const url = buildSearchUrl(model);
  log(`🌐 [${SOURCE_KEY}] Tier 1: Scraping direct Back Market via Playwright Stealth...`);
  try {
    const html = await scrapeHtmlStealth(url);
    const $ = cheerio.load(html);
    const listings: ScrapedListing[] = [];
    let idx = 0;

    // Pré-charger le taux USD→CAD une seule fois (async) avant le callback .each() synchrone
    const rates = await getExchangeRates();
    const usdRate = rates['USD'] ?? 1.37;

    // Chercher les liens produit Back Market
    $('a[href*="/en-us/p/"]').each((_i, el) => {
      try {
        const $link = $(el);
        const href = $link.attr('href') || '';
        if (!href || href.includes('/search') || !href.includes('/p/')) return;
        const fullUrl = cleanProductUrl(href, `https://www.backmarket.com${href}`);

        // Remonter au parent pour trouver titre et prix
        const $container = $link.closest('[data-test], [class*="product"], [class*="card"], article, li');
        const $search = $container.length > 0 ? $container : $link.parent().parent();

        const title = $link.text().trim() ||
          $search.find('h2, h3, [class*="title"], [data-test*="title"]').first().text().trim() ||
          $link.find('span').first().text().trim();

        if (!title || title.length < 5) return;

        const priceText = $search.find('[data-test*="price"], [class*="price"], [class*="Price"]').first().text().trim() ||
          $search.text().match(/(\d{2,4}[.,]\d{2}\s*\$|\$\s*\d{2,4}[.,]\d{2})/)?.[0] || '';

        const rawPrice = parseCADPrice(priceText);
        if (!rawPrice || rawPrice < 15) return;

        // Conversion synchrone via le taux pré-chargé (USD → CAD)
        const price = Math.round(rawPrice * usdRate * 100) / 100;

        idx++;
        listings.push({
          id: `backmarket-${idx}-${randomHex(4)}`,
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
          currency: 'USD',
          exchangeRate: usdRate,
        });
      } catch {
        // Ignorer
      }
    });

    // Si on a rien trouvé dans le DOM direct, tenter d'extraire __NEXT_DATA__ depuis ce même HTML stealth
    if (listings.length === 0) {
      log(`🔎 [${SOURCE_KEY}] Tier 1: DOM direct vide, recherche de données JSON embarquées (__NEXT_DATA__)...`);
      const nextDataScript = $('#__NEXT_DATA__').html();
      if (nextDataScript) {
        try {
          const data = JSON.parse(nextDataScript);
          const products = data?.props?.pageProps?.products ||
            data?.props?.pageProps?.initialProducts ||
            data?.props?.pageProps?.searchResults?.products || [];

          for (const p of products) {
            const title = p.title || p.name || p.shortTitle || '';
            const rawPrice = typeof p.price === 'number' ? p.price :
              parseCADPrice(String(p.price?.amount || p.price?.value || p.minPrice || ''));
            if (!title || !rawPrice || rawPrice < 15) continue;

            // Détecter la devise depuis la structure JSON
            const priceCurrency = (p.price?.currency || p.currency || 'USD') as string;
            const isCAD = priceCurrency.toUpperCase() === 'CAD';
            const converted = await convertToCAD(rawPrice, isCAD ? 'CAD' : priceCurrency);
            const price = converted.cadAmount;

            // Prix original (compare_at_price ou comparePrice) si disponible
            const rawCompare = p.compareAtPrice ?? p.compare_at_price ?? p.originalPrice;
            const compareConverted = rawCompare ? await convertToCAD(
              typeof rawCompare === 'number' ? rawCompare : parseCADPrice(String(rawCompare)) || rawPrice,
              isCAD ? 'CAD' : priceCurrency,
            ) : null;

            let productUrl = '';
            if (p.url && typeof p.url === 'string' && p.url.startsWith('http')) {
              productUrl = cleanProductUrl(p.url, p.url);
            } else if (p.slug) {
              productUrl = `https://www.backmarket.com/en-us/p/${p.slug}`;
            }
            if (!productUrl || productUrl.includes('/search')) continue;

            const discountAmt = compareConverted && compareConverted.cadAmount > price
              ? Math.round((compareConverted.cadAmount - price) * 100) / 100
              : undefined;
            const discountPct = discountAmt && compareConverted
              ? Math.round((discountAmt / compareConverted.cadAmount) * 1000) / 10
              : undefined;

            idx++;
            listings.push({
              id: `backmarket-next-${idx}-${randomHex(4)}`,
              title,
              price,
              source: SOURCE,
              sourceKey: SOURCE_KEY,
              date: new Date().toISOString(),
              url: productUrl,
              included: true,
              isOutlier: false,
              isSimulated: false,
              condition: p.condition || p.grade || 'Reconditionné',
              saleType: 'fixed',
              currency: isCAD ? undefined : priceCurrency,
              exchangeRate: isCAD ? undefined : converted.rate,
              originalPrice: compareConverted?.cadAmount,
              discountAmount: discountAmt,
              discountPercent: discountPct,
            });
          }
        } catch {
          // Ignorer
        }
      }
    }

    if (listings.length === 0) {
      log(`⚠️ [${SOURCE_KEY}] Tier 1: Aucun produit trouvé avec Playwright Stealth`);
      return null;
    }

    log(`✔️ [${SOURCE_KEY}] Tier 1: ${listings.length} produits trouvés`);
    return listings;
  } catch (err) {
    log(`⚠️ [${SOURCE_KEY}] Tier 1 Playwright échoué: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

async function tier2NextData(model: string, log: LogFn): Promise<ScrapedListing[] | null> {
  const url = buildSearchUrl(model);
  log(`📡 [${SOURCE_KEY}] Tier 2: Extraction données embarquées (got-scraping)...`);
  try {
    // Pré-charger les taux avant les boucles (impossible d'utiliser await dans .each())
    const rates = await getExchangeRates();
    const resp = await gotScraping({
      url,
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr-CA,fr;q=0.9,en-CA;q=0.8',
      },
      timeout: { request: 20000 },
    });

    if (resp.statusCode !== 200) {
      log(`⚠️ [${SOURCE_KEY}] Tier 2: HTTP ${resp.statusCode}`);
      return null;
    }

    const html = resp.body;
    const $ = cheerio.load(html);
    const listings: ScrapedListing[] = [];
    let idx = 0;

    // Tenter __NEXT_DATA__
    const nextDataScript = $('#__NEXT_DATA__').html();
    if (nextDataScript) {
      try {
        const data = JSON.parse(nextDataScript);
        const products = data?.props?.pageProps?.products ||
          data?.props?.pageProps?.initialProducts ||
          data?.props?.pageProps?.searchResults?.products || [];

        for (const p of products) {
          const title = p.title || p.name || p.shortTitle || '';
          const rawPrice = typeof p.price === 'number' ? p.price :
            parseCADPrice(String(p.price?.amount || p.price?.value || p.minPrice || ''));
          if (!title || !rawPrice || rawPrice < 15) continue;

          const priceCurrency = (p.price?.currency || p.currency || 'USD') as string;
          const isCAD = priceCurrency.toUpperCase() === 'CAD';
          // Conversion synchrone via taux pré-chargé
          const rate = isCAD ? 1 : (rates[priceCurrency.toUpperCase()] ?? rates['USD'] ?? 1.37);
          const price = isCAD ? rawPrice : Math.round(rawPrice * rate * 100) / 100;

          let productUrl = '';
          if (p.url && typeof p.url === 'string' && p.url.startsWith('http')) {
            productUrl = cleanProductUrl(p.url, p.url);
          } else if (p.slug) {
            productUrl = `https://www.backmarket.com/en-us/p/${p.slug}`;
          }
          if (!productUrl || productUrl.includes('/search')) continue;

          idx++;
          listings.push({
            id: `backmarket-${idx}-${randomHex(4)}`,
            title,
            price,
            source: SOURCE,
            sourceKey: SOURCE_KEY,
            date: new Date().toISOString(),
            url: productUrl,
            included: true,
            isOutlier: false,
            isSimulated: false,
            condition: p.condition || p.grade || 'Reconditionné',
            saleType: 'fixed',
            currency: isCAD ? undefined : priceCurrency,
            exchangeRate: isCAD ? undefined : rate,
          });
        }
      } catch {
        // __NEXT_DATA__ parse failure
      }
    }

    // Tenter application/ld+json
    if (listings.length === 0) {
      $('script[type="application/ld+json"]').each((_i, el) => {
        try {
          const json = JSON.parse($(el).html() || '{}');
          const items = json['@type'] === 'ItemList' ? json.itemListElement :
            json['@type'] === 'Product' ? [json] : [];

          for (const item of items) {
            const product = item.item || item;
            if (product['@type'] !== 'Product') continue;

            const title = product.name || '';
            const priceOffer = product.offers?.price || product.offers?.lowPrice;
            const rawPrice = typeof priceOffer === 'number' ? priceOffer : parseCADPrice(String(priceOffer || ''));
            if (!title || !rawPrice || rawPrice < 15) continue;

            const offerCurrency = product.offers?.priceCurrency || 'USD';
            const isCAD = offerCurrency.toUpperCase() === 'CAD';
            // Conversion synchrone via taux pré-chargé (callback .each() ne supporte pas await)
            const rate = isCAD ? 1 : (rates[offerCurrency.toUpperCase()] ?? rates['USD'] ?? 1.37);
            const price = isCAD ? rawPrice : Math.round(rawPrice * rate * 100) / 100;

            const productUrl = typeof product.url === 'string' && product.url.startsWith('http') ? cleanProductUrl(product.url, product.url) : (product.offers?.url ? cleanProductUrl(product.offers.url, `https://www.backmarket.com${product.offers.url}`) : '');
            if (!productUrl || productUrl.includes('/search')) continue;

            idx++;
            listings.push({
              id: `backmarket-${idx}-${randomHex(4)}`,
              title,
              price,
              source: SOURCE,
              sourceKey: SOURCE_KEY,
              date: new Date().toISOString(),
              url: productUrl,
              included: true,
              isOutlier: false,
              isSimulated: false,
              condition: product.itemCondition?.replace('https://schema.org/', '') || 'Reconditionné',
              saleType: 'fixed',
              currency: isCAD ? undefined : offerCurrency,
              exchangeRate: isCAD ? undefined : rate,
            });
          }
        } catch {
          // Ignorer bloc JSON invalide
        }
      });
    }

    if (listings.length === 0) {
      log(`⚠️ [${SOURCE_KEY}] Tier 2: Aucune donnée embarquée trouvée`);
      return null;
    }

    log(`✔️ [${SOURCE_KEY}] Tier 2: ${listings.length} produits via données embarquées`);
    return listings;
  } catch (err) {
    log(`⚠️ [${SOURCE_KEY}] Tier 2 échoué: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

async function tier2Jina(model: string, log: LogFn): Promise<ScrapedListing[] | null> {
  const searchUrl = buildSearchUrl(model);
  const jinaUrl = `https://r.jina.ai/${encodeURIComponent(searchUrl)}`;

  log(`📡 [${SOURCE_KEY}] Tier 2.5: Extraction via pont Jina AI (anti-bot got-scraping)...`);
  try {
    const creds = getCredentials();
    const headers: Record<string, string> = {
      'X-Timeout': '40',
      'X-No-Cache': 'true',
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

    if (resp.statusCode !== 200) {
      log(`⚠️ [${SOURCE_KEY}] Tier 2.5: Jina HTTP ${resp.statusCode}`);
      return null;
    }

    const md = resp.body;
    const lines = md.split('\n');
    const listings: ScrapedListing[] = [];
    let idx = 0;

    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      const linkMatch = l.match(/\[([^\]]+)\]\((https?:\/\/[^\s)]*backmarket\.(?:ca|com)\/(?:fr-ca|en-us)\/p\/[^\s)]+)\)/i);
      if (linkMatch) {
        const title = linkMatch[1].trim();
        if (!title || title.length < 5) continue;
        const url = cleanProductUrl(linkMatch[2], linkMatch[2]);

        // Scan the next 12 lines for a price ($XXX.XX or XXX.XX$)
        let rawPrice = 0;
        for (let j = 1; j <= 12; j++) {
          const nextLine = lines[i + j];
          if (nextLine === undefined) break;
          // If we hit another product link, stop scanning
          if (nextLine.startsWith('### [') && nextLine.includes('/p/')) {
            break;
          }
          const priceMatch = nextLine.match(/\$\s*(\d{2,4}(?:[.,]\d{2})?)/i) || 
                             nextLine.match(/(\d{2,4}(?:[.,]\d{2})?)\s*\$/i);
          if (priceMatch) {
            const rawVal = priceMatch[1].replace(',', '.');
            const val = parseFloat(rawVal);
            if (val && val >= 15 && val < 5000) {
              rawPrice = val;
              break;
            }
          }
        }

        if (rawPrice > 0) {
          // Si l'URL est /en-us/, le prix est en USD → conversion dynamique
          const isUSD = linkMatch[2].includes('/en-us/');
          const converted = isUSD ? await convertToCAD(rawPrice, 'USD') : { cadAmount: rawPrice, rate: 1 };
          const price = converted.cadAmount;

          idx++;
          listings.push({
            id: `backmarket-jina-${idx}-${randomHex(4)}`,
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
            currency: isUSD ? 'USD' : undefined,
            exchangeRate: isUSD ? converted.rate : undefined,
          });
        }
      }
    }

    if (listings.length === 0) {
      log(`⚠️ [${SOURCE_KEY}] Tier 2.5: Aucun produit extrait via Jina`);
      return null;
    }

    log(`✔️ [${SOURCE_KEY}] Tier 2.5: ${listings.length} produits extraits via Jina`);
    return listings;
  } catch (err) {
    log(`⚠️ [${SOURCE_KEY}] Tier 2.5 échoué: ${err instanceof Error ? err.message : String(err)}`);
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

const backmarketScraper: ScraperModule = {
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

      const embeddedListings = await tier2NextData(model, log);
      if (embeddedListings && embeddedListings.length > 0) {
        saveToCache(SOURCE_KEY, model, embeddedListings);
        return { listings: embeddedListings, source: SOURCE, sourceKey: SOURCE_KEY, method: 'json-embedded', timestamp, success: true };
      }

      const jinaListings = await tier2Jina(model, log);
      if (jinaListings && jinaListings.length > 0) {
        saveToCache(SOURCE_KEY, model, jinaListings);
        return { listings: jinaListings, source: SOURCE, sourceKey: SOURCE_KEY, method: 'api', timestamp, success: true };
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

export default backmarketScraper;
