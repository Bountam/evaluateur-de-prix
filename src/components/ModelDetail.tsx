import React, { useState, useEffect, useMemo } from "react";
import { ComparableListing } from "../types";
import {
  ListingFilters,
  SortColumn,
  SortOrder,
  ModelDetailProps,
  StatisticalSummaryCard,
  ScrapingProgressMonitor,
  ListingFilterBar,
  ListingTable,
  ModelDetailSummaryFooter,
  parseSourcesProgress,
  filterAndSortListings,
  calculateStandardDeviation,
} from "./model-detail";

export default function ModelDetail({
  modelName,
  category,
  evaluation,
  onScrapeModel: _onScrapeModel,
  onUpdateListing,
  onUpdateMeta: _onUpdateMeta,
  scrapingLogs,
  isScraping,
  scrapeProgress,
  concurrency: _concurrency = 2,
  onOpenConcurrencyModal: _onOpenConcurrencyModal,
}: ModelDetailProps) {
  // Price editing state
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [tempPrice, setTempPrice] = useState<string>("");

  // Source popover pinned state
  const [activePopoverKey, setActivePopoverKey] = useState<string | null>(null);

  // Filters state
  const [filters, setFilters] = useState<ListingFilters>({
    ram: "Toutes",
    cpu: "Tous",
    storage: "Tous",
    year: "Toutes",
    source: "Toutes",
    screenSize: "Toutes",
    os: "Tous",
    warranty: "Toutes",
    lot: "Tous",
    specFilter: "",
  });

  // Sorting state
  const [sortBy, setSortBy] = useState<SortColumn>("default");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  // Accordion collapsible states
  const [showSourceSection, setShowSourceSection] = useState<boolean>(false);
  const [showScreenOsSection, setShowScreenOsSection] = useState<boolean>(false);
  const [showWarrantyLotSection, setShowWarrantyLotSection] = useState<boolean>(false);
  const [showHardwareSection, setShowHardwareSection] = useState<boolean>(false);
  const [showTrackingSection, setShowTrackingSection] = useState<boolean>(true);

  // Reset filters when modelName changes
  useEffect(() => {
    setFilters({
      ram: "Toutes",
      cpu: "Tous",
      storage: "Tous",
      year: "Toutes",
      source: "Toutes",
      screenSize: "Toutes",
      os: "Tous",
      warranty: "Toutes",
      lot: "Tous",
      specFilter: "",
    });
    setSortBy("default");
    setSortOrder("desc");
  }, [modelName]);

  const handleFilterChange = <K extends keyof ListingFilters>(key: K, value: ListingFilters[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleResetFilters = () => {
    setFilters({
      ram: "Toutes",
      cpu: "Tous",
      storage: "Tous",
      year: "Toutes",
      source: "Toutes",
      screenSize: "Toutes",
      os: "Tous",
      warranty: "Toutes",
      lot: "Tous",
      specFilter: "",
    });
    setSortBy("default");
    setSortOrder("desc");
  };

  const handleQuickFilter = (filterKey: string, value: string) => {
    setFilters(prev => ({ ...prev, [filterKey]: value }));
  };

  const handleSortHeader = (col: 'price' | 'date' | 'source') => {
    if (sortBy === col) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setSortOrder(col === 'price' ? 'desc' : 'asc');
    }
  };

  const handlePriceEditStart = (listing: ComparableListing) => {
    setEditingPriceId(listing.id);
    setTempPrice(listing.price.toString());
  };

  const handlePriceEditSave = async (listingId: string) => {
    const val = parseFloat(tempPrice);
    if (!isNaN(val) && val > 0) {
      await onUpdateListing(modelName, listingId, true, val);
    }
    setEditingPriceId(null);
  };

  const handleToggleInclude = async (listing: ComparableListing) => {
    await onUpdateListing(modelName, listing.id, !listing.included);
  };

  // Liste dynamique et exhaustive des 16 sources de données + sources présentes
  const availableSourcesList = useMemo(() => {
    const default16 = [
      "Toutes",
      "eBay (Ventes complétées)",
      "eBay (Annonces actives)",
      "Back Market",
      "Reebelo",
      "Amazon Renewed",
      "Best Buy Marketplace",
      "GCSurplus",
      "Newegg Canada (Refurbished)",
      "Refurb.io Canada",
      "Walmart Canada (Restored)",
      "Dell Refurbished Canada",
      "IT Refurbs Canada",
      "Canada Computers (Refurbished)",
      "SEAO (Appels d'offres & Lots publics)",
      "Insertech (Interne)",
      "Insertech (Archives)"
    ];
    const presentSources = new Set<string>(default16);
    if (evaluation?.listings) {
      evaluation.listings.forEach(l => {
        if (l.source) presentSources.add(String(l.source));
      });
    }
    return Array.from(presentSources);
  }, [evaluation?.listings]);

  // Listings triés et filtrés
  const sortedListings = useMemo(() => {
    return filterAndSortListings(evaluation?.listings, filters, sortBy, sortOrder);
  }, [evaluation?.listings, filters, sortBy, sortOrder]);

  // Standard deviation for active listings
  const standardDeviation = useMemo(() => {
    return calculateStandardDeviation(evaluation?.listings);
  }, [evaluation?.listings]);

  // Parsed sources progress and status
  const parsedSources = useMemo(() => {
    return parseSourcesProgress(scrapingLogs, isScraping, scrapeProgress);
  }, [scrapingLogs, isScraping, scrapeProgress]);

  const hasFilterActive = Boolean(
    filters.ram !== "Toutes" ||
    filters.cpu !== "Tous" ||
    filters.storage !== "Tous" ||
    filters.year !== "Toutes" ||
    filters.source !== "Toutes" ||
    filters.screenSize !== "Toutes" ||
    filters.os !== "Tous" ||
    filters.warranty !== "Toutes" ||
    filters.lot !== "Tous" ||
    filters.specFilter.trim()
  );

  return (
    <div className="space-y-4" id="model-detail-container">
      {/* Overview Card */}
      <StatisticalSummaryCard
        modelName={modelName}
        category={category}
        evaluation={evaluation}
      />

      {/* Registre d'exécution & Diagnostic */}
      <ScrapingProgressMonitor
        isScraping={isScraping}
        scrapeProgress={scrapeProgress}
        scrapingLogs={scrapingLogs}
        parsedSources={parsedSources}
        activePopoverKey={activePopoverKey}
        setActivePopoverKey={setActivePopoverKey}
        showTrackingSection={showTrackingSection}
        setShowTrackingSection={setShowTrackingSection}
      />

      {/* Grid of Listings Validation */}
      {evaluation && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden" id="validation-panel">
          <div className="p-4 bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center space-x-2">
                <span>Annonces comparables & Filtrage</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Filtrez et vérifiez les offres du marché d'occasion pour ajuster la valeur marchande.
              </p>
            </div>
          </div>

          <ListingFilterBar
            filters={filters}
            onFilterChange={handleFilterChange}
            onResetFilters={handleResetFilters}
            availableSourcesList={availableSourcesList}
            totalCount={evaluation.listings.length}
            filteredCount={sortedListings.length}
            showSourceSection={showSourceSection}
            setShowSourceSection={setShowSourceSection}
            showScreenOsSection={showScreenOsSection}
            setShowScreenOsSection={setShowScreenOsSection}
            showWarrantyLotSection={showWarrantyLotSection}
            setShowWarrantyLotSection={setShowWarrantyLotSection}
            showHardwareSection={showHardwareSection}
            setShowHardwareSection={setShowHardwareSection}
          />

          <ListingTable
            listings={sortedListings}
            medianPrice={evaluation.medianPrice}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortChange={handleSortHeader}
            onToggleInclude={handleToggleInclude}
            editingPriceId={editingPriceId}
            tempPrice={tempPrice}
            onPriceEditStart={handlePriceEditStart}
            onPriceEditChange={setTempPrice}
            onPriceEditSave={handlePriceEditSave}
            onQuickFilter={handleQuickFilter}
            hasFilterActive={hasFilterActive}
          />
        </div>
      )}

      {/* Dynamic Retro Summary Footer */}
      <ModelDetailSummaryFooter
        evaluation={evaluation}
        standardDeviation={standardDeviation}
      />
    </div>
  );
}
