import React from "react";
import HelpTooltip from "../common/HelpTooltip";
import { HELP_CONTENT } from "../../constants/helpContent";

interface PriceTrendSparklineProps {
  historicalPrices?: { date: string; price: number }[];
  currentPrice?: number;
}

export const PriceTrendSparkline: React.FC<PriceTrendSparklineProps> = ({
  historicalPrices,
  currentPrice,
}) => {
  const points = historicalPrices ? [...historicalPrices] : [];
  if (currentPrice !== undefined) {
    points.push({ date: new Date().toISOString(), price: currentPrice });
  }

  if (points.length < 2) return null;

  const prices = points.map(p => p.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;

  const svgWidth = 120;
  const svgHeight = 28;

  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1)) * (svgWidth - 6) + 3;
    const y = svgHeight - ((p.price - min) / range) * (svgHeight - 8) - 4;
    return `${x},${y}`;
  }).join(" ");

  const firstPrice = prices[0];
  const lastPrice = prices[prices.length - 1];
  const trendDiff = lastPrice - firstPrice;
  const isUp = trendDiff > 0;
  const isDown = trendDiff < 0;
  const colorClass = isUp
    ? "text-rose-600 dark:text-rose-400"
    : isDown
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-slate-500 dark:text-slate-400";

  return (
    <div className="flex items-center space-x-2 mt-2 pt-2 border-t border-slate-200 dark:border-slate-800">
      <div className="flex flex-col">
        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1">
          <span>Tendance historique</span>
          <HelpTooltip topic={HELP_CONTENT.statSparkline} size="xs" side="top" id="statSparkline" />
        </span>
        <div className="flex items-center space-x-1">
          <span className={`text-xs font-bold font-mono ${colorClass}`}>
            {isUp ? `+${trendDiff.toFixed(0)} CAD` : isDown ? `${trendDiff.toFixed(0)} CAD` : "Stable"}
          </span>
          <span className="text-[10px] text-slate-400">({points.length} pts)</span>
        </div>
      </div>
      <svg width={svgWidth} height={svgHeight} className="overflow-visible">
        <polyline
          fill="none"
          stroke={isUp ? "#e11d48" : isDown ? "#10b981" : "#64748b"}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={coords}
        />
        {points.map((p, i) => {
          const x = (i / (points.length - 1)) * (svgWidth - 6) + 3;
          const y = svgHeight - ((p.price - min) / range) * (svgHeight - 8) - 4;
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={i === points.length - 1 ? 3 : 1.5}
              className={
                i === points.length - 1
                  ? isUp
                    ? "fill-rose-600"
                    : isDown
                    ? "fill-emerald-600"
                    : "fill-slate-600"
                  : "fill-slate-400"
              }
            />
          );
        })}
      </svg>
    </div>
  );
};
