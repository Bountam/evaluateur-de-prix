import React from 'react';
import Sidebar from './Sidebar';
import ModelDetail from './ModelDetail';

interface CategoryLayoutProps {
  id: string;
  filterCategories: string[];
  selectedModel: string;
  onSelectModel: (model: string, category: string) => void;
  evaluations: any;
  customModels: any;
  onOpenAddModel: () => void;
  onScrapeModel: (model: string, simulateFailure: boolean, category?: string) => Promise<void>;
  scrapingModels: any;
  selectedCategory: string;
  onUpdateListing: (modelName: string, listingId: string, included: boolean, price?: number) => Promise<void>;
  onUpdateMeta: (modelName: string, configuration: string, condition: string, commentaires: string) => Promise<void>;
  scrapingLogs: any[];
  isScraping: boolean;
  scrapeProgress: number;
  concurrency: number;
  onOpenConcurrencyModal: () => void;
  onQuickAddModel?: (category: string, modelName: string, specs?: string) => Promise<void>;
}

export default function CategoryLayout({
  id,
  filterCategories,
  selectedModel,
  onSelectModel,
  evaluations,
  customModels,
  onOpenAddModel,
  onScrapeModel,
  scrapingModels,
  selectedCategory,
  onUpdateListing,
  onUpdateMeta,
  scrapingLogs,
  isScraping,
  scrapeProgress,
  concurrency,
  onOpenConcurrencyModal,
  onQuickAddModel
}: CategoryLayoutProps) {
  return (
    <div className="flex-1 flex flex-col md:flex-row border border-[#DCDDE1] rounded-lg bg-white shadow-sm overflow-hidden min-h-[500px]" id={id}>
      <Sidebar
        selectedModel={selectedModel}
        onSelectModel={onSelectModel}
        evaluations={evaluations}
        filterCategories={filterCategories}
        customModels={customModels}
        onOpenAddModel={onOpenAddModel}
        onQuickAddModel={onQuickAddModel}
        onScrapeModel={onScrapeModel}
        scrapingModels={scrapingModels}
      />
      <div className="flex-1 overflow-y-auto p-4 bg-[#F8F9FA]" id="detail-pane">
        <ModelDetail
          modelName={selectedModel}
          category={selectedCategory}
          evaluation={evaluations[selectedModel] || null}
          onScrapeModel={onScrapeModel}
          onUpdateListing={onUpdateListing}
          onUpdateMeta={onUpdateMeta}
          scrapingLogs={scrapingLogs}
          isScraping={isScraping}
          scrapeProgress={scrapeProgress}
          concurrency={concurrency}
          onOpenConcurrencyModal={onOpenConcurrencyModal}
        />
      </div>
    </div>
  );
}
