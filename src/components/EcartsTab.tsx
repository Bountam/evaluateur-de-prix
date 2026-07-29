import React from "react";
import { ModelEvaluation } from "../types";
import { TrendingUp, AlertTriangle } from "lucide-react";

interface EcartsTabProps {
  evaluations: Record<string, ModelEvaluation>;
}

export default function EcartsTab({ evaluations }: EcartsTabProps) {
  const modelsList = Object.values(evaluations);

  // Filter out models that have variance data
  const varianceModels = modelsList.map(item => {
    const history = item.historicalPrices || [];
    const currentPrice = item.medianPrice;
    
    // Get previous price
    let prevPrice = currentPrice;
    if (history.length > 0) {
      prevPrice = history[history.length - 1].price;
    }

    const diff = currentPrice - prevPrice;
    const percentage = prevPrice > 0 ? (diff / prevPrice) * 100 : 0;

    return {
      ...item,
      prevPrice,
      diff,
      percentage
    };
  });

  return (
    <div className="space-y-4 animate-fadeIn" id="ecarts-tab-container">
      {/* Introduction Card */}
      <div className="bg-white rounded-lg border border-[#DCDDE1] p-4 shadow-sm" id="ecarts-overview">
        <h3 className="text-xs font-bold text-[#2D3436] uppercase tracking-wider mb-1">Analyse des Écarts de Tarification</h3>
        <p className="text-[11px] text-[#7F8C8D] leading-relaxed">
          Ce tableau synthétise la fluctuation des prix médians recommandés par rapport au dernier relevé historique archivé. 
          Il permet à l'équipe de Luka Boutin d'observer les tendances baissières ou haussières du marché secondaire en un coup d'œil.
        </p>
      </div>

      {/* Grid Table */}
      <div className="bg-white rounded-lg border border-[#DCDDE1] shadow-sm overflow-hidden" id="ecarts-panel">
        <div className="px-4 py-3 bg-[#F1F2F6] border-b border-[#DCDDE1] flex justify-between items-center">
          <h3 className="text-xs font-bold text-[#2D3436] uppercase tracking-wider flex items-center space-x-2">
            <TrendingUp className="w-4 h-4 text-brand-purple dark:text-brand-lime" />
            <span>Matrice de Fluctuation des Valeurs Résiduelles</span>
          </h3>
        </div>

        <div className="overflow-x-auto" id="ecarts-table-container">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b bg-brand-purple border-brand-purple dark:bg-slate-800 dark:border-slate-800 text-white text-[10px] font-bold uppercase tracking-wider italic">
                <th className="py-2.5 px-3">CATÉGORIE</th>
                <th className="py-2.5 px-3">MODÈLE</th>
                <th className="py-2.5 px-3 w-32 text-right">PRIX MÉDIAN ACTUEL</th>
                <th className="py-2.5 px-3 w-32 text-right">PRIX ANTERIEUR</th>
                <th className="py-2.5 px-3 w-28 text-right">ÉCART ABSOLU</th>
                <th className="py-2.5 px-3 w-28 text-right">ÉCART (%)</th>
                <th className="py-2.5 px-3 w-32 text-center">TENDANCE ACTUELLE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F2F6]">
              {varianceModels.map((item, index) => {
                const isStable = Math.abs(item.diff) < 0.01;
                const isUp = item.diff > 0;

                return (
                  <tr 
                    key={item.modelName} 
                    className={`hover:bg-[#F1F2F6]/60 transition-colors ${
                      index % 2 === 0 ? "bg-white" : "bg-[#F8F9FA]"
                    }`}
                    id={`row-ecart-${item.modelName.replace(/\s+/g, "-")}`}
                  >
                    {/* Category */}
                    <td className="py-3 px-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-brand-purple dark:text-brand-lime font-mono">
                        {item.category}
                      </span>
                    </td>

                    {/* Model Name */}
                    <td className="py-3 px-3 font-bold text-[#2D3436]">{item.modelName}</td>

                    {/* Current Median Price */}
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                      {item.medianPrice.toFixed(2)}$
                    </td>

                    {/* Previous Price */}
                    <td className="py-3 px-3 text-right font-mono text-slate-600">
                      {item.prevPrice.toFixed(2)}$
                    </td>

                    {/* Absolute difference */}
                    <td className={`py-3 px-3 text-right font-mono font-semibold ${
                      isStable ? "text-slate-500" : isUp ? "text-emerald-600" : "text-rose-600"
                    }`}>
                      {isStable ? "0.00$" : `${isUp ? "+" : ""}${item.diff.toFixed(2)}$`}
                    </td>

                    {/* Relative variance percentage */}
                    <td className={`py-3 px-3 text-right font-mono font-bold ${
                      isStable ? "text-slate-500" : isUp ? "text-emerald-600" : "text-rose-600"
                    }`}>
                      {isStable ? "0.0%" : `${isUp ? "+" : ""}${item.percentage.toFixed(1)}%`}
                    </td>

                    {/* Visual trend badge */}
                    <td className="py-3 px-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                        isStable 
                          ? "bg-slate-100 text-slate-500 border border-slate-200" 
                          : isUp 
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200" 
                          : "bg-rose-50 text-rose-700 border border-rose-200"
                      }`}>
                        {isStable ? "Stable" : isUp ? "▲ HAUSSE" : "▼ BAISSE"}
                      </span>
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
