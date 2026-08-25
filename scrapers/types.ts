// ─── Interfaces communes pour tous les scrapers Insertech ───
import type { ListingSpecs } from './utils.ts';

export interface ScrapedListing {
  id: string;
  title: string;
  price: number;            // Prix final CAD (après rabais et conversion) — utilisé pour la médiane
  source: string;           // Nom affiché (ex: 'eBay (Ventes complétées)')
  sourceKey: string;        // Clé technique (ex: 'ebay-completed')
  date: string;             // ISO date string
  url: string;
  included: boolean;
  isOutlier: boolean;
  isSimulated: boolean;     // true si from cache
  condition?: string;
  saleType?: 'completed' | 'active' | 'fixed' | 'auction' | 'internal' | 'archive' | 'bid' | 'local' | 'wholesale';
  specs?: ListingSpecs;

  // ─── Champs de prix avancés ─────────────────────────────────────────────────
  originalPrice?: number;   // Prix avant rabais (prix barré), en CAD converti
  discountAmount?: number;  // Montant du rabais en CAD (originalPrice - price)
  discountPercent?: number; // Pourcentage de rabais (0-100)

  // ─── Conversion de devise ────────────────────────────────────────────────────
  currency?: string;        // Devise source avant conversion (ex: 'USD', 'GBP', 'EUR')
  exchangeRate?: number;    // Taux de change appliqué (ex: 1.3756 pour USD→CAD)
}

export interface ScraperResult {
  listings: ScrapedListing[];
  source: string;
  sourceKey: string;
  method: 'direct' | 'rss' | 'api' | 'json-embedded' | 'cache' | 'manual-import';
  timestamp: string;
  success: boolean;
  error?: string;
}

export interface ScraperModule {
  name: string;
  sourceKey: string;
  scrape(model: string, log: LogFn): Promise<ScraperResult>;
}

export type LogFn = (msg: string) => void;
