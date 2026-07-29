import React from "react";
import { ModelEvaluation, HistoricalLogEntry } from "../types";
import { 
  Laptop, 
  Monitor, 
  Smartphone, 
  Activity, 
  ShieldAlert, 
  CheckCircle, 
  ArrowRight,
  TrendingUp,
  Clock
} from "lucide-react";

interface SyntheseTabProps {
  evaluations: Record<string, ModelEvaluation>;
  historicalLog: HistoricalLogEntry[];
  onNavigateToTab: (tab: string) => void;
}

export default function SyntheseTab({ evaluations, historicalLog, onNavigateToTab }: SyntheseTabProps) {
  const allModels = Object.values(evaluations);
  const totalModels = allModels.length;

  // Compute category pricing
  const portables = allModels.filter(m => m.category.toLowerCase().includes("portable") || m.category.toLowerCase().includes("apple"));
  const desktops = allModels.filter(m => m.category.toLowerCase().includes("desktop"));
  const iphones = allModels.filter(m => m.category.toLowerCase().includes("iphone"));

  const avgPortablePrice = portables.length 
    ? portables.reduce((acc, curr) => acc + curr.medianPrice, 0) / portables.length 
    : 0;

  const avgDesktopPrice = desktops.length 
    ? desktops.reduce((acc, curr) => acc + curr.medianPrice, 0) / desktops.length 
    : 0;

  const avgIphonePrice = iphones.length 
    ? iphones.reduce((acc, curr) => acc + curr.medianPrice, 0) / iphones.length 
    : 0;

  // Get active comparables count
  const totalComparables = allModels.reduce((acc, curr) => acc + curr.comparablesCount, 0);

  // SVG Chart data
  const maxVal = Math.max(avgPortablePrice, avgDesktopPrice, avgIphonePrice, 100);
  const getBarHeight = (price: number) => {
    return (price / maxVal) * 120;
  };

  return (
    <div className="space-y-4 animate-fadeIn" id="synthese-tab-container">
      {/* Hero Welcome & Compliance Banner */}
      <div className="bg-gradient-to-r from-[#2D3436] to-[#1E272E] rounded-lg p-5 border border-black text-white shadow-md relative overflow-hidden" id="synthese-hero">
        <div className="relative z-10 max-w-4xl">
          <div className="flex items-center space-x-2 text-[10px] font-mono font-bold uppercase text-brand-purple dark:text-brand-lime tracking-wider mb-2">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>DIRECTIVE COMPTABLE ET RÉGLEMENTAIRE INSERTECH</span>
          </div>
          <h2 className="text-xl md:text-2xl font-serif italic tracking-tight text-white mb-2">
            "Ne jamais inventer de prix, ni utiliser de formules théoriques de dépréciation."
          </h2>
          <p className="text-xs text-[#BDC3C7] leading-relaxed">
            Conformément aux normes d'évaluation d'actifs physiques, toute valeur résiduelle ou prix recommandé 
            doit être <strong className="text-white">exclusivement basé sur des observations empiriques vérifiables</strong> recueillies en temps réel 
            sur le marché secondaire canadien d'occasion. Cette interface garantit une traçabilité complète des preuves d'audit.
          </p>
        </div>
        {/* Subtle grid background */}
        <div className="absolute inset-0 bg-[radial-gradient(#ffffff08_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none"></div>
      </div>

      {/* KPI Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3" id="synthese-kpi-grid">
        <div className="bg-white rounded-lg border border-[#DCDDE1] p-3.5 shadow-sm flex items-center space-x-4">
          <div className="p-2.5 bg-slate-100 rounded text-slate-800">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-[#7F8C8D] uppercase tracking-wider font-mono">Modèles surveillés</div>
            <div className="text-2xl font-mono font-bold text-slate-900 mt-0.5">{totalModels}</div>
            <div className="text-[9px] text-[#2ECC71] font-bold uppercase tracking-wider font-mono">Catalogue Actif</div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-[#DCDDE1] p-3.5 shadow-sm flex items-center space-x-4">
          <div className="p-2.5 bg-blue-50 rounded text-blue-700">
            <Laptop className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-[#7F8C8D] uppercase tracking-wider font-mono">Moyenne Portables</div>
            <div className="text-2xl font-mono font-bold text-slate-900 mt-0.5">{avgPortablePrice.toFixed(2)}$</div>
            <div className="text-[9px] text-[#7F8C8D] font-bold uppercase tracking-wider font-mono">{portables.length} modèles catalogués</div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-[#DCDDE1] p-3.5 shadow-sm flex items-center space-x-4">
          <div className="p-2.5 bg-purple-50 rounded text-purple-700">
            <Monitor className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-[#7F8C8D] uppercase tracking-wider font-mono">Moyenne Desktops</div>
            <div className="text-2xl font-mono font-bold text-slate-900 mt-0.5">{avgDesktopPrice.toFixed(2)}$</div>
            <div className="text-[9px] text-[#7F8C8D] font-bold uppercase tracking-wider font-mono">{desktops.length} modèles catalogués</div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-[#DCDDE1] p-3.5 shadow-sm flex items-center space-x-4">
          <div className="p-2.5 bg-emerald-50 rounded text-emerald-700">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-[#7F8C8D] uppercase tracking-wider font-mono">Moyenne iPhones</div>
            <div className="text-2xl font-mono font-bold text-slate-900 mt-0.5">{avgIphonePrice.toFixed(2)}$</div>
            <div className="text-[9px] text-[#7F8C8D] font-bold uppercase tracking-wider font-mono">{iphones.length} modèles catalogués</div>
          </div>
        </div>
      </div>

      {/* Two Columns: Visual Bar Chart & Audit Activity */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4" id="synthese-charts-grid">
        {/* SVG Pricing Spread Comparison */}
        <div className="bg-white rounded-lg border border-[#DCDDE1] p-4 shadow-sm md:col-span-7 flex flex-col" id="chart-card">
          <h3 className="text-xs font-bold text-[#2D3436] uppercase tracking-wider mb-1">Visualisation des indices de prix</h3>
          <p className="text-[10px] text-[#7F8C8D] mb-4">Moyennes arithmétiques pondérées calculées sur les modèles d'occasion actifs.</p>
          
          <div className="flex-1 flex items-end justify-around py-4 h-48 border-b border-[#DCDDE1] px-4" id="svg-chart-wrapper">
            {/* Laptops Bar */}
            <div className="flex flex-col items-center space-y-2 w-20">
              <span className="font-mono text-xs font-bold text-slate-700">{avgPortablePrice.toFixed(0)}$</span>
              <div 
                className="w-12 bg-brand-purple rounded-t hover:bg-brand-lime dark:bg-slate-700 dark:hover:bg-brand-lime transition-colors shadow-sm cursor-pointer"
                style={{ height: `${getBarHeight(avgPortablePrice)}px` }}
                title={`Ordinateurs Portables: ${avgPortablePrice.toFixed(2)} CAD`}
              ></div>
              <span className="text-[9px] font-bold font-mono text-[#7F8C8D] uppercase">Portables</span>
            </div>

            {/* Desktops Bar */}
            <div className="flex flex-col items-center space-y-2 w-20">
              <span className="font-mono text-xs font-bold text-slate-700">{avgDesktopPrice.toFixed(0)}$</span>
              <div 
                className="w-12 bg-slate-500 rounded-t hover:bg-brand-lime dark:hover:bg-brand-lime transition-all transition-colors shadow-sm cursor-pointer"
                style={{ height: `${getBarHeight(avgDesktopPrice)}px` }}
                title={`Ordinateurs de bureau: ${avgDesktopPrice.toFixed(2)} CAD`}
              ></div>
              <span className="text-[9px] font-bold font-mono text-[#7F8C8D] uppercase">Desktops</span>
            </div>

            {/* iPhones Bar */}
            <div className="flex flex-col items-center space-y-2 w-20">
              <span className="font-mono text-xs font-bold text-slate-700">{avgIphonePrice.toFixed(0)}$</span>
              <div 
                className="w-12 bg-slate-400 rounded-t hover:bg-brand-lime dark:hover:bg-brand-lime transition-all transition-colors shadow-sm cursor-pointer"
                style={{ height: `${getBarHeight(avgIphonePrice)}px` }}
                title={`iPhone: ${avgIphonePrice.toFixed(2)} CAD`}
              ></div>
              <span className="text-[9px] font-bold font-mono text-[#7F8C8D] uppercase">iPhones</span>
            </div>
          </div>
          
          <div className="flex justify-between items-center mt-3 text-[10px] text-slate-500" id="chart-caption">
            <span>Preuves recueillies : <strong>{totalComparables} comparables</strong></span>
          </div>
        </div>

        {/* Recent Audit Log Activity */}
        <div className="bg-white rounded-lg border border-[#DCDDE1] p-4 shadow-sm md:col-span-5 flex flex-col" id="recent-logs-card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-[#2D3436] uppercase tracking-wider">Modifications Récentes (Registre)</h3>
            <button 
              onClick={() => onNavigateToTab("historique")} 
              className="text-[9px] text-brand-purple dark:text-brand-lime font-bold uppercase tracking-wider flex items-center space-x-1 hover:underline"
              id="btn-goto-historique"
            >
              <span>Registre Complet</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="flex-1 divide-y divide-[#F1F2F6] overflow-y-auto max-h-56 pr-1 space-y-2.5" id="recent-logs-list">
            {historicalLog.length > 0 ? (
              historicalLog.slice(0, 4).map((log) => (
                <div key={log.id} className="pt-2 text-xs flex flex-col space-y-1" id={`recent-log-${log.id}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">{log.model}</span>
                    <span className="text-[9px] font-mono text-slate-400 flex items-center space-x-1">
                      <Clock className="w-2.5 h-2.5" />
                      <span>{new Date(log.date).toLocaleTimeString("fr-CA", { hour: '2-digit', minute: '2-digit' })}</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-[#7F8C8D]">
                    <span>{log.action}</span>
                    <span className="font-mono font-bold text-[#2D3436]">
                      {log.previousPrice !== log.currentPrice 
                        ? `${log.previousPrice.toFixed(0)}$ → ${log.currentPrice.toFixed(0)}$`
                        : `${log.currentPrice.toFixed(2)}$`
                      }
                    </span>
                  </div>
                  <div className="text-[9px] text-slate-400 font-mono">
                    Op: {log.operator.split(" ")[0]}
                  </div>
                </div>
              ))
            ) : (
              <div className="h-full flex items-center justify-center text-[#7F8C8D] text-xs py-8 italic text-center">
                Aucune modification d'index consignée.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
