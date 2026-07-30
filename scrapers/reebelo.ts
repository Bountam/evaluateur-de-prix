// ─── Reebelo — Reconditionnés certifiés ─────────────────────────────
// Architecture 3 niveaux de résilience :
//   Tier 1 : Scraping direct HTTP + __NEXT_DATA__ JSON embarqué
//   Tier 2 : Pont Jina AI (r.jina.ai) — contourne le WAF Cloudflare
//   Tier 3 : Cache local certifié (jamais retourner un résultat vide)
//
// Améliorations :
//   - Regex corrigée pour le format réel du Markdown Jina (CA$PRICE)
//   - Conservation du skuId dans les URLs pour pointer vers l'article précis
//   - Score de pertinence par correspondance de mots-clés du modèle recherché
//   - Filtrage des résultats hors-sujet (ratio < 0.5) afin d'avoir uniquement
//     des appareils dont le titre correspond bien au modèle demandé

import * as cheerio from 'cheerio';
import { gotScraping } from 'got-scraping';
import { scrapeHtmlStealth } from './browser-emulator.ts';
import type { ScraperModule, ScrapedListing, ScraperResult, LogFn } from './types.ts';
import { saveToCache, loadFromCache } from './cache.ts';
import { parseCADPrice } from './utils.ts';
import { getCredentials } from './credentials.ts';

const SOURCE = 'Rebeelo';
const SOURCE_KEY = 'reebelo';

function randomHex(len: number): string {
  return [...Array(len)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
}

function randomUA(): string {
  const uas = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0'
  ];
  return uas[Math.floor(Math.random() * uas.length)];
}

function buildSearchUrl(model: string): string {
  return `https://www.reebelo.ca/search?q=${encodeURIComponent(model)}`;
}

/**
 * Calcule un score de pertinence (0.0 à 1.0) entre un titre de produit et le modèle recherché.
 * Stratégie :
 *   1. Tokenise le modèle en mots-clés significatifs (≥ 2 caractères)
 *   2. Compte combien de ces mots-clés sont présents dans le titre (insensible à la casse)
 *   3. Accorde un bonus si tous les tokens numériques du modèle (ex: "3070", "G6") sont présents
 *
 * Un score ≥ 0.6 est considéré pertinent.
 */
function relevanceScore(title: string, model: string): number {
  const titleLow = title.toLowerCase();
  const tokens = model
    .toLowerCase()
    .split(/[\s\-_/]+/)
    .filter(t => t.length >= 2);

  if (tokens.length === 0) return 1;

  const matchCount = tokens.filter(t => titleLow.includes(t)).length;
  const baseScore = matchCount / tokens.length;

  // Bonus : tous les tokens numériques (ex: "3070", "g6", "600") doivent être présents
  const numericTokens = tokens.filter(t => /\d/.test(t));
  const numericMatch = numericTokens.length > 0
    ? numericTokens.every(t => titleLow.includes(t))
    : true;

  if (!numericMatch) {
    // Pénalité sévère si un token numérique clé est absent
    return baseScore * 0.4;
  }

  return baseScore;
}

/**
 * Filtre et trie les listings par pertinence décroissante.
 * Exclut les résultats avec un score < minScore.
 */
function filterAndRankByRelevance(
  listings: ScrapedListing[],
  model: string,
  minScore = 0.5,
): ScrapedListing[] {
  const scored = listings.map(l => ({
    listing: l,
    score: relevanceScore(l.title, model),
  }));

  const filtered = scored.filter(s => s.score >= minScore);

  // Trier par score décroissant
  filtered.sort((a, b) => b.score - a.score);

  return filtered.map(s => s.listing);
}

// ─── Tier 1 : Scraping direct HTTP ──────────────────────────────────────────

