import React from "react";
import { ExternalLink, ShoppingBag, FileText, TrendingUp, Info } from "lucide-react";

interface GcsurplusTabProps {
  lots: any[];
  organization?: { name?: string; logoUrl?: string; tagline?: string };
}

export default function GcsurplusTab({ lots, organization }: GcsurplusTabProps) {
  // Calculate aggregate stats
  const activeLotsCount = lots.length;
  const totalQuantity = lots.reduce((acc, curr) => acc + (curr.quantity || 0), 0);
  const totalBidsVal = lots.reduce((acc, curr) => acc + (curr.currentBid || 0), 0);
  const averageUnitCost = totalQuantity > 0 ? totalBidsVal / totalQuantity : 0;

  return (
    <div className="space-y-4 animate-fadeIn" id="gcsurplus-tab-container">
      {/* Alert info banner */}
      <div className="p-3.5 bg-[#F1F2F6] border border-[#DCDDE1] rounded-lg text-slate-700 text-xs flex items-start space-x-3" id="gcsurplus-info-banner">
        <Info className="w-4 h-4 text-brand-purple dark:text-brand-lime shrink-0 mt-0.5" />
        <div>
          <h4 className="font-bold text-[#2D3436] uppercase tracking-wide">Accès d'Approvisionnement en Lots {organization?.name ? `(${organization.name})` : ""}</h4>
          <p className="text-[11px] text-[#7F8C8D] mt-0.5">
            Ce tableau affiche les lots gouvernementaux canadiens de matériel informatique en cours d'adjudication sur <strong>GCSurplus</strong>. 
            Les prix unitaires calculés constituent des indices d'achat en gros essentiels pour calibrer nos seuils d'acquisition.
          </p>
        </div>
      </div>

      {/* Aggregate Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" id="gcsurplus-aggregate-stats">
        <div className="bg-white border border-[#DCDDE1] rounded-lg p-3.5 shadow-sm">
          <span className="text-[10px] font-bold text-[#7F8C8D] uppercase tracking-wider font-mono">Lots Actifs Surveillés</span>
          <div className="text-2xl font-mono font-bold text-slate-900 mt-1">{activeLotsCount} lots</div>
        </div>

        <div className="bg-white border border-[#DCDDE1] rounded-lg p-3.5 shadow-sm">
          <span className="text-[10px] font-bold text-[#7F8C8D] uppercase tracking-wider font-mono">Volume Total d'Unités</span>
          <div className="text-2xl font-mono font-bold text-slate-900 mt-1">{totalQuantity} unités</div>
        </div>

        <div className="bg-white border border-[#DCDDE1] rounded-lg p-3.5 shadow-sm">
          <span className="text-[10px] font-bold text-[#7F8C8D] uppercase tracking-wider font-mono">Coût Unitaire Estimé (Gros)</span>
          <div className="text-2xl font-mono font-bold text-brand-purple dark:text-brand-lime mt-1">{averageUnitCost.toFixed(2)}$ <span className="text-xs text-slate-400 font-normal">/ unit</span></div>
        </div>
      </div>

      {/* Lots Table */}
      <div className="bg-white rounded-lg border border-[#DCDDE1] shadow-sm overflow-hidden" id="gcsurplus-lots-panel">
        <div className="px-4 py-3 bg-[#F1F2F6] border-b border-[#DCDDE1] flex justify-between items-center">
          <h3 className="text-xs font-bold text-[#2D3436] uppercase tracking-wider flex items-center space-x-2">
            <ShoppingBag className="w-4 h-4 text-brand-purple dark:text-brand-lime" />
            <span>Registre des Enchères Actives GCSurplus</span>
          </h3>
        </div>

        <div className="overflow-x-auto" id="gcsurplus-table-container">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b bg-brand-purple border-brand-purple dark:bg-slate-800 dark:border-slate-800 text-white text-[10px] font-bold uppercase tracking-wider italic">
                <th className="py-2.5 px-3 w-28">N° LOT</th>
                <th className="py-2.5 px-3">DESCRIPTION</th>
                <th className="py-2.5 px-3 w-20 text-center">QUANTITÉ</th>
                <th className="py-2.5 px-3 w-32 text-right">MISES ACTUELLES</th>
                <th className="py-2.5 px-3 w-32 text-right text-brand-purple dark:text-brand-lime">PRIX UNITAIRE BRUT</th>
                <th className="py-2.5 px-3 w-28 text-right">FERMETURE</th>
                <th className="py-2.5 px-3 w-16 text-center">LIEN</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F2F6]">
              {lots.map((lot, index) => {
                const unitPrice = lot.quantity > 0 ? lot.currentBid / lot.quantity : 0;
                return (
                  <tr 
                    key={lot.id} 
                    className={`hover:bg-[#F1F2F6]/60 transition-colors ${
                      index % 2 === 0 ? "bg-white" : "bg-[#F8F9FA]"
                    }`}
                    id={`gcsurplus-row-${lot.id}`}
                  >
                    {/* Lot ID */}
                    <td className="py-3 px-3 font-mono font-bold text-slate-800">{lot.lotNumber}</td>
                    
                    {/* Description */}
                    <td className="py-3 px-3">
                      <div className="font-medium text-slate-900">{lot.title}</div>
                      <div className="text-[10px] text-[#7F8C8D] mt-0.5">Localisation : {lot.location}</div>
                    </td>

                    {/* Quantity */}
                    <td className="py-3 px-3 text-center font-mono font-bold text-slate-700">{lot.quantity}</td>

                    {/* Current Bid */}
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                      {lot.currentBid.toFixed(2)}$ <span className="text-[9px] text-slate-400">CAD</span>
                    </td>

                    {/* Unit Price computed */}
                    <td className="py-3 px-3 text-right font-mono font-bold text-brand-purple dark:text-brand-lime">
                      {unitPrice.toFixed(2)}$ <span className="text-[9px] text-slate-400">CAD</span>
                    </td>

                    {/* Closing Date */}
                    <td className="py-3 px-3 text-right text-[10px] font-mono text-[#7F8C8D]">{lot.closingDate}</td>

                    {/* Government Direct Proof URL */}
                    <td className="py-3 px-3 text-center">
                      <a 
                        href={lot.url} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        referrerPolicy="no-referrer"
                        className="inline-flex p-1.5 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-900 transition"
                        title="Ouvrir la fiche d'enchère gouvernementale d'origine"
                        id={`gcsurplus-link-${lot.id}`}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
