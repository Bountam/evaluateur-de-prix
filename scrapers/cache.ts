// ─── Système de cache segmenté Tier 3 ───
// Pour maximiser les performances et la résilience, le cache est divisé en fichiers individuels
// par couple (source, modèle) dans le dossier 'scraper-cache/'.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ScrapedListing } from './types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const CACHE_DIR = path.join(PROJECT_ROOT, 'data', 'scraper-cache');

interface CacheEntry {
  listings: ScrapedListing[];
  timestamp: string;
  model: string;
  sourceKey: string;
}

/**
 * Assure la création du dossier de cache de manière sécurisée.
 */
function ensureCacheDir(): void {
  if (!fs.existsSync(CACHE_DIR)) {
    try {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    } catch (err) {
      console.error('⚠️ Cache: Impossible de créer le dossier:', err);
    }
  }
}

/**
 * Normalise le nom du modèle pour en faire un nom de fichier sécurisé.
 */
function getSafeFilename(sourceKey: string, model: string): string {
  const safeModel = model
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]/g, '_')
    .replace(/__+/g, '_');
  const safeSource = sourceKey.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  return path.join(CACHE_DIR, `${safeSource}__${safeModel}.json`);
}

/**
 * Sauvegarde les résultats d'un scraping réussi dans le cache local segmenté.
 */
export function saveToCache(sourceKey: string, model: string, listings: ScrapedListing[]): void {
  if (!listings || listings.length === 0) return;

  ensureCacheDir();
  const filePath = getSafeFilename(sourceKey, model);
  
  const entry: CacheEntry = {
    listings: listings.map(l => ({ ...l, isSimulated: false })),
    timestamp: new Date().toISOString(),
    model: model.trim(),
    sourceKey,
  };

  try {
    // Écriture atomique via fichier temporaire pour éviter la corruption
    const tempPath = `${filePath}.${Math.random().toString(36).substring(2)}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(entry, null, 2), 'utf-8');
    fs.renameSync(tempPath, filePath);
  } catch (err) {
    console.error(`⚠️ Cache: Erreur écriture pour ${model} (${sourceKey}):`, err);
  }
}

/**
 * Charge les derniers résultats depuis le cache segmenté.
 * Tous les listings retournés sont marqués `isSimulated: true`.
 */
export function loadFromCache(sourceKey: string, model: string): ScrapedListing[] | null {
  const filePath = getSafeFilename(sourceKey, model);

  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const entry = JSON.parse(raw) as CacheEntry;
      if (entry && entry.listings && entry.listings.length > 0) {
        return entry.listings.map(l => ({
          ...l,
          isSimulated: true,
          date: l.date || entry.timestamp,
        }));
      }
    }
  } catch {
    // Fichier corrompu ou illisible
  }
  return null;
}

/**
 * Nettoie l'intégralité du cache segmenté.
 */
export function clearAllCache(): void {
  if (fs.existsSync(CACHE_DIR)) {
    try {
      const files = fs.readdirSync(CACHE_DIR);
      for (const file of files) {
        if (file.endsWith('.json') || file.includes('.tmp')) {
          fs.unlinkSync(path.join(CACHE_DIR, file));
        }
      }
    } catch (err) {
      console.error('⚠️ Cache: Erreur lors du nettoyage du cache:', err);
    }
  }
}