async function tier1Direct(model: string, log: LogFn): Promise<ScrapedListing[] | null> {
  const url = buildSearchUrl(model);
  log(`🌐 [${SOURCE_KEY}] Tier 1: Scraping direct Reebelo via Playwright Stealth...`);
  try {
    const html = await scrapeHtmlStealth(url);
    const $ = cheerio.load(html);
    const listings: ScrapedListing[] = [];
    let idx = 0;

    // Tentative de lecture du __NEXT_DATA__ JSON embarqué (Next.js)
    const nextDataRaw = $('#__NEXT_DATA__').html();
    if (nextDataRaw) {
      try {
        const data = JSON.parse(nextDataRaw);
        const products: Array<Record<string, unknown>> =
          data?.props?.pageProps?.products ||
          data?.props?.pageProps?.searchResults ||
          data?.props?.pageProps?.initialData?.products || [];

        for (const p of products) {
          const title = String(p.title || p.name || p.productName || '');
          const priceField = p.price as Record<string, unknown> | number | undefined;
          let price = typeof priceField === 'number'
            ? priceField
            : parseCADPrice(String(
                (typeof priceField === 'object' ? (priceField?.amount ?? priceField?.value) : undefined)
                ?? p.salePrice ?? p.minPrice ?? ''
              ));
          if (!title || !price) continue;

          // Convertir en dollars si le prix brut est en cents (ex: 90799)
          if (price > 1000) {
            price = Math.round((price / 100) * 100) / 100;
          }

          let productUrl = '';
          if (typeof p.url === 'string' && p.url.startsWith('http')) {
            productUrl = p.url;
          } else if (p.productSlug) {
            productUrl = `https://www.reebelo.ca/collections/${p.productSlug}`;
            if (p.id) {
              productUrl += `?skuId=${p.id}`;
            }
          } else if (p.slug) {
            productUrl = `https://www.reebelo.ca/collections/${p.slug}`;
          } else if (p.handle) {
            productUrl = `https://www.reebelo.ca/collections/${p.handle}`;
          }
          if (!productUrl || productUrl.includes('/search')) continue;

          idx++;
          listings.push({
            id: `reebelo-${idx}-${randomHex(4)}`,
            title,
            price,
            source: SOURCE,
            sourceKey: SOURCE_KEY,
            date: new Date().toISOString(),
            url: productUrl,
            included: true,
            isOutlier: false,
            isSimulated: false,
            condition: String(p.condition || p.grade || 'Reconditionné'),
            saleType: 'fixed',
          });
        }
      } catch {
        // JSON invalide, continuer
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

// ─── Tier 2 : Pont Jina AI (contournement WAF Cloudflare) ───────────────────

async function tier2Jina(model: string, log: LogFn): Promise<ScrapedListing[] | null> {
  log(`📡 [${SOURCE_KEY}] Tier 2: Extraction via pont Jina AI / Markdown (got-scraping)...`);
  // Utiliser http:// (non https://) pour éviter les redirections qui cassent le proxy Jina
  const searchUrl = `http://www.reebelo.ca/search?q=${encodeURIComponent(model)}`;
  const jinaUrl = `https://r.jina.ai/${encodeURIComponent(searchUrl)}`;

  try {
    const creds = getCredentials();
    const headers: Record<string, string> = {
      'Accept': 'text/plain,text/markdown,*/*',
      'X-Timeout': '40',
    };

    if (creds.JINA_API_KEY && creds.JINA_API_KEY.trim() !== '') {
      headers['Authorization'] = `Bearer ${creds.JINA_API_KEY.trim()}`;
    }

    let resp = await gotScraping({
      url: jinaUrl,
      headers,
      timeout: { request: 45000 },
    });

    if (resp.statusCode === 402 || resp.statusCode === 429) {
      log(`⏳ [${SOURCE_KEY}] Jina a renvoyé ${resp.statusCode} (Limite de taux dépassée). Retrying in 3s...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
      resp = await gotScraping({
        url: jinaUrl,
        headers,
        timeout: { request: 45000 },
      });
    }

    if (resp.statusCode !== 200) {
      log(`⚠️ [${SOURCE_KEY}] Tier 2: Jina a répondu HTTP ${resp.statusCode}`);
      return null;
    }

    const md = resp.body;

    // ─── Regex pour le format exact du Markdown Reebelo/Jina ─────────────────
    // Format observé : "### TITLE ### CA$PRICE](URL)"
    // L'image (alt text) précède le bloc, le titre est répété deux fois sous "###"
    // Exemple réel:
    //   "...BLA-image-0.jpg&w=3840&q=75) ### HP ProDesk 600 G6 Mini PC - ... ### CA$494.99](https://reebelo.ca/...?skuId=...)"
    //
    // Notes importantes :
    //   - Le signe $ est un caractère normal dans le Markdown (pas dans un regex JS)
    //   - Les URLs contiennent le skuId qu'il faut CONSERVER (pas cleaner)
    const regex = /###\s*([^#\n\[\]]+?)\s*###\s*CA\$([\d,. ]+)\]\((https?:\/\/[^\s)]+)\)/g;

    const listings: ScrapedListing[] = [];
    let idx = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(md)) !== null) {
      const title = match[1].trim();
      const rawPrice = match[2];
      const productUrl = match[3];

      const price = parseCADPrice(rawPrice);
      if (!title || !price || price < 15) continue;

      // Conserver l'URL complète avec le skuId (identifiant de configuration spécifique)
      // Reebelo utilise skuId pour distinguer les configurations (RAM, stockage, condition)
      const fullUrl = productUrl.startsWith('http')
        ? productUrl
        : `https://www.reebelo.ca${productUrl}`;

      idx++;
      listings.push({
        id: `reebelo-jina-${idx}-${randomHex(4)}`,
        title,
        price,
        source: SOURCE,
        sourceKey: SOURCE_KEY,
        date: new Date().toISOString(),
        url: fullUrl,
        included: true,
        isOutlier: false,
        isSimulated: false,
        condition: 'Reconditionné certifié', // Standard Reebelo — tous garantis 1 an
        saleType: 'fixed',
      });
    }

    if (listings.length === 0) {
      log(`⚠️ [${SOURCE_KEY}] Tier 2: Aucun produit extrait du Markdown Jina`);
      return null;
    }

    // ─── Filtrage et classement par pertinence ────────────────────────────────
    const relevant = filterAndRankByRelevance(listings, model, 0.5);
    const discarded = listings.length - relevant.length;

    log(`✔️ [${SOURCE_KEY}] Tier 2: ${relevant.length} produits pertinents (${discarded} non pertinents filtrés)`);
    return relevant.length > 0 ? relevant : null;

  } catch (err) {
    log(`⚠️ [${SOURCE_KEY}] Tier 2 Jina échoué: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

// ─── Tier 2 Alt : API interne Next.js ────────────────────────────────────────

async function tier2API(model: string, log: LogFn): Promise<ScrapedListing[] | null> {
  log(`📡 [${SOURCE_KEY}] Tier 2 Alt: Tentative API interne Next.js...`);
  const apiUrls = [
    `https://www.reebelo.ca/api/search?q=${encodeURIComponent(model)}`,
    `https://www.reebelo.ca/api/search?query=${encodeURIComponent(model)}`,
  ];

  for (const apiUrl of apiUrls) {
    try {
      const resp = await fetch(apiUrl, {
        headers: {
          'User-Agent': randomUA(),
          'Accept': 'application/json',
          'Accept-Language': 'en-CA,en;q=0.9',
          'X-Requested-With': 'XMLHttpRequest',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!resp.ok) continue;

      const json = await resp.json() as Record<string, unknown>;
      const products = (json.products || json.results || json.data || json.items || []) as Array<Record<string, unknown>>;
      if (!Array.isArray(products) || products.length === 0) continue;

      const listings: ScrapedListing[] = [];
      let idx = 0;

      for (const p of products) {
        const title = String(p.title || p.name || p.productName || '');
        const rawPrice = p.price || p.salePrice || p.minPrice;
        const price = typeof rawPrice === 'number' ? rawPrice : parseCADPrice(String(rawPrice || ''));
        if (!title || !price || price < 15) continue;

        let productUrl = '';
        if (typeof p.url === 'string' && p.url.startsWith('http')) {
          productUrl = p.url;
        } else if (p.slug) {
          productUrl = `https://www.reebelo.ca/collections/${p.slug}`;
        } else if (p.handle) {
          productUrl = `https://www.reebelo.ca/collections/${p.handle}`;
        }
        if (!productUrl || productUrl.includes('/search')) continue;

        idx++;
        listings.push({
          id: `reebelo-api-${idx}-${randomHex(4)}`,
          title,
          price,
          source: SOURCE,
          sourceKey: SOURCE_KEY,
          date: new Date().toISOString(),
          url: productUrl,
          included: true,
          isOutlier: false,
          isSimulated: false,
          condition: String(p.condition || p.grade || 'Reconditionné'),
          saleType: 'fixed',
        });
      }

      if (listings.length > 0) {
        const relevant = filterAndRankByRelevance(listings, model, 0.5);
        log(`✔️ [${SOURCE_KEY}] Tier 2 Alt: ${relevant.length} produits pertinents via API`);
        return relevant.length > 0 ? relevant : null;
      }
    } catch {
      // Essayer l'URL suivante
    }
  }

  log(`⚠️ [${SOURCE_KEY}] Tier 2 Alt: API interne non disponible`);
  return null;
}

// ─── Tier 3 : Cache local certifié ───────────────────────────────────────────

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

// ─── Module principal ─────────────────────────────────────────────────────────

const reebeloScraper: ScraperModule = {
  name: SOURCE,
  sourceKey: SOURCE_KEY,

  async scrape(model: string, log: LogFn): Promise<ScraperResult> {
    const timestamp = new Date().toISOString();

    try {
      // Tier 1 : Scraping direct
      const directListings = await tier1Direct(model, log);
      if (directListings && directListings.length > 0) {
        saveToCache(SOURCE_KEY, model, directListings);
        return { listings: directListings, source: SOURCE, sourceKey: SOURCE_KEY, method: 'direct', timestamp, success: true };
      }

      // Tier 2 : API interne Next.js
      const apiListings = await tier2API(model, log);
      if (apiListings && apiListings.length > 0) {
        saveToCache(SOURCE_KEY, model, apiListings);
        return { listings: apiListings, source: SOURCE, sourceKey: SOURCE_KEY, method: 'api', timestamp, success: true };
      }

      // Tier 3 : Cache local
      const cachedListings = tier3Cache(model, log);
      if (cachedListings && cachedListings.length > 0) {
        return { listings: cachedListings, source: SOURCE, sourceKey: SOURCE_KEY, method: 'cache', timestamp, success: true };
      }

      return {
        listings: [],
        source: SOURCE,
        sourceKey: SOURCE_KEY,
        method: 'cache',
        timestamp,
        success: false,
        error: 'Aucune donnée disponible (toutes les sources ont échoué)',
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

export default reebeloScraper;
