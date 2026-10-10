// === Sources de données ===

export type ListingSource =
  | 'eBay (Ventes complétées)'
  | 'eBay (Annonces actives)'
  | 'Back Market'
  | 'Reebelo'
  | 'Amazon Renewed'
  | 'Best Buy Marketplace'
  | 'GCSurplus'
  | 'Newegg Canada (Refurbished)'
  | 'Refurb.io Canada'
  | 'Walmart Canada (Restored)'
  | 'Dell Refurbished Canada'
  | 'IT Refurbs Canada'
  | 'Canada Computers (Refurbished)'
  | 'SEAO (Appels d\'offres & Lots publics)'
  | 'Insertech (Interne)'
  | 'Insertech (Archives)';

// === Annonces comparables ===

export interface ComparableListing {
  id: string;
  title: string;
  price: number; // Prix final en CAD (après rabais et conversion — utilisé pour la médiane)
  source: ListingSource | string;
  sourceKey?: string;
  saleType?: 'sold' | 'completed' | 'active' | 'fixed' | 'auction' | 'internal' | 'archive' | 'bid' | 'local' | 'wholesale';
  date: string; // ISO date string or formatted date
  url: string;
  included: boolean; // whether selected for median calculation
  isOutlier: boolean; // automatically detected outlier
  isSimulated?: boolean;
  specs?: {
    year?: string;
    cpu?: string;
    ram?: string;
    storage?: string;
    model?: string;
    screenSize?: string;
    os?: string;
    warranty?: string;
    isLot?: boolean;
    unitOrLot?: 'unit' | 'lot';
  };

  // ─── Prix avancés ──────────────────────────────────────────────────────────
  originalPrice?: number;   // Prix avant rabais (prix barré), en CAD
  discountAmount?: number;  // Montant du rabais en CAD
  discountPercent?: number; // Pourcentage de rabais (ex: 27.3)

  // ─── Conversion de devise ──────────────────────────────────────────────────
  currency?: string;        // Devise source (ex: 'USD', 'GBP', 'EUR') — si converti
  exchangeRate?: number;    // Taux de change appliqué (ex: 1.3756)
}


// === Évaluations par modèle ===

export interface ModelEvaluation {
  modelName: string;
  category: string;
  medianPrice: number;
  confidence: 'Élevé' | 'Moyen' | 'Faible' | 'Aucun';
  comparablesCount: number;
  lastScraped: string | null;
  listings: ComparableListing[];
  configuration?: string;
  condition?: string;
  commentaires?: string;
  historicalPrices?: { date: string; price: number; confidence?: string }[];
}

// === Sélecteurs CSS pour le scraping ===

export interface SelectorConfig {
  container: string;
  title: string;
  price: string;
  url: string;
}

export interface SiteSelectors {
  eBay: SelectorConfig;
  backMarket: SelectorConfig;
}

// === Auto-guérison ===

export interface SelfHealingStatus {
  status: 'OK' | 'FAILED' | 'HEALED';
  source: 'Local' | 'Gist';
  lastChecked: string;
  details: string;
}

export interface ScrapingJobResult {
  modelName: string;
  listings: ComparableListing[];
  healingUsed: boolean;
  healingSource?: 'Gist';
}

// === GCSurplus ===

export interface GcsurplusLot {
  id: string;
  lotNumber: string;
  title: string;
  closingDate: string;
  currentBid: number;
  quantity: number;
  unitPrice: number;
  status: 'Actif' | 'Fermé' | 'Annulé';
  url: string;
  location: string;
  authorized: boolean;
  comments: string;
}

// === Sources de données ===

export interface DataSource {
  name: string;
  type: string;
  authorized: boolean;
  status: string;
  description: string;
  url: string;
  sourceKey: string;
  method?: string;
  coverage?: string;
  lastScraped?: string;
  listingsCount?: number;
  scrapeMethod?: 'direct' | 'rss' | 'api' | 'cache' | 'manual-import';
}

// === Journal historique ===

export interface HistoricalLogEntry {
  id: string;
  date: string;
  model: string;
  action: string;
  previousPrice: number;
  currentPrice: number;
  operator: string;
}

// === État global de l'application ===

export interface AppState {
  evaluations: Record<string, ModelEvaluation>;
  selectors: SiteSelectors;
  healingStatus: Record<string, SelfHealingStatus>;
  gcsurplusLots: GcsurplusLot[];
  sources: DataSource[];
  historicalLog: HistoricalLogEntry[];
  exportPath?: string;
  customModels?: { category: string; modelName: string; addedAt?: string; configuration?: string }[];
  credentials?: Record<string, string>;
}
