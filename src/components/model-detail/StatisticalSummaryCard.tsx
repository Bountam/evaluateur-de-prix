import React from "react";
import { HelpCircle, TrendingUp } from "lucide-react";
import { ModelEvaluation } from "../../types";
import { ModelDetailHeader } from "./ModelDetailHeader";
import { PriceTrendSparkline } from "./PriceTrendSparkline";

interface StatisticalSummaryCardProps {
  modelName: string;
  category: string;
  evaluation: ModelEvaluation | null;
}

export const StatisticalSummaryCard: React.FC<StatisticalSummaryCardProps> = ({
  modelName,
  category,
  evaluation,
}) => {
  return (
    <div className="bg-white rounded-lg border border-[#DCDDE1] p-4 shadow-sm" id="model-summary-card">
      <ModelDetailHeader modelName={modelName} category={category} />

      {/* Dashboard Stats */}
      {evaluation ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 border-t border-[#DCDDE1] pt-4 mt-4" id="model-stats-grid">
          {/* Median Card */}
          <div className="bg-[#F8F9FA] rounded border border-[#DCDDE1] p-3 flex flex-col justify-between">
            <span className="text-[10px] font-bold text-[#7F8C8D] uppercase flex items-center space-x-1">
              <span>Prix Médian Recommandé</span>
              <HelpCircle className="w-3 h-3 text-[#7F8C8D] cursor-help" title="La médiane élimine l'effet des annonces extrêmes." />
            </span>
            <div className="flex items-baseline space-x-1.5 mt-1">
              <span className="text-xl font-bold text-[#2D3436] font-mono">
                {evaluation.medianPrice > 0 ? evaluation.medianPrice.toFixed(2) : "À évaluer"}
              </span>
              {evaluation.medianPrice > 0 && <span className="text-[10px] font-bold text-[#7F8C8D]">CAD</span>}
            </div>
          </div>

          {/* Comparables Count */}
          <div className="bg-[#F8F9FA] rounded border border-[#DCDDE1] p-3 flex flex-col justify-between">
            <span className="text-[10px] font-bold text-[#7F8C8D] uppercase">Comparables Validés</span>
            <div className="flex items-baseline space-x-1 mt-1">
              <span className="text-xl font-bold text-[#2D3436] font-mono">{evaluation.comparablesCount}</span>
              <span className="text-[10px] text-[#7F8C8D] font-bold ml-1 uppercase">actifs</span>
            </div>
          </div>

          {/* Last checked */}
          <div className="bg-[#F8F9FA] rounded border border-[#DCDDE1] p-3 flex flex-col justify-between">
            <span className="text-[10px] font-bold text-[#7F8C8D] uppercase">Dernière Ingestion</span>
            <span className="text-[10px] text-[#1A1A1B] font-mono font-semibold mt-2">
              {evaluation.lastScraped ? new Date(evaluation.lastScraped).toLocaleDateString("fr-CA", {
                hour: "2-digit",
                minute: "2-digit"
              }) : "N/A"}
            </span>
          </div>

          {/* SVG Sparkline */}
          <div className="col-span-2 md:col-span-1 flex flex-col justify-center">
            <PriceTrendSparkline historicalPrices={evaluation.historicalPrices} currentPrice={evaluation.medianPrice} />
          </div>
        </div>
      ) : (
        <div className="bg-[#F8F9FA] rounded border border-dashed border-[#DCDDE1] p-6 text-center mt-4" id="empty-evaluation-block">
          <TrendingUp className="w-6 h-6 text-slate-400 mx-auto mb-1.5" />
          <h3 className="text-xs font-bold text-slate-800">Aucune donnée disponible</h3>
          <p className="text-[11px] text-[#7F8C8D] max-w-sm mx-auto mt-0.5">
            Lancez une collecte standard ou une analyse heuristique pour rapatrier les comparables d'occasion pour ce modèle.
          </p>
        </div>
      )}
    </div>
  );
};
