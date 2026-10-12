import fs from "fs";
import path from "path";
import type { AppState } from "../../src/types.ts";
import { sqliteDb } from "./connection.ts";
import { seedDatabase } from "./seed.ts";
import { SQLITE_PATH, BACKUP_DIR, getFunctionalUrl } from "../config/index.ts";
import { isPartOrAssembly, extractSpecsFromTitle } from "../../scrapers/utils.ts";
import { calculateMedian } from "../../scrapers/orchestrator.ts";
import { getCredentials } from "../../scrapers/credentials.ts";

export let cachedStateHash: string | null = null;
export function invalidateStateCache() {
  cachedStateHash = null;
}
export function setCachedStateHash(hash: string) {
  cachedStateHash = hash;
}

// Mutex async pour sérialiser toutes les opérations d'écriture dans la base SQLite
let dbLockChain: Promise<any> = Promise.resolve();
export function withDBLock<T>(fn: () => Promise<T> | T): Promise<T> {
  const result = dbLockChain.then(() => fn());
  dbLockChain = result.then(() => {}, () => {});
  return result;
}

// Crée une sauvegarde horodatée de la base de données SQLite avant toute modification majeure
export function createBackupBeforeImport(): string | null {
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = path.join(BACKUP_DIR, `database_${timestamp}.sqlite`);
    if (fs.existsSync(SQLITE_PATH)) {
      fs.copyFileSync(SQLITE_PATH, backupPath);
    }

    // Rotation automatique: conserver au maximum 5 sauvegardes
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith("database_") && f.endsWith(".sqlite"))
      .map(f => path.join(BACKUP_DIR, f))
      .sort();

    while (files.length > 5) {
      const oldest = files.shift();
      if (oldest && fs.existsSync(oldest)) {
        fs.unlinkSync(oldest);
      }
    }
    return backupPath;
  } catch (err) {
    console.error("Failed to create pre-import backup:", err);
    return null;
  }
}

// Lecture brute de la base de données sans effet de bord
export function readDBRaw(): AppState {
  try {
    const row: any = sqliteDb.prepare('SELECT value FROM store WHERE key = ?').get('state');
    if (row) {
      const db = JSON.parse(row.value);
      if (!db.evaluations) db.evaluations = {};
      if (!db.customModels) db.customModels = [];
      if (!db.credentials) db.credentials = getCredentials();
      db.sources = seedDatabase().sources;
      return db;
    }
    const seed = seedDatabase();
    writeDB(seed);
    return seed;
  } catch (err) {
    console.error("Error reading database raw, seeding fallback:", err);
    try {
      const seed = seedDatabase();
      writeDB(seed);
      return seed;
    } catch (seedErr) {
      console.error("Critical error seeding fallback database:", seedErr);
      return {
        evaluations: {},
        selectors: {} as any,
        healingStatus: {},
        gcsurplusLots: [],
        sources: [],
        historicalLog: [],
        customModels: []
      };
    }
  }
}

// Assainit les données préexistantes (prix aberrants, pièces détachées, spécifications, URLs)
export function sanitizeDB(db: AppState): { db: AppState; changed: boolean } {
  let changed = false;
  if (db.evaluations) {
    Object.keys(db.evaluations).forEach(model => {
      const ev = db.evaluations[model];

      if (typeof ev.medianPrice === "number" && ev.medianPrice > 2500) {
        ev.medianPrice = Math.round((ev.medianPrice / 100) * 100) / 100;
        changed = true;
      }

      if (ev.historicalPrices && Array.isArray(ev.historicalPrices)) {
        ev.historicalPrices.forEach((hp: any) => {
          if (typeof hp.price === "number" && hp.price > 2500) {
            hp.price = Math.round((hp.price / 100) * 100) / 100;
            changed = true;
          }
        });
      }

      if (ev.listings && Array.isArray(ev.listings)) {
        const origLen = ev.listings.length;
        ev.listings = ev.listings.filter((listing: any) => !isPartOrAssembly(listing.title));
        if (ev.listings.length !== origLen) {
          changed = true;
          ev.medianPrice = calculateMedian(ev.listings as any);
          ev.comparablesCount = ev.listings.filter((l: any) => l.included && !l.isOutlier).length;
        }

        ev.listings.forEach((listing: any) => {
          if (!listing.specs) {
            listing.specs = extractSpecsFromTitle(listing.title);
            changed = true;
          }

          if (typeof listing.price === "number" && listing.price > 2500) {
            listing.price = Math.round((listing.price / 100) * 100) / 100;
            changed = true;
          }

          const urlStr = listing.url || "";
          const isRealUrl = typeof urlStr === "string" &&
                            urlStr.startsWith("http") &&
                            !urlStr.includes("placeholder") &&
                            !urlStr.includes("example.com");

          const isMismatched = isRealUrl && (
            (urlStr.includes("backmarket.ca") && !listing.source.toLowerCase().includes("back")) ||
            (urlStr.includes("bestbuy.ca") && !listing.source.toLowerCase().includes("best")) ||
            (urlStr.includes("amazon.ca") && !listing.source.toLowerCase().includes("amazon")) ||
            (urlStr.includes("ebay.ca") && !listing.source.toLowerCase().includes("ebay"))
          );

          if (!isRealUrl || listing.isSimulated || isMismatched) {
            const oldUrl = listing.url;
            listing.url = getFunctionalUrl(listing.source || "eBay", listing.title || model, model);
            if (listing.url !== oldUrl) {
              changed = true;
            }
          }
        });
      }
    });
  }
  return { db, changed };
}

// Fonction de lecture de la base de données avec assainissement en mémoire (respect du principe CQS)
export function readDB(): AppState {
  const db = readDBRaw();
  const { db: sanitized } = sanitizeDB(db);
  return sanitized;
}

export function writeDB(data: any) {
  try {
    const stmt = sqliteDb.prepare('INSERT OR REPLACE INTO store (key, value) VALUES (?, ?)');
    stmt.run('state', JSON.stringify(data));
  } catch (err) {
    console.error("Error writing database:", err);
  }
}
