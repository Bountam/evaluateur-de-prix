import React, { useState, useMemo } from "react";
import { MASTER_LIST_MODELS, normalizeCategory } from "../modelsData";
import { Search, Monitor, Laptop, Smartphone, ChevronRight, PlusCircle, RefreshCw } from "lucide-react";
import { ModelEvaluation } from "../types";
import HelpTooltip from "./common/HelpTooltip";
import { HELP_CONTENT } from "../constants/helpContent";
import { parseModelRawString, searchReferenceModels } from "../utils/modelParser";

interface SidebarProps {
  selectedModel: string;
  onSelectModel: (model: string, category: string) => void;
  evaluations: Record<string, ModelEvaluation>;
  filterCategories?: string[];
  customModels?: { category: string; modelName: string }[];
  onOpenAddModel?: () => void;
  onQuickAddModel?: (category: string, modelName: string, specs?: string) => Promise<void>;
  onScrapeModel?: (model: string, simulateFailure: boolean, category?: string) => Promise<void>;
  scrapingModels?: Record<string, { isScraping: boolean; progress: number; logs: string[] }>;
}

export default function Sidebar({ 
  selectedModel, 
  onSelectModel, 
  evaluations, 
  filterCategories, 
  customModels, 
  onOpenAddModel,
  onQuickAddModel,
  onScrapeModel,
  scrapingModels
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const getCategoryIcon = (category: string) => {
    if (category.toLowerCase().includes("portable") || category.toLowerCase().includes("apple")) {
      return <Laptop className="w-4 h-4 text-slate-500" id="icon-laptop" />;
    }
    if (category.toLowerCase().includes("desktop") || category.toLowerCase().includes("bureau") || category.toLowerCase().includes("tour")) {
      return <Monitor className="w-4 h-4 text-slate-500" id="icon-monitor" />;
    }
    return <Smartphone className="w-4 h-4 text-slate-500" id="icon-smartphone" />;
  };

  // Merge MASTER_LIST_MODELS with dynamically loaded customModels (including custom categories)
  const mergedCategories = useMemo(() => {
    const standardCategories = MASTER_LIST_MODELS.map(cat => {
      const customsForCat = (customModels || [])
        .filter(cm => normalizeCategory(cm.category) === cat.categoryName)
        .map(cm => cm.modelName);
      const combined = Array.from(new Set([...cat.models, ...customsForCat]));
      return {
        ...cat,
        models: combined
      };
    });

    const standardCatNames = new Set(MASTER_LIST_MODELS.map(c => c.categoryName));
    const extraCategoriesMap: Record<string, string[]> = {};

    (customModels || []).forEach(cm => {
      const normCat = normalizeCategory(cm.category);
      if (!standardCatNames.has(normCat)) {
        if (!extraCategoriesMap[normCat]) {
          extraCategoriesMap[normCat] = [];
        }
        if (!extraCategoriesMap[normCat].includes(cm.modelName)) {
          extraCategoriesMap[normCat].push(cm.modelName);
        }
      }
    });

    const extraCategories = Object.entries(extraCategoriesMap).map(([categoryName, models]) => ({
      categoryName,
      models
    }));

    return [...standardCategories, ...extraCategories];
  }, [customModels]);

  // Filter master list based on search and selected categories
  const filteredCategories = mergedCategories.map(cat => {
    const matchedModels = cat.models.filter(m => 
      m.toLowerCase().includes(searchQuery.toLowerCase())
    );
    return {
      ...cat,
      models: matchedModels
    };
  }).filter(cat => {
    if (cat.models.length === 0) return false;
    if (!filterCategories || filterCategories.length === 0) return true;
    if (filterCategories.includes(cat.categoryName)) return true;

    // Custom category matching tab context
    const catLower = cat.categoryName.toLowerCase();
    const isDesktop = catLower.includes("desktop") || catLower.includes("bureau") || catLower.includes("tour");
    const isIphone = catLower.includes("iphone") || catLower.includes("smartphone") || catLower.includes("téléphone");
    
    const filterHasDesktop = filterCategories.some(f => f.toLowerCase().includes("desktop"));
    const filterHasIphone = filterCategories.some(f => f.toLowerCase().includes("iphone"));
    const filterHasPortables = filterCategories.some(f => f.toLowerCase().includes("portable") || f.toLowerCase().includes("apple"));

    if (isDesktop && filterHasDesktop) return true;
    if (isIphone && filterHasIphone) return true;
    if (!isDesktop && !isIphone && filterHasPortables) return true;

    return false;
  });

  const exactMatchExists = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return mergedCategories.some(cat => cat.models.some(m => m.toLowerCase() === q));
  }, [searchQuery, mergedCategories]);

  const parsedSearch = useMemo(() => {
    if (searchQuery.trim().length < 2) return null;
    return parseModelRawString(searchQuery);
  }, [searchQuery]);

  const searchSuggestions = useMemo(() => {
    if (searchQuery.trim().length < 2) return [];
    const allExisting = new Set(mergedCategories.flatMap(c => c.models.map(m => m.toLowerCase())));
    return searchReferenceModels(searchQuery, 4).filter(ref => !allExisting.has(ref.name.toLowerCase()));
  }, [searchQuery, mergedCategories]);

  const handleInlineAdd = async (category: string, modelName: string, specs?: string) => {
    if (onQuickAddModel) {
      await onQuickAddModel(category, modelName, specs);
      setSearchQuery("");
    } else if (onOpenAddModel) {
      onOpenAddModel();
    }
  };

  return (
    <aside className="w-72 bg-white dark:bg-slate-900 border-r border-[#DCDDE1] dark:border-slate-800 flex flex-col h-full shrink-0" id="sidebar-container">
      {/* Search & Add Header */}
      <div className="p-3 border-b border-[#DCDDE1] dark:border-slate-800 bg-[#F1F2F6] dark:bg-slate-800/50 space-y-2.5" id="search-section">
        <div className="relative flex items-center">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-[#7F8C8D]" />
          <input
            type="text"
            placeholder="Rechercher un modèle..."
            className="w-full pl-8 pr-7 py-1.5 text-xs bg-white dark:bg-slate-800 border border-[#DCDDE1] dark:border-slate-700 rounded shadow-sm outline-none focus:border-brand-purple dark:focus:border-brand-lime text-slate-800 dark:text-slate-200 transition-colors"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            id="sidebar-search"
          />
          <HelpTooltip topic={HELP_CONTENT.modelSearch} size="xs" side="bottom" className="absolute right-2" id="sidebarModelSearch" />
        </div>
        {onOpenAddModel && (
          <div className="flex items-center space-x-1.5">
            <button
              type="button"
              onClick={onOpenAddModel}
              className="flex-1 flex items-center justify-center space-x-1.5 py-1.5 px-3 rounded bg-brand-purple dark:bg-brand-lime text-white dark:text-slate-900 font-bold text-xs shadow hover:opacity-90 transition-all cursor-pointer"
              title="Ajouter un nouveau modèle"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Ajouter un modèle</span>
            </button>
            <HelpTooltip topic={HELP_CONTENT.addModelBtn} size="xs" side="right" id="sidebarAddModel" />
          </div>
        )}
      </div>

      {/* Inline Quick Add Card & Reference Suggestions */}
      {searchQuery.trim().length >= 2 && !exactMatchExists && parsedSearch && (
        <div className="p-3 border-b border-[#DCDDE1] dark:border-slate-800 bg-brand-purple/5 dark:bg-brand-lime/10 space-y-2 animate-fadeIn shrink-0" id="inline-quick-add-banner">
          <div>
            <div className="text-[11px] font-bold text-slate-800 dark:text-slate-100 flex items-center space-x-1">
              <span>✨ Nouveau modèle détecté</span>
            </div>
            <div className="text-xs font-bold text-brand-purple dark:text-brand-lime font-mono mt-0.5">
              {parsedSearch.cleanModelName}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
              Catégorie : <span className="font-semibold text-slate-700 dark:text-slate-300">{parsedSearch.category}</span>
              {parsedSearch.specs.fullConfiguration && (
                <span className="block italic text-[9px] text-slate-400 mt-0.5">Specs : {parsedSearch.specs.fullConfiguration}</span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleInlineAdd(parsedSearch.category, parsedSearch.cleanModelName, parsedSearch.specs.fullConfiguration)}
            className="w-full flex items-center justify-center space-x-1.5 py-1.5 px-3 rounded bg-brand-purple hover:bg-[#3d0877] dark:bg-brand-lime dark:hover:opacity-90 text-white dark:text-slate-900 font-bold text-xs shadow transition-all cursor-pointer"
            id="btn-inline-quick-add"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Ajouter et surveiller en 1 clic</span>
          </button>
        </div>
      )}

      {searchQuery.trim().length >= 2 && searchSuggestions.length > 0 && (
        <div className="p-2.5 border-b border-[#DCDDE1] dark:border-slate-800 bg-[#F8F9FA] dark:bg-slate-800/40 text-[10px] shrink-0" id="search-suggestions-container">
          <span className="text-[#7F8C8D] dark:text-slate-400 font-bold uppercase tracking-wider block mb-1">
            💡 Modèles suggérés du marché ({searchSuggestions.length}) :
          </span>
          <div className="flex flex-wrap gap-1">
            {searchSuggestions.map(sug => (
              <button
                key={sug.name}
                type="button"
                onClick={() => handleInlineAdd(sug.category, sug.name)}
                className="px-2 py-0.5 rounded text-[10px] font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:border-brand-purple dark:hover:border-brand-lime text-slate-700 dark:text-slate-300 transition-colors cursor-pointer flex items-center space-x-1"
                title={`Ajouter ${sug.name} (${sug.category})`}
              >
                <span>+ {sug.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Model List */}
      <div className="flex-1 overflow-y-auto select-none divide-y divide-[#DCDDE1]" id="sidebar-categories">
        {filteredCategories.map(cat => {
          const isExpanded = expandedCategories[cat.categoryName] || searchQuery.length > 0;
          const hasModels = cat.models.length > 0;

          return (
            <div key={cat.categoryName} className="flex flex-col" id={`category-${cat.categoryName.replace(/\s+/g, '-').toLowerCase()}`}>
              {/* Category Header */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => toggleCategory(cat.categoryName)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggleCategory(cat.categoryName);
                  }
                }}
                className="w-full flex items-center justify-between px-3 py-2 bg-[#F1F2F6] dark:bg-slate-800 text-[10px] font-bold text-[#7F8C8D] dark:text-slate-400 uppercase tracking-widest border-b border-[#DCDDE1] dark:border-slate-700 hover:text-[#2D3436] dark:hover:text-slate-200 hover:bg-[#e4e5ea] dark:hover:bg-slate-700 transition-colors cursor-pointer"
                id={`btn-category-${cat.categoryName.replace(/\s+/g, '-').toLowerCase()}`}
              >
                <div className="flex items-center space-x-1.5">
                  {getCategoryIcon(cat.categoryName)}
                  <span>{cat.categoryName}</span>
                </div>
                <div className="flex items-center space-x-1 font-mono text-[9px] text-[#7F8C8D]">
                  {onScrapeModel && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        cat.models.forEach(model => {
                          onScrapeModel(model, false, cat.categoryName);
                        });
                      }}
                      className="p-1 hover:bg-slate-300 dark:hover:bg-slate-700 rounded transition text-slate-600 dark:text-slate-400 hover:text-slate-900 cursor-pointer flex items-center justify-center mr-1"
                      title={`Rafraîchir tous les modèles de ${cat.categoryName}`}
                    >
                      <RefreshCw className="w-3 h-3" />
                    </button>
                  )}
                  <span>{cat.models.length} MODEL</span>
                  <ChevronRight className={`w-3 h-3 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`} />
                </div>
              </div>

              {/* Models under category */}
              {isExpanded && hasModels && (
                <div className="bg-white flex flex-col" id={`category-models-${cat.categoryName.replace(/\s+/g, '-').toLowerCase()}`}>
                  {cat.models.map(model => {
                    const isSelected = selectedModel === model;
                    const evaluation = evaluations[model];
                    const hasData = !!evaluation && (evaluation.comparablesCount > 0 || evaluation.medianPrice > 0);

                    return (
                      <div
                        role="button"
                        tabIndex={0}
                        key={model}
                        onClick={() => onSelectModel(model, cat.categoryName)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onSelectModel(model, cat.categoryName);
                          }
                        }}
                        className={`w-full flex items-center justify-between px-4 py-2 border-b border-[#F1F2F6] dark:border-slate-800 text-xs text-left transition-all cursor-pointer ${
                          isSelected
                            ? "bg-brand-purple-light border-l-4 border-l-brand-purple dark:bg-brand-lime-light dark:border-l-brand-lime font-bold text-brand-purple dark:text-brand-lime"
                            : "text-[#1A1A1B] dark:text-slate-300 hover:bg-[#F1F2F6] dark:hover:bg-slate-800 border-l-4 border-l-transparent"
                        }`}
                        id={`btn-model-${model.replace(/\s+/g, '-').toLowerCase()}`}
                      >
                        <span className="truncate pr-2">{model}</span>
                        <div className="flex items-center space-x-1.5 shrink-0">
                          {onScrapeModel && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onScrapeModel(model, false, cat.categoryName);
                              }}
                              className={`p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer flex items-center justify-center ${
                                scrapingModels?.[model]?.isScraping ? "animate-spin text-brand-purple dark:text-brand-lime" : "text-slate-400 hover:text-slate-700"
                              }`}
                              title={`Rafraîchir le modèle ${model}`}
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {scrapingModels?.[model]?.isScraping ? (
                            <span className="text-[9px] font-mono font-bold text-brand-purple dark:text-brand-lime animate-pulse">
                              {scrapingModels[model].progress}%
                            </span>
                          ) : hasData ? (
                            <>
                              <span className={`text-[10px] font-mono font-bold ${
                                isSelected ? "text-brand-purple dark:text-brand-lime" : "text-[#2ECC71]"
                              }`}>
                                {evaluation.medianPrice.toFixed(0)}$
                              </span>
                              <span className={`text-[10px] font-mono font-bold ${isSelected ? "text-brand-purple dark:text-brand-lime" : "text-[#2ECC71]"}`}>✓</span>
                            </>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">--</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
