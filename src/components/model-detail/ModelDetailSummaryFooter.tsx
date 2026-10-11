import React from "react";
import { ModelEvaluation } from "../../types";
import HelpTooltip from "../common/HelpTooltip";
import { HELP_CONTENT } from "../../constants/helpContent";

interface ModelDetailSummaryFooterProps {
  evaluation: ModelEvaluation | null;
  standardDeviation: number;
}

export const ModelDetailSummaryFooter: React.FC<ModelDetailSummaryFooterProps> = ({
  evaluation,
  standardDeviation,
}) => {
  if (!evaluation) return null;

  return (
    <div className="bg-brand-purple dark:bg-slate-800 border-none rounded-lg p-4 px-6 flex flex-col sm:flex-row items-center justify-between text-white shadow-md animate-fadeIn" id="model-summary-footer">
      <div className="flex flex-wrap gap-8 items-center">
        <div>
          <div className="text-[9px] uppercase font-bold text-[#95A5A6] mb-0.5 tracking-wider font-mono flex items-center space-x-1">
            <span>Médiane Calculée</span>
            <HelpTooltip topic={HELP_CONTENT.statMedianPrice} size="xs" side="top" id="footerMedianPrice" />
          </div>
          <div className="text-3xl font-mono text-[#2ECC71] font-bold tracking-tighter">
            {evaluation.medianPrice > 0 ? `${evaluation.medianPrice.toFixed(2)}$` : "Non évalué"}{" "}
            {evaluation.medianPrice > 0 && <span className="text-xs text-white font-normal ml-0.5 uppercase">CAD</span>}
          </div>
        </div>
        <div className="hidden sm:block h-10 w-px bg-white/10"></div>
        <div>
          <div className="text-[9px] uppercase font-bold text-[#95A5A6] mb-0.5 tracking-wider font-mono flex items-center space-x-1">
            <span>Écart-Type (Filtres Actifs)</span>
            <HelpTooltip topic={HELP_CONTENT.statConfidence} size="xs" side="top" id="footerConfidence" />
          </div>
          <div className="text-lg font-mono text-[#F1C40F] font-bold">
            ± {standardDeviation.toFixed(2)}$
          </div>
        </div>
      </div>
    </div>
  );
};
