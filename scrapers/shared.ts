// ─── Module Mutualisé pour les Scrapers Insertech ───

import { loadFromCache, saveToCache, DEFAULT_TTL_MS } from './cache.ts';
import type { ScrapedListing, ScraperResult, LogFn } from './types.ts';

/**
 * Génère une chaîne hexadécimale aléatoire d'une longueur donnée.
 * Utilisé pour la génération d'identifiants uniques d'annonces.
 */
export function randomHex(len: number): string {
  return [...Array(len)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
}

/**
 * Détermine si un titre d'annonce correspond à des pièces détachées ou un produit incomplet/invalide.
 */
export function isOutlierTitle(title: string): boolean {
  if (!title) return true;
  const titleLower = title.toLowerCase();
  return (
    titleLower.includes('pièces') ||
    titleLower.includes('parts') ||
    titleLower.includes('réparation') ||
    titleLower.includes('repair') ||
    titleLower.includes('case only') ||
    titleLower.includes('boîtier seulement') ||
    titleLower.includes('for parts') ||
    titleLower.includes('broken') ||
    titleLower.includes('cassé') ||
    titleLower.includes('box only') ||
    titleLower.includes('boîte seulement') ||
    titleLower.includes('empty box')
  );
}

/**
 * Charge les résultats du cache local Tier 3 avec vérification TTL.
 */
export function getTier3Cache(sourceKey: string, model: string, ttlMs: number = DEFAULT_TTL_MS): ScrapedListing[] | null {
  return loadFromCache(sourceKey, model, ttlMs);
}

/**
 * Sauvegarde les annonces valides dans le cache local Tier 3.
 */
export function saveTier3Cache(sourceKey: string, model: string, listings: ScrapedListing[]): void {
  saveToCache(sourceKey, model, listings);
}

/**
 * Enveloppe l'exécution d'un scraper avec basculement automatique vers le cache local Tier 3 en cas d'échec ou d'absence de résultat.
 */
export async function withScraperResilience(
  source: string,
  sourceKey: string,
  model: string,
  log: LogFn,
  scraperFn: () => Promise<ScrapedListing[]>
): Promise<ScraperResult> {
  try {
    const listings = await scraperFn();
    if (listings && listings.length > 0) {
      saveTier3Cache(sourceKey, model, listings);
      return {
        source,
        sourceKey,
        success: true,
        method: 'direct',
        timestamp: new Date().toISOString(),
        listings
      };
    }
  } catch (err: any) {
    log(`⚠️ ${source}: Échec de la collecte directe (${err.message}). Basculement sur le cache Tier 3...`);
  }

  // Baseline Tier 3 cache fallback
  const cachedListings = getTier3Cache(sourceKey, model);
  if (cachedListings && cachedListings.length > 0) {
    log(`🔄 ${source}: Restitution de ${cachedListings.length} annonces depuis le cache local Tier 3.`);
    return {
      source,
      sourceKey,
      success: true,
      method: 'cache',
      timestamp: new Date().toISOString(),
      listings: cachedListings
    };
  }

  log(`❌ ${source}: Aucun résultat en direct ni en cache.`);
  return {
    source,
    sourceKey,
    success: false,
    method: 'direct',
    timestamp: new Date().toISOString(),
    listings: []
  };
}
