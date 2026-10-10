import React from "react";
import { ListingFilters } from "./types";

interface ListingFilterBarProps {
  filters: ListingFilters;
  onFilterChange: <K extends keyof ListingFilters>(key: K, value: ListingFilters[K]) => void;
  onResetFilters: () => void;
  availableSourcesList: string[];
  totalCount: number;
  filteredCount: number;
  showSourceSection: boolean;
  setShowSourceSection: (show: boolean) => void;
  showScreenOsSection: boolean;
  setShowScreenOsSection: (show: boolean) => void;
  showWarrantyLotSection: boolean;
  setShowWarrantyLotSection: (show: boolean) => void;
  showHardwareSection: boolean;
  setShowHardwareSection: (show: boolean) => void;
}

export const ListingFilterBar: React.FC<ListingFilterBarProps> = ({
  filters,
  onFilterChange,
  onResetFilters,
  availableSourcesList,
  totalCount,
  filteredCount,
  showSourceSection,
  setShowSourceSection,
  showScreenOsSection,
  setShowScreenOsSection,
  showWarrantyLotSection,
  setShowWarrantyLotSection,
  showHardwareSection,
  setShowHardwareSection,
}) => {
  const {
    ram: filterRam,
    cpu: filterCpu,
    storage: filterStorage,
    year: filterYear,
    source: filterSource,
    screenSize: filterScreenSize,
    os: filterOs,
    warranty: filterWarranty,
    lot: filterLot,
    specFilter
  } = filters;

  const activeFiltersCount = [
    filterRam !== "Toutes",
    filterCpu !== "Tous",
    filterStorage !== "Tous",
    filterYear !== "Toutes",
    filterSource !== "Toutes",
    filterScreenSize !== "Toutes",
    filterOs !== "Tous",
    filterWarranty !== "Toutes",
    filterLot !== "Tous",
    Boolean(specFilter)
  ].filter(Boolean).length;

  return (
    <div className="p-3.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 space-y-3">
      {/* Ligne 1 : Recherche mot-clé & Boutons d'accès aux 4 volets repliables */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Recherche Mot-clé (À gauche) */}
        <div className="relative flex items-center min-w-[150px] max-w-[240px] flex-1">
          <input
            type="text"
            placeholder="🔍 Rechercher par mot-clé..."
            value={specFilter}
            onChange={(e) => onFilterChange("specFilter", e.target.value)}
            className="w-full pl-3 pr-7 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-brand-purple font-medium shadow-inner"
          />
          {specFilter && (
            <button onClick={() => onFilterChange("specFilter", "")} className="absolute right-2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer">
              ✕
            </button>
          )}
        </div>

        {/* Bouton Volet 1 : Sources (16 Connecteurs) */}
        <button
          type="button"
          onClick={() => setShowSourceSection(!showSourceSection)}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition border cursor-pointer ${
            filterSource !== "Toutes" || showSourceSection
              ? "bg-brand-purple text-white border-brand-purple dark:bg-brand-lime dark:text-slate-950 dark:border-brand-lime shadow-sm"
              : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-200"
          }`}
        >
          <span>🏪 Sources ({filterSource === "Toutes" ? "Toutes" : filterSource})</span>
          <span className="text-[10px]">{showSourceSection ? "▲" : "▼"}</span>
        </button>

        {/* Bouton Volet 2 : Écran & OS */}
        <button
          type="button"
          onClick={() => setShowScreenOsSection(!showScreenOsSection)}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition border cursor-pointer ${
            filterScreenSize !== "Toutes" || filterOs !== "Tous" || showScreenOsSection
              ? "bg-sky-600 text-white border-sky-600 dark:bg-sky-500 dark:text-slate-950 shadow-sm"
              : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-200"
          }`}
        >
          <span>🖥️ Écran & OS</span>
          {(filterScreenSize !== "Toutes" || filterOs !== "Tous") && (
            <span className="w-2 h-2 rounded-full bg-white animate-ping"></span>
          )}
          <span className="text-[10px]">{showScreenOsSection ? "▲" : "▼"}</span>
        </button>

        {/* Bouton Volet 3 : Garantie & Format Vente */}
        <button
          type="button"
          onClick={() => setShowWarrantyLotSection(!showWarrantyLotSection)}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition border cursor-pointer ${
            filterWarranty !== "Toutes" || filterLot !== "Tous" || showWarrantyLotSection
              ? "bg-emerald-600 text-white border-emerald-600 dark:bg-emerald-500 dark:text-slate-950 shadow-sm"
              : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-200"
          }`}
        >
          <span>🛡️ Garantie & Vente</span>
          {(filterWarranty !== "Toutes" || filterLot !== "Tous") && (
            <span className="w-2 h-2 rounded-full bg-white animate-ping"></span>
          )}
          <span className="text-[10px]">{showWarrantyLotSection ? "▲" : "▼"}</span>
        </button>

        {/* Bouton Volet 4 : Hardware (RAM, CPU, SSD, Année) */}
        <button
          type="button"
          onClick={() => setShowHardwareSection(!showHardwareSection)}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition border cursor-pointer ${
            filterRam !== "Toutes" || filterCpu !== "Tous" || filterStorage !== "Tous" || filterYear !== "Toutes" || showHardwareSection
              ? "bg-purple-600 text-white border-purple-600 dark:bg-purple-500 dark:text-slate-950 shadow-sm"
              : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-200"
          }`}
        >
          <span>⚙️ Specs (RAM, CPU, SSD)</span>
          {(filterRam !== "Toutes" || filterCpu !== "Tous" || filterStorage !== "Tous" || filterYear !== "Toutes") && (
            <span className="w-2 h-2 rounded-full bg-white animate-ping"></span>
          )}
          <span className="text-[10px]">{showHardwareSection ? "▲" : "▼"}</span>
        </button>
      </div>

      {/* VOLET 1 : Sélection des 16 Sources (Repliable) */}
      {showSourceSection && (
        <div className="p-3 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2 animate-fadeIn">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">🏪 Filtrer par Source de Données (16 Connecteurs) :</span>
            <button onClick={() => setShowSourceSection(false)} className="text-xs text-slate-400 hover:text-slate-600">Masquer ✕</button>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {availableSourcesList.map(srcName => (
              <button
                key={srcName}
                type="button"
                onClick={() => onFilterChange("source", srcName)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  filterSource === srcName
                    ? "bg-brand-purple text-white shadow-sm dark:bg-brand-lime dark:text-slate-950"
                    : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                }`}
              >
                {srcName}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* VOLET 2 : Écran & Système OS (Repliable) */}
      {showScreenOsSection && (
        <div className="p-3 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-700 grid grid-cols-1 md:grid-cols-2 gap-3 animate-fadeIn">
          {/* Écran Pills */}
          <div className="flex flex-col space-y-1.5">
            <span className="text-xs font-bold text-sky-700 dark:text-sky-400">🖥️ Taille d'Écran :</span>
            <div className="flex flex-wrap items-center gap-1">
              {["Toutes", '11-12"', '13-13.3"', '14"', '15-15.6"', '16-17"+'].map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => onFilterChange("screenSize", opt)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    filterScreenSize === opt
                      ? "bg-sky-600 text-white shadow-sm"
                      : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 border border-slate-200 dark:border-slate-700"
                  }`}
                >
                  {opt === "Toutes" ? "Toutes les tailles" : opt}
                </button>
              ))}
            </div>
          </div>

          {/* OS Pills */}
          <div className="flex flex-col space-y-1.5">
            <span className="text-xs font-bold text-indigo-700 dark:text-indigo-400">🪟 Système d'Exploitation (OS) :</span>
            <div className="flex flex-wrap items-center gap-1">
              {["Tous", "Win 11 Pro", "Win 11 Home", "Win 10 Pro", "Win 10 Home", "macOS", "ChromeOS", "Sans OS / No OS"].map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => onFilterChange("os", opt)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    filterOs === opt
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 border border-slate-200 dark:border-slate-700"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* VOLET 3 : Garantie & Format Vente (Repliable) */}
      {showWarrantyLotSection && (
        <div className="p-3 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-700 grid grid-cols-1 md:grid-cols-2 gap-3 animate-fadeIn">
          {/* Garantie Pills */}
          <div className="flex flex-col space-y-1.5">
            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">🛡️ Option Garantie :</span>
            <div className="flex flex-wrap items-center gap-1">
              {["Toutes", "Avec garantie", "Sans garantie mentionnée"].map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => onFilterChange("warranty", opt)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    filterWarranty === opt
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 border border-slate-200 dark:border-slate-700"
                  }`}
                >
                  {opt === "Toutes" ? "Toutes les offres" : opt === "Avec garantie" ? "🛡️ Avec garantie incluse" : "Sans mention de garantie"}
                </button>
              ))}
            </div>
          </div>

          {/* Vente Pills */}
          <div className="flex flex-col space-y-1.5">
            <span className="text-xs font-bold text-teal-700 dark:text-teal-400">📦 Format de Vente :</span>
            <div className="flex flex-wrap items-center gap-1">
              {["Tous", "Unité", "Lot"].map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => onFilterChange("lot", opt)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    filterLot === opt
                      ? "bg-teal-600 text-white shadow-sm"
                      : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 border border-slate-200 dark:border-slate-700"
                  }`}
                >
                  {opt === "Tous" ? "Tous les formats" : opt === "Unité" ? "💻 Vente à l'unité" : "📦 Vente en lot"}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* VOLET 4 : Hardware (RAM, CPU, SSD, Année) (Repliable) */}
      {showHardwareSection && (
        <div className="p-3 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-700 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 animate-fadeIn">
          {/* RAM Pills */}
          <div className="flex flex-col space-y-1.5">
            <span className="text-xs font-bold text-purple-700 dark:text-purple-400">💾 Mémoire RAM :</span>
            <div className="flex flex-wrap items-center gap-1">
              {["Toutes", "8 Go", "16 Go", "32 Go+"].map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => onFilterChange("ram", opt)}
                  className={`px-2 py-0.5 rounded text-xs font-bold transition cursor-pointer ${
                    filterRam === opt
                      ? "bg-purple-600 text-white shadow-sm"
                      : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 border border-slate-200 dark:border-slate-700"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* CPU Pills */}
          <div className="flex flex-col space-y-1.5">
            <span className="text-xs font-bold text-blue-700 dark:text-blue-400">⚡ Processeur CPU :</span>
            <div className="flex flex-wrap items-center gap-1">
              {["Tous", "Core i5", "Core i7", "Core i9", "Ryzen", "Apple M"].map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => onFilterChange("cpu", opt)}
                  className={`px-2 py-0.5 rounded text-xs font-bold transition cursor-pointer ${
                    filterCpu === opt
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 border border-slate-200 dark:border-slate-700"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* SSD Pills */}
          <div className="flex flex-col space-y-1.5">
            <span className="text-xs font-bold text-amber-700 dark:text-amber-400">💽 Stockage SSD :</span>
            <div className="flex flex-wrap items-center gap-1">
              {["Tous", "256 Go", "512 Go", "1 To+"].map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => onFilterChange("storage", opt)}
                  className={`px-2 py-0.5 rounded text-xs font-bold transition cursor-pointer ${
                    filterStorage === opt
                      ? "bg-amber-600 text-white shadow-sm"
                      : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 border border-slate-200 dark:border-slate-700"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* Année Pills */}
          <div className="flex flex-col space-y-1.5">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">📅 Année :</span>
            <div className="flex flex-wrap items-center gap-1">
              {["Toutes", "2023+", "2021-2022", "2020 ou -"].map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => onFilterChange("year", opt)}
                  className={`px-2 py-0.5 rounded text-xs font-bold transition cursor-pointer ${
                    filterYear === opt
                      ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 shadow-sm"
                      : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 border border-slate-200 dark:border-slate-700"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Ligne des Filtres Actifs (Active Filter Chips) */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800 animate-fadeIn">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mr-1">Filtres actifs :</span>

          {filterSource !== "Toutes" && (
            <span className="inline-flex items-center space-x-1 bg-brand-purple/10 text-brand-purple dark:bg-brand-lime/20 dark:text-brand-lime px-2 py-0.5 rounded-md text-xs font-semibold border border-brand-purple/20 dark:border-brand-lime/30">
              <span>🏪 {filterSource}</span>
              <button onClick={() => onFilterChange("source", "Toutes")} className="hover:text-rose-500 font-bold ml-1 font-mono">✕</button>
            </span>
          )}

          {filterScreenSize !== "Toutes" && (
            <span className="inline-flex items-center space-x-1 bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 px-2 py-0.5 rounded-md text-xs font-semibold border border-sky-200 dark:border-sky-800">
              <span>🖥️ Écran : {filterScreenSize}</span>
              <button onClick={() => onFilterChange("screenSize", "Toutes")} className="hover:text-rose-500 font-bold ml-1 font-mono">✕</button>
            </span>
          )}

          {filterOs !== "Tous" && (
            <span className="inline-flex items-center space-x-1 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 px-2 py-0.5 rounded-md text-xs font-semibold border border-indigo-200 dark:border-indigo-800">
              <span>🪟 OS : {filterOs}</span>
              <button onClick={() => onFilterChange("os", "Tous")} className="hover:text-rose-500 font-bold ml-1 font-mono">✕</button>
            </span>
          )}

          {filterWarranty !== "Toutes" && (
            <span className="inline-flex items-center space-x-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 px-2 py-0.5 rounded-md text-xs font-semibold border border-emerald-200 dark:border-emerald-800">
              <span>🛡️ {filterWarranty}</span>
              <button onClick={() => onFilterChange("warranty", "Toutes")} className="hover:text-rose-500 font-bold ml-1 font-mono">✕</button>
            </span>
          )}

          {filterLot !== "Tous" && (
            <span className="inline-flex items-center space-x-1 bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300 px-2 py-0.5 rounded-md text-xs font-semibold border border-teal-200 dark:border-teal-800">
              <span>📦 Vente : {filterLot}</span>
              <button onClick={() => onFilterChange("lot", "Tous")} className="hover:text-rose-500 font-bold ml-1 font-mono">✕</button>
            </span>
          )}

          {filterRam !== "Toutes" && (
            <span className="inline-flex items-center space-x-1 bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 px-2 py-0.5 rounded-md text-xs font-semibold border border-purple-200 dark:border-purple-800">
              <span>💾 RAM : {filterRam}</span>
              <button onClick={() => onFilterChange("ram", "Toutes")} className="hover:text-rose-500 font-bold ml-1 font-mono">✕</button>
            </span>
          )}

          {filterCpu !== "Tous" && (
            <span className="inline-flex items-center space-x-1 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 px-2 py-0.5 rounded-md text-xs font-semibold border border-blue-200 dark:border-blue-800">
              <span>⚡ CPU : {filterCpu}</span>
              <button onClick={() => onFilterChange("cpu", "Tous")} className="hover:text-rose-500 font-bold ml-1 font-mono">✕</button>
            </span>
          )}

          {filterStorage !== "Tous" && (
            <span className="inline-flex items-center space-x-1 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 px-2 py-0.5 rounded-md text-xs font-semibold border border-amber-200 dark:border-amber-800">
              <span>💽 SSD : {filterStorage}</span>
              <button onClick={() => onFilterChange("storage", "Tous")} className="hover:text-rose-500 font-bold ml-1 font-mono">✕</button>
            </span>
          )}

          {filterYear !== "Toutes" && (
            <span className="inline-flex items-center space-x-1 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 px-2 py-0.5 rounded-md text-xs font-semibold border border-slate-200 dark:border-slate-700">
              <span>📅 Année : {filterYear}</span>
              <button onClick={() => onFilterChange("year", "Toutes")} className="hover:text-rose-500 font-bold ml-1 font-mono">✕</button>
            </span>
          )}

          {specFilter && (
            <span className="inline-flex items-center space-x-1 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 px-2 py-0.5 rounded-md text-xs font-semibold border border-slate-200 dark:border-slate-700">
              <span>🔍 "{specFilter}"</span>
              <button onClick={() => onFilterChange("specFilter", "")} className="hover:text-rose-500 font-bold ml-1 font-mono">✕</button>
            </span>
          )}

          <button
            onClick={onResetFilters}
            className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline ml-2 cursor-pointer"
          >
            Tout effacer
          </button>

          <div className="ml-auto text-xs text-slate-500 dark:text-slate-400 font-mono font-medium">
            <strong>{filteredCount}</strong> / {totalCount} comparables trouvés
          </div>
        </div>
      )}
    </div>
  );
};
