import React from "react";
import { ExternalLink } from "lucide-react";
import { ComparableListing } from "../../types";
import { SortColumn, SortOrder } from "./types";
import HelpTooltip from "../common/HelpTooltip";
import { HELP_CONTENT } from "../../constants/helpContent";
import {
  getAnomalyReason,
  getScreenSize,
  getOs,
  hasWarranty,
  isLotItem
} from "./utils";

interface ListingTableProps {
  listings: ComparableListing[];
  medianPrice: number;
  sortBy: SortColumn;
  sortOrder: SortOrder;
  onSortChange: (column: 'price' | 'date' | 'source') => void;
  onToggleInclude: (listing: ComparableListing) => void;
  editingPriceId: string | null;
  tempPrice: string;
  onPriceEditStart: (listing: ComparableListing) => void;
  onPriceEditChange: (val: string) => void;
  onPriceEditSave: (listingId: string) => void;
  onQuickFilter: (filterKey: string, value: string) => void;
  hasFilterActive: boolean;
}

export const ListingTable: React.FC<ListingTableProps> = ({
  listings,
  medianPrice,
  sortBy,
  sortOrder,
  onSortChange,
  onToggleInclude,
  editingPriceId,
  tempPrice,
  onPriceEditStart,
  onPriceEditChange,
  onPriceEditSave,
  onQuickFilter,
  hasFilterActive,
}) => {
  return (
    <div className="overflow-x-auto" id="listings-table-container">
      <table className="w-full text-left border-collapse text-xs">
        <thead>
          <tr className="bg-slate-100 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 text-xs font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
            <th className="py-2.5 px-3 w-16 text-center border-r border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-center space-x-1">
                <span>SEL</span>
                <HelpTooltip topic={HELP_CONTENT.colIncluded} size="xs" side="bottom" id="thColIncluded" />
              </div>
            </th>
            
            {/* Colonne SOURCE cliquable pour le tri */}
            <th 
              onClick={() => onSortChange('source')}
              className="py-2.5 px-3 w-36 border-r border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-700/60 select-none transition"
              title="Cliquer pour trier par source (A-Z / Z-A)"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1">
                  <span>SOURCE</span>
                  <HelpTooltip topic={HELP_CONTENT.colSource} size="xs" side="bottom" id="thColSource" />
                </div>
                <span className="text-[10px] text-slate-400">{sortBy === 'source' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}</span>
              </div>
            </th>

            <th className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <span>DESCRIPTION DE L'ANNONCE</span>
                <HelpTooltip topic={HELP_CONTENT.colStatus} size="xs" side="bottom" id="thColStatus" />
              </div>
            </th>
            
            {/* Colonne DATE cliquable pour le tri */}
            <th 
              onClick={() => onSortChange('date')}
              className="py-2.5 px-3 w-28 text-right border-r border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-700/60 select-none transition"
              title="Cliquer pour trier par date (Récente / Ancienne)"
            >
              <div className="flex items-center justify-end space-x-1">
                <span>DATE</span>
                <span className="text-[10px] text-slate-400">{sortBy === 'date' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}</span>
              </div>
            </th>

            {/* Colonne PRIX cliquable pour le tri */}
            <th 
              onClick={() => onSortChange('price')}
              className="py-2.5 px-3 w-36 text-right text-brand-purple dark:text-brand-lime border-r border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-700/60 select-none transition"
              title="Cliquer pour trier par prix (Plus bas / Plus élevé)"
            >
              <div className="flex items-center justify-end space-x-1">
                <span>PRIX (CAD)</span>
                <span className="text-[10px] text-slate-400">{sortBy === 'price' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}</span>
                <HelpTooltip topic={HELP_CONTENT.colPrice} size="xs" side="bottom" id="thColPrice" />
              </div>
            </th>

            <th className="py-2.5 px-3 w-12 text-center">LIEN</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#F1F2F6]">
          {listings.length === 0 ? (
            <tr>
              <td colSpan={6} className="py-12 text-center text-slate-400 text-xs italic">
                Aucun comparable trouvé pour ces critères. {hasFilterActive ? "Veuillez modifier ou effacer votre filtre." : "Veuillez réinitialiser vos filtres ou cliquer sur \"Collecte Multi-Sources\"."}
              </td>
            </tr>
          ) : (
            listings.map((listing, index) => {
              const isOutlier = listing.isOutlier;
              const isEditing = editingPriceId === listing.id;

              return (
                <tr 
                  key={listing.id} 
                  className={`hover:bg-[#F1F2F6]/60 dark:hover:bg-slate-800/50 transition-colors ${
                    !listing.included 
                      ? (isOutlier ? "bg-rose-50/30 dark:bg-rose-950/20 text-slate-450 dark:text-slate-400" : "bg-slate-100/40 dark:bg-slate-800/30 text-slate-450 dark:text-slate-400 line-through")
                      : (index % 2 === 0 ? "bg-white dark:bg-slate-900/10" : "bg-[#F8F9FA] dark:bg-slate-800/5")
                  }`}
                  id={`row-listing-${listing.id}`}
                >
                  {/* Checkbox */}
                  <td className="py-2 px-3 text-center border-r border-[#F1F2F6] dark:border-slate-800">
                    <input
                      type="checkbox"
                      checked={listing.included}
                      onChange={() => onToggleInclude(listing)}
                      className="w-3.5 h-3.5 text-brand-purple dark:text-brand-lime border-slate-300 dark:border-slate-700 rounded focus:ring-amber-500 cursor-pointer"
                      id={`checkbox-include-${listing.id}`}
                    />
                  </td>

                  {/* Source */}
                  <td className="py-2 px-3 font-bold border-r border-[#F1F2F6] relative">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold font-mono tracking-wide ${
                      String(listing.source).includes("eBay") ? "bg-blue-50 text-blue-800 border border-blue-100" :
                      String(listing.source).includes("Back Market") ? "bg-purple-50 text-purple-800 border border-purple-100" :
                      String(listing.source).includes("GCSurplus") ? "bg-emerald-50 text-emerald-800 border border-emerald-100" :
                      (String(listing.source).includes("Catalogue") || String(listing.source).includes("Archive") || String(listing.source).includes("Interne") || String(listing.source).includes("Insertech")) ? "bg-amber-50 text-amber-800 border border-amber-100" :
                      String(listing.source).includes("Amazon") ? "bg-orange-50 text-orange-800 border border-orange-100" :
                      String(listing.source).includes("BestBuy") ? "bg-blue-50 text-blue-800 border border-blue-100" :
                      String(listing.source).includes("Newegg") ? "bg-red-50 text-red-800 border border-red-100" :
                      String(listing.source).includes("Kijiji") ? "bg-indigo-50 text-indigo-800 border border-indigo-100" :
                      String(listing.source).includes("Facebook") ? "bg-cyan-50 text-cyan-800 border border-cyan-100" :
                      String(listing.source).includes("Dell") ? "bg-blue-50 text-blue-800 border border-blue-100" :
                      String(listing.source).includes("Lenovo") ? "bg-red-50 text-red-800 border border-red-100" :
                      String(listing.source).includes("HP") ? "bg-sky-50 text-sky-800 border border-sky-100" :
                      "bg-slate-50 text-slate-800 border border-slate-200"
                    }`}>
                      {listing.source}
                    </span>
                    {isOutlier && (
                      <span 
                        className="relative group inline-block ml-1.5 text-[8px] bg-rose-50 text-rose-600 border border-rose-200 px-1 py-0.5 rounded font-mono font-bold uppercase tracking-wider cursor-help"
                        id={`badge-anomalie-${listing.id}`}
                      >
                        Anomalie ⚠️
                        <span className="pointer-events-none absolute bottom-full left-0 mb-1.5 hidden group-hover:block w-64 bg-slate-950 dark:bg-slate-900 text-white dark:text-slate-100 text-[10px] font-sans font-medium normal-case tracking-normal p-2.5 rounded shadow-xl border border-slate-800 z-50 text-left leading-normal">
                          {getAnomalyReason(listing, medianPrice)}
                        </span>
                      </span>
                    )}
                  </td>

                  {/* Title & Granular Specs Badges */}
                  <td className="py-2 px-3 max-w-xs md:max-w-md border-r border-[#F1F2F6] dark:border-slate-800">
                    <div className={`truncate font-medium ${listing.included ? "text-[#1A1A1B] dark:text-slate-200" : "text-slate-450 dark:text-slate-500"}`} title={listing.title}>
                      {listing.title}
                    </div>
                    
                    {/* Badges d'étiquettes cliquables */}
                    <div className="flex flex-wrap gap-1 mt-1 text-[9px] font-mono">
                      {listing.specs?.year && (
                        <button
                          type="button"
                          onClick={() => {
                            const y = parseInt(listing.specs?.year || "0");
                            if (y >= 2023) onQuickFilter("year", "2023+");
                            else if (y === 2021 || y === 2022) onQuickFilter("year", "2021-2022");
                            else if (y <= 2020 && y > 0) onQuickFilter("year", "2020 ou -");
                          }}
                          title="Cliquer pour filtrer par cette période"
                          className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                        >
                          📅 {listing.specs.year}
                        </button>
                      )}
                      {listing.specs?.cpu && (
                        <button
                          type="button"
                          onClick={() => {
                            const c = listing.specs?.cpu?.toLowerCase() || "";
                            if (c.includes("i5")) onQuickFilter("cpu", "Core i5");
                            else if (c.includes("i7")) onQuickFilter("cpu", "Core i7");
                            else if (c.includes("i9")) onQuickFilter("cpu", "Core i9");
                            else if (c.includes("ryzen")) onQuickFilter("cpu", "Ryzen");
                            else if (c.includes("m1") || c.includes("m2") || c.includes("m3")) onQuickFilter("cpu", "Apple M");
                          }}
                          title="Cliquer pour filtrer par ce processeur"
                          className="bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900 transition-colors cursor-pointer"
                        >
                          ⚡ {listing.specs.cpu}
                        </button>
                      )}
                      {listing.specs?.ram && (
                        <button
                          type="button"
                          onClick={() => {
                            const r = listing.specs?.ram || "";
                            if (r.includes("8")) onQuickFilter("ram", "8 Go");
                            else if (r.includes("16")) onQuickFilter("ram", "16 Go");
                            else if (r.includes("32") || r.includes("64")) onQuickFilter("ram", "32 Go+");
                          }}
                          title="Cliquer pour filtrer par cette mémoire RAM"
                          className="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-colors cursor-pointer"
                        >
                          💾 {listing.specs.ram}
                        </button>
                      )}
                      {listing.specs?.storage && (
                        <button
                          type="button"
                          onClick={() => {
                            const s = listing.specs?.storage?.toLowerCase() || "";
                            if (s.includes("256")) onQuickFilter("storage", "256 Go");
                            else if (s.includes("512")) onQuickFilter("storage", "512 Go");
                            else if (s.includes("1 to") || s.includes("1tb") || s.includes("2 to") || s.includes("2tb")) onQuickFilter("storage", "1 To+");
                          }}
                          title="Cliquer pour filtrer par ce stockage SSD"
                          className="bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900 transition-colors cursor-pointer"
                        >
                          💽 {listing.specs.storage}
                        </button>
                      )}

                      {/* Badge Écran */}
                      {getScreenSize(listing) && (
                        <button
                          type="button"
                          onClick={() => {
                            const sz = getScreenSize(listing);
                            if (sz === '14"') onQuickFilter("screenSize", '14"');
                            else if (sz === '15.6"' || sz === '15"') onQuickFilter("screenSize", '15-15.6"');
                            else if (sz === '13.3"' || sz === '13"') onQuickFilter("screenSize", '13-13.3"');
                            else if (sz === '11.6"' || sz === '12.5"') onQuickFilter("screenSize", '11-12"');
                            else onQuickFilter("screenSize", '16-17"+');
                          }}
                          title="Cliquer pour filtrer par cette taille d'écran"
                          className="bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 px-1.5 py-0.5 rounded border border-sky-200 dark:border-sky-800 hover:bg-sky-100 dark:hover:bg-sky-900 transition-colors cursor-pointer"
                        >
                          🖥️ {getScreenSize(listing)}
                        </button>
                      )}

                      {/* Badge OS */}
                      {getOs(listing) && (
                        <button
                          type="button"
                          onClick={() => {
                            const osVal = getOs(listing);
                            if (osVal === "Windows 11 Pro") onQuickFilter("os", "Win 11 Pro");
                            else if (osVal === "Windows 11 Familial") onQuickFilter("os", "Win 11 Home");
                            else if (osVal === "Windows 10 Pro") onQuickFilter("os", "Win 10 Pro");
                            else if (osVal === "Windows 10 Familial") onQuickFilter("os", "Win 10 Home");
                            else if (osVal === "macOS") onQuickFilter("os", "macOS");
                            else if (osVal === "ChromeOS") onQuickFilter("os", "ChromeOS");
                            else if (osVal === "No OS") onQuickFilter("os", "Sans OS / No OS");
                          }}
                          title="Cliquer pour filtrer par ce système d'exploitation"
                          className="bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded border border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900 transition-colors cursor-pointer"
                        >
                          🪟 {getOs(listing)}
                        </button>
                      )}

                      {/* Badge Garantie */}
                      {hasWarranty(listing) && (
                        <button
                          type="button"
                          onClick={() => onQuickFilter("warranty", "Avec garantie")}
                          title="Cliquer pour filtrer les annonces avec garantie"
                          className="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-colors cursor-pointer"
                        >
                          🛡️ Garantie
                        </button>
                      )}

                      {/* Badge Lot vs Unité */}
                      {isLotItem(listing) ? (
                        <button
                          type="button"
                          onClick={() => onQuickFilter("lot", "Lot")}
                          title="Cliquer pour filtrer les offres en lot"
                          className="bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 px-1.5 py-0.5 rounded border border-teal-200 dark:border-teal-800 hover:bg-teal-100 dark:hover:bg-teal-900 transition-colors cursor-pointer"
                        >
                          📦 Lot
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onQuickFilter("lot", "Unité")}
                          title="Cliquer pour filtrer les offres à l'unité"
                          className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                        >
                          👤 Unité
                        </button>
                      )}
                    </div>
                  </td>

                  {/* Date */}
                  <td className="py-2 px-3 text-right font-mono text-[10px] text-[#7F8C8D] border-r border-[#F1F2F6]">
                    {listing.date}
                  </td>

                  {/* Price (Editable on Double-Click or Click) */}
                  <td className="py-2 px-3 text-right border-r border-[#F1F2F6]">
                    {isEditing ? (
                      <div className="flex items-center justify-end space-x-1">
                        <input
                          type="text"
                          className="w-16 px-1.5 py-0.5 text-right font-mono text-[11px] border border-brand-purple dark:border-brand-lime rounded outline-none"
                          value={tempPrice}
                          onChange={(e) => onPriceEditChange(e.target.value)}
                          onBlur={() => onPriceEditSave(listing.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") onPriceEditSave(listing.id);
                          }}
                          autoFocus
                          id={`input-price-edit-${listing.id}`}
                        />
                        <span className="text-[10px] font-mono text-slate-500">CAD</span>
                      </div>
                    ) : (
                      <div
                        onDoubleClick={() => onPriceEditStart(listing)}
                        className="flex flex-col items-end space-y-0.5 cursor-pointer hover:bg-slate-200/80 dark:hover:bg-slate-800 px-2 py-0.5 rounded"
                        id={`price-display-${listing.id}`}
                      >
                        {/* Prix avant rabais (barré) */}
                        {listing.originalPrice && listing.originalPrice > listing.price && (
                          <span className="font-mono text-[9px] text-slate-400 dark:text-slate-500 line-through leading-none">
                            {listing.originalPrice.toFixed(2)}$
                          </span>
                        )}

                        {/* Prix final + badge rabais */}
                        <div className="flex items-center justify-end space-x-1">
                          {listing.discountPercent && listing.discountPercent >= 1 && (
                            <span className="text-[8px] font-bold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 px-1 py-px rounded font-mono leading-none">
                              -{listing.discountPercent.toFixed(0)}%
                            </span>
                          )}
                          <span
                            className={`font-mono font-bold text-xs ${
                              listing.included ? "text-[#1A1A1B] dark:text-slate-200" : "text-slate-450 dark:text-slate-500"
                            }`}
                            title={[
                              listing.currency && listing.exchangeRate
                                ? `Converti depuis ${listing.currency} · 1 ${listing.currency} = ${listing.exchangeRate.toFixed(4)} CAD`
                                : null,
                              listing.originalPrice && listing.originalPrice > listing.price
                                ? `Prix avant rabais : ${listing.originalPrice.toFixed(2)} $ → Rabais : ${listing.discountAmount?.toFixed(2) ?? "?"} $ (-${listing.discountPercent?.toFixed(1) ?? "?"}%)`
                                : null,
                              !listing.currency && !listing.originalPrice
                                ? "Double-cliquez pour corriger le prix"
                                : null,
                            ].filter(Boolean).join("\n") || "Double-cliquez pour corriger le prix"}
                          >
                            {listing.price.toFixed(2)}$
                          </span>
                        </div>
                      </div>
                    )}
                  </td>

                  {/* External Link */}
                  <td className="py-2 px-3 text-center">
                    <a
                      href={listing.url}
                      target="_blank"
                      rel="noopener"
                      className="inline-flex p-1 hover:bg-[#F1F2F6] rounded text-[#7F8C8D] hover:text-[#1A1A1B] transition"
                      title="Ouvrir la fiche d'origine (Preuve comptable)"
                      id={`link-proof-${listing.id}`}
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
};
