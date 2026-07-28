// ─── GCSurplus Canada — Enchères gouvernementales (Source institutionnelle Insertech) ───

import * as cheerio from 'cheerio';
import AdmZip from 'adm-zip';
import { fetch as undiciFetch, Agent } from 'undici';
import type { ScraperModule, ScrapedListing, ScraperResult, LogFn } from './types.ts';
import { saveToCache, loadFromCache } from './cache.ts';
import { getCredentials } from './credentials.ts';
import { parseCADPrice, cleanProductUrl } from './utils.ts';

const SOURCE = 'GCSurplus';
const SOURCE_KEY = 'gcsurplus';

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
];

function randomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function randomHex(len: number): string {
  return [...Array(len)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
}

// Agent SSL personnalisé pour résoudre "UNABLE_TO_VERIFY_LEAF_SIGNATURE" sur les certificats gouvernementaux canadiens
function getDispatcher() {
  return new Agent({ connect: { rejectUnauthorized: false } });
}

function parseListings($: cheerio.CheerioAPI, _model: string, isSoldSearch: boolean): ScrapedListing[] {
  const listings: ScrapedListing[] = [];
  let idx = 0;

  $('table.wb-tables tbody tr, table.table-striped tbody tr, div.item-box').each((_i, el) => {
    try {
      const $tr = $(el);
      const td0 = $tr.find('td').first();
      if (!td0 || td0.length === 0) return;

      const $a = td0.find('a').first();
      const titleText = $a.text().trim();
      if (!titleText || titleText.length < 3) return;

      // Construction de l'URL propre du lot
      let link = $a.attr('href') || '';
      if (link && !link.startsWith('http')) {
        link = `https://gcsurplus.ca/${link.replace(/^\//, '')}`;
      }
      const cleanUrl = link ? cleanProductUrl(link, link) : 'https://gcsurplus.ca/';

      // Extraire prix, date, location à partir des balises <dt> et <dd> de GCSurplus
      let priceRaw = '';
      let dateRaw = '';
      let location = '';

      td0.find('dt').each((_, dtEl) => {
        const dtText = $(dtEl).text().trim();
        const ddEl = $(dtEl).next('dd');
        const ddText = ddEl.text().trim();

        if (
          dtText.includes('Current Bid') ||
          dtText.includes('Sold For') ||
          dtText.includes('Purchase amount') ||
          dtText.includes('Minimum bid')
        ) {
          priceRaw = ddText;
        } else if (dtText.includes('Closing:') || dtText.includes('Sold On:') || dtText.includes('Posted:')) {
          if (!dateRaw || dtText.includes('Closing:') || dtText.includes('Sold On:')) {
            dateRaw = ddText;
          }
        } else if (dtText.includes('Location:')) {
          location = ddText;
        }
      });

      const priceVal = parseCADPrice(priceRaw);
      if (priceVal === null || priceVal < 5) return;

      // Détection de lots (ex: "Lot of 15 Laptops", "Lot de 10 ordinateurs", "qty: 5")
      let quantity = 1;
      const qtyMatch = titleText.match(/(?:lot de|qty\s*:?|quantit[eé]\s*:?|^)(\d+)\s*(?:laptops?|ordinateurs?|unit[eé]s?|pcs?|items?|appareils?)/i) ||
                       titleText.match(/(?:lot de|qty\s*:?|quantit[eé]\s*:?)\s*(\d+)/i);
      if (qtyMatch && parseInt(qtyMatch[1], 10) > 0) {
        quantity = parseInt(qtyMatch[1], 10);
      }

      const unitPrice = Math.round((priceVal / quantity) * 100) / 100;

      // Formatage ISO de la date de clôture ou de vente
      let isoDate = new Date().toISOString();
      if (dateRaw) {
        const cleanDateStr = dateRaw.replace(/@.*$/, '').replace(/In Progress \(.*?\)/, '').trim();
        const parsedDate = new Date(cleanDateStr);
        if (!isNaN(parsedDate.getTime())) {
          isoDate = parsedDate.toISOString();
        }
      }

      // Détection d'outliers (accessoires, pièces, docks, sacs)
      const titleLower = titleText.toLowerCase();
      const isOutlier =
        titleLower.includes('pièces') ||
        titleLower.includes('for parts') ||
        titleLower.includes('dock') ||
        titleLower.includes('station d\'accueil') ||
        titleLower.includes('clavier') ||
        titleLower.includes('chargeur') ||
        titleLower.includes('toner') ||
        titleLower.includes('cartridge') ||
        titleLower.includes('bag') ||
        titleLower.includes('sac');

      idx++;
      const formattedTitle = quantity > 1
        ? `${titleText} [Lot de ${quantity} → Prix unitaire: ${unitPrice.toFixed(2)}$]` + (location ? ` (${location})` : '')
        : `${titleText}` + (location ? ` (${location})` : '');

      listings.push({
        id: `gcsurplus-${isSoldSearch ? 'sold' : 'active'}-${idx}-${randomHex(4)}`,
        title: formattedTitle,
        price: unitPrice,
        source: SOURCE,
        sourceKey: SOURCE_KEY,
        date: isoDate,
        url: cleanUrl,
        included: !isOutlier,
        isOutlier,
        isSimulated: false,
        condition: isSoldSearch ? 'Vente conclue (GCSurplus)' : 'Enchère active (GCSurplus)',
        saleType: isSoldSearch ? 'completed' : 'auction',
      });
    } catch {
      // Ignorer ligne non parsable
    }
  });

  return listings;
}

// ─── TIER 1 : Connexion Authentifiée GCSurplus ───
async function tier1Authenticated(model: string, log: LogFn): Promise<ScrapedListing[] | null> {
  const { GCSURPLUS_USERNAME: username, GCSURPLUS_PASSWORD: password } = getCredentials();

  if (!username || !password) {
    log(`⚠️ [${SOURCE_KEY}] Tier 1: Identifiants GCSURPLUS_USERNAME/PASSWORD absents, bascule en public...`);
    return null;
  }

  log(`🌐 [${SOURCE_KEY}] Tier 1: Connexion authentifiée à GCSurplus (${username})...`);
  try {
    const dispatcher = getDispatcher();
    const ua = randomUA();
    const loginUrl = 'https://gcsurplus.ca/mn-eng.cfm?sn=sf-pe.cfm&step=login';
    const sessionResp = await undiciFetch(loginUrl, {
      headers: { 'User-Agent': ua },
      dispatcher,
      signal: AbortSignal.timeout(15000),
    });

    const cookies = sessionResp.headers.get('set-cookie') || '';

    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);
    formData.append('submit', 'Login');

    const authResp = await undiciFetch('https://gcsurplus.ca/mn-eng.cfm?sn=sf-pe.cfm&step=auth', {
      method: 'POST',
      headers: {
        'User-Agent': ua,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookies,
      },
      body: formData.toString(),
      dispatcher,
      signal: AbortSignal.timeout(15000),
    });

    const authCookies = authResp.headers.get('set-cookie') || cookies;

    // Recherche POST authentifiée (Actives)
    const bodySearch = new URLSearchParams({
      snc: 'wfsav',
      sc: 'ach-shop',
      frm_cmdSearch: '1',
      frm_txtKeyWord: model,
      vndsld: '0',
    });

    const searchResp = await undiciFetch('https://gcsurplus.ca/mn-eng.cfm', {
      method: 'POST',
      headers: {
        'User-Agent': ua,
        'Cookie': authCookies,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: bodySearch.toString(),
      dispatcher,
      signal: AbortSignal.timeout(15000),
    });

    if (!searchResp.ok) return null;
    const html = await searchResp.text();
    const $ = cheerio.load(html);
    const listings = parseListings($, model, false);

    if (listings.length === 0) {
      log(`⚠️ [${SOURCE_KEY}] Tier 1: Aucun lot actif trouvé avec compte pour "${model}"`);
      return null;
    }

    log(`✔️ [${SOURCE_KEY}] Tier 1: ${listings.length} lots récupérés en accès autorisé`);
    return listings;
  } catch (err) {
    log(`⚠️ [${SOURCE_KEY}] Tier 1 échoué: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

// ─── TIER 2 : Open Government CKAN API + Datasets PSPC (Historique GCSurplus) ───
async function tier2OpenDataCKAN(model: string, log: LogFn): Promise<ScrapedListing[] | null> {
  log(`📡 [${SOURCE_KEY}] Tier 2: Interrogation API Open Data CKAN (Canada.ca - GCSurplus What Has Sold)...`);
  try {
    const dispatcher = getDispatcher();
    const ckanUrl = 'https://open.canada.ca/data/api/3/action/package_show?id=1a09c5c1-3554-4b70-9e53-6322a72ec7d4';
    const ckanResp = await undiciFetch(ckanUrl, {
      headers: { 'User-Agent': randomUA() },
      dispatcher,
      signal: AbortSignal.timeout(15000),
    });

    if (!ckanResp.ok) {
      log(`⚠️ [${SOURCE_KEY}] Tier 2: API CKAN HTTP ${ckanResp.status}`);
      return null;
    }

    const ckanData = (await ckanResp.json()) as any;
    if (!ckanData.success || !ckanData.result?.resources) {
      log(`⚠️ [${SOURCE_KEY}] Tier 2: Package CKAN introuvable ou vide`);
      return null;
    }

    const resources = ckanData.result.resources as { name: string; format: string; url: string }[];
    const csvResources = resources
      .filter(r => r.format.toUpperCase() === 'CSV' && r.url.endsWith('.zip'))
      .slice(0, 2);

    if (csvResources.length === 0) {
      log(`⚠️ [${SOURCE_KEY}] Tier 2: Aucun fichier CSV ZIP récent dans l'API CKAN`);
      return null;
    }

    log(`🌐 [${SOURCE_KEY}] Tier 2: Téléchargement et analyse des datasets PSPC...`);
    const listings: ScrapedListing[] = [];
    let idx = 0;
    const modelTerms = model.toLowerCase().split(/\s+/).filter(Boolean);

    for (const resItem of csvResources) {
      if (listings.length >= 20) break;
      try {
        const fileResp = await undiciFetch(resItem.url, {
          headers: { 'User-Agent': randomUA() },
          dispatcher,
          signal: AbortSignal.timeout(25000),
        });
        if (!fileResp.ok) continue;

        const arrayBuffer = await fileResp.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const zip = new AdmZip(buffer);
        const entries = zip.getEntries();

        for (const entry of entries) {
          if (!entry.entryName.endsWith('.csv')) continue;
          const csvText = entry.getData().toString('utf8');
          const lines = csvText.split(/\r?\n/);

          for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            if (!line || line.length < 20) continue;
            const lineLower = line.toLowerCase();

            const matches = modelTerms.every(term => lineLower.includes(term));
            if (!matches) continue;

            const cols: string[] = [];
            let inQuotes = false;
            let current = '';
            for (let charIdx = 0; charIdx < line.length; charIdx++) {
              const char = line[charIdx];
              if (char === '"') {
                inQuotes = !inQuotes;
              } else if (char === ',' && !inQuotes) {
                cols.push(current.trim());
                current = '';
              } else {
                current += char;
              }
            }
            cols.push(current.trim());

            const soldAmtRaw = cols[0] || '';
            const soldAmt = parseCADPrice(soldAmtRaw);
            if (!soldAmt || soldAmt < 10) continue;

            const desc = (cols[1] || '').replace(/^"|"$/g, '').trim();
            const closingDt = cols[3] || new Date().toISOString().split('T')[0];
            const lotItems = (cols[4] || '').replace(/^"|"$/g, '').trim();

            let quantity = 1;
            const qtyMatch = `${desc} ${lotItems}`.match(/(?:quantit[eé]|qty|lot de)\s*:?\s*(\d+)/i);
            if (qtyMatch && parseInt(qtyMatch[1], 10) > 0) {
              quantity = parseInt(qtyMatch[1], 10);
            }

            const unitPrice = Math.round((soldAmt / quantity) * 100) / 100;

            idx++;
            listings.push({
              id: `gcsurplus-ckan-${idx}-${randomHex(4)}`,
              title: quantity > 1 ? `${desc.slice(0, 90)} [Lot de ${quantity} → Prix unitaire: ${unitPrice.toFixed(2)}$]` : desc.slice(0, 100),
              price: unitPrice,
              source: SOURCE,
              sourceKey: SOURCE_KEY,
              date: closingDt ? new Date(closingDt).toISOString() : new Date().toISOString(),
              url: 'https://open.canada.ca/data/en/dataset/1a09c5c1-3554-4b70-9e53-6322a72ec7d4',
              included: true,
              isOutlier: false,
              isSimulated: false,
              condition: 'Surplus gouvernemental (Archive PSPC)',
              saleType: 'completed',
            });

            if (listings.length >= 25) break;
          }
        }
      } catch {
        // Ignorer erreur d'extraction archive
      }
    }

    if (listings.length === 0) return null;
    log(`✔️ [${SOURCE_KEY}] Tier 2: ${listings.length} ventes historiques récupérées via l'API Open Government`);
    return listings;
  } catch (err) {
    log(`⚠️ [${SOURCE_KEY}] Tier 2 échoué: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

// ─── TIER 3 : Recherche Publique POST (`gcsurplus.ca` - Enchères Actives & Ventes Conclues) ───
async function tier3PublicSearch(model: string, log: LogFn): Promise<ScrapedListing[] | null> {
  log(`📡 [${SOURCE_KEY}] Tier 3: Recherche publique POST sur GCSurplus.ca (Actives & Ventes conclues)...`);
  try {
    const dispatcher = getDispatcher();
    const ua = randomUA();
    const url = 'https://gcsurplus.ca/mn-eng.cfm';

    // 1. Enchères en cours (vndsld=0)
    const bodyActive = new URLSearchParams({
      snc: 'wfsav',
      sc: 'ach-shop',
      frm_cmdSearch: '1',
      frm_txtKeyWord: model,
      vndsld: '0',
    });
    const respActive = await undiciFetch(url, {
      method: 'POST',
      headers: { 'User-Agent': ua, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: bodyActive.toString(),
      dispatcher,
      signal: AbortSignal.timeout(15000),
    });

    let activeListings: ScrapedListing[] = [];
    if (respActive.ok) {
      const htmlActive = await respActive.text();
      const $active = cheerio.load(htmlActive);
      activeListings = parseListings($active, model, false);
    }

    // 2. Ventes terminées/conclues récentes (vndsld=1)
    const bodySold = new URLSearchParams({
      snc: 'wfsav',
      sc: 'ach-shop',
      frm_cmdSearch: '1',
      frm_txtKeyWord: model,
      vndsld: '1',
    });
    const respSold = await undiciFetch(url, {
      method: 'POST',
      headers: { 'User-Agent': ua, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: bodySold.toString(),
      dispatcher,
      signal: AbortSignal.timeout(15000),
    });

    let soldListings: ScrapedListing[] = [];
    if (respSold.ok) {
      const htmlSold = await respSold.text();
      const $sold = cheerio.load(htmlSold);
      soldListings = parseListings($sold, model, true);
    }

    const combined = [...activeListings, ...soldListings];
    if (combined.length === 0) {
      log(`⚠️ [${SOURCE_KEY}] Tier 3: Aucun lot public (actif ou conclu) trouvé pour "${model}"`);
      return null;
    }

    log(`✔️ [${SOURCE_KEY}] Tier 3: ${combined.length} lots réels récupérés (${activeListings.length} enchères en cours, ${soldListings.length} ventes conclues)`);
    return combined;
  } catch (err) {
    log(`⚠️ [${SOURCE_KEY}] Tier 3 échoué: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

// ─── TIER 4 : Cache Certifié Local ───
function tier4Cache(model: string, log: LogFn): ScrapedListing[] | null {
  log(`🩺 [${SOURCE_KEY}] Tier 4: Chargement depuis le cache certifié GCSurplus...`);
  const cached = loadFromCache(SOURCE_KEY, model);
  if (cached && cached.length > 0) {
    log(`✔️ [${SOURCE_KEY}] Tier 4: ${cached.length} lots gouvernementaux depuis le cache`);
    return cached;
  }
  log(`⚠️ [${SOURCE_KEY}] Tier 4: Aucune donnée en cache`);
  return null;
}

const gcsurplusScraper: ScraperModule = {
  name: SOURCE,
  sourceKey: SOURCE_KEY,

  async scrape(model: string, log: LogFn): Promise<ScraperResult> {
    const timestamp = new Date().toISOString();
    try {
      // 1. Tenter la recherche authentifiée
      const authListings = await tier1Authenticated(model, log);
      if (authListings && authListings.length > 0) {
        saveToCache(SOURCE_KEY, model, authListings);
        return {
          listings: authListings,
          source: SOURCE,
          sourceKey: SOURCE_KEY,
          method: 'direct',
          timestamp,
          success: true,
        };
      }

      // 2. Tenter la recherche publique POST (Enchères en cours + Ventes conclues)
      const publicListings = await tier3PublicSearch(model, log);
      if (publicListings && publicListings.length > 0) {
        saveToCache(SOURCE_KEY, model, publicListings);
        return {
          listings: publicListings,
          source: SOURCE,
          sourceKey: SOURCE_KEY,
          method: 'direct',
          timestamp,
          success: true,
        };
      }

      // 3. Tenter l'acquisition historique via Open Data API CKAN & Datasets PSPC
      const openDataListings = await tier2OpenDataCKAN(model, log);
      if (openDataListings && openDataListings.length > 0) {
        saveToCache(SOURCE_KEY, model, openDataListings);
        return {
          listings: openDataListings,
          source: SOURCE,
          sourceKey: SOURCE_KEY,
          method: 'api',
          timestamp,
          success: true,
        };
      }

      // 4. Basculer sur le cache local
      const cachedListings = tier4Cache(model, log);
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
        error: 'Aucun lot disponible pour ce modèle sur GCSurplus',
      };
    } catch (err) {
      log(`⚠️ [${SOURCE_KEY}] Erreur globale: ${err instanceof Error ? err.message : String(err)}`);
      const cachedListings = tier4Cache(model, log);
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

export default gcsurplusScraper;
