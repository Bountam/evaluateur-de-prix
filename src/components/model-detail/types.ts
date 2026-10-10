import { ModelEvaluation, ComparableListing } from "../../types";

export interface ListingFilters {
  ram: string;
  cpu: string;
  storage: string;
  year: string;
  source: string;
  screenSize: string;
  os: string;
  warranty: string;
  lot: string;
  specFilter: string;
}

export type SortColumn = 'default' | 'price' | 'date' | 'source';
export type SortOrder = 'asc' | 'desc';

export type SourceStatus = "idle" | "running" | "success" | "failed";

export interface SourceProgressItem {
  key: string;
  name: string;
  icon: string;
  logs: string[];
  status: SourceStatus;
  progress: number;
  listingCount: number;
}

export interface ModelDetailProps {
  modelName: string;
  category: string;
  evaluation: ModelEvaluation | null;
  onScrapeModel: (model: string, simulateFailure: boolean, category?: string) => Promise<void>;
  onUpdateListing: (modelName: string, listingId: string, included: boolean, price?: number) => Promise<void>;
  onUpdateMeta?: (modelName: string, configuration: string, condition: string, commentaires: string) => Promise<void>;
  scrapingLogs: string[];
  isScraping: boolean;
  scrapeProgress: number;
  concurrency?: number;
  onOpenConcurrencyModal?: () => void;
}
