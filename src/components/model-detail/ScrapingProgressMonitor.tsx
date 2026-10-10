import React, { useRef, useEffect } from "react";
import { Terminal } from "lucide-react";
import { SourceProgressItem } from "./types";
import { cleanLogSource, getStatusColorClass, getStatusLabel } from "./utils";

interface ScrapingProgressMonitorProps {
  isScraping: boolean;
  scrapeProgress: number;
  scrapingLogs: string[];
  parsedSources: SourceProgressItem[];
  activePopoverKey: string | null;
  setActivePopoverKey: (key: string | null) => void;
  showTrackingSection: boolean;
  setShowTrackingSection: (show: boolean) => void;
}

export const ScrapingProgressMonitor: React.FC<ScrapingProgressMonitorProps> = ({
  isScraping,
  scrapeProgress,
  scrapingLogs,
  parsedSources,
  activePopoverKey,
  setActivePopoverKey,
  showTrackingSection,
  setShowTrackingSection,
}) => {
  const logsContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [scrapingLogs]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (activePopoverKey) {
        const target = e.target as HTMLElement;
        if (!target.closest(".source-card-container") && !target.closest("#sources-active-log-panel")) {
          setActivePopoverKey(null);
        }
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [activePopoverKey, setActivePopoverKey]);

  const activeItem = React.useMemo(() => {
    return parsedSources.find(item => activePopoverKey === item.key) || 
           parsedSources.find(item => item.key === "general");
  }, [parsedSources, activePopoverKey]);

  if (!isScraping && scrapingLogs.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg border border-[#DCDDE1] dark:bg-slate-900 dark:border-slate-800 p-4 shadow-sm overflow-visible" id="sources-progress-section">
      {/* Header cliquable avec progression intégrée à côté du titre */}
      <div 
        onClick={() => setShowTrackingSection(!showTrackingSection)}
        className={`flex items-center justify-between cursor-pointer select-none transition group ${
          showTrackingSection ? "border-b border-[#F1F2F6] dark:border-slate-800 pb-3 mb-4" : ""
        }`}
        id="sources-progress-header"
      >
        <div className="flex flex-wrap items-center gap-3">
          <div className="p-1.5 bg-brand-purple-light dark:bg-brand-lime-light rounded text-brand-purple dark:text-brand-lime flex items-center justify-center">
            <Terminal className="w-4 h-4" />
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xs font-bold text-[#2D3436] dark:text-slate-100 uppercase tracking-wider group-hover:text-brand-purple dark:group-hover:text-brand-lime transition">
              Suivi de Collecte en Temps Réel
            </h2>

            {/* BARRE DE PROGRESSION & STATUT DE RECHERCHE À CÔTÉ DU TITRE DE SECTION */}
            {isScraping ? (
              <div className="flex items-center space-x-2 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 px-2.5 py-0.5 rounded-full text-[10px] font-mono shadow-sm">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping"></span>
                <span className="text-blue-700 dark:text-blue-300 font-bold">COLLECTE ACTIVE ({scrapeProgress}%)</span>
                
                {/* Mini Barre de Progression Intégrée */}
                <div className="w-16 bg-blue-200 dark:bg-blue-900 h-1.5 rounded-full overflow-hidden ml-1">
                  <div className="bg-blue-600 dark:bg-blue-400 h-full transition-all duration-300" style={{ width: `${scrapeProgress}%` }}></div>
                </div>
              </div>
            ) : (
              <div className="flex items-center space-x-1.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2.5 py-0.5 rounded-full text-[10px] font-mono shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span className="text-emerald-700 dark:text-emerald-300 font-bold">COLLECTE TERMINÉE (16/16 Sources)</span>
              </div>
            )}
          </div>
        </div>

        {/* Bouton de bascule de repli (Ouvert / Fermé) */}
        <div className="flex items-center space-x-2">
          <span className="text-[10px] text-[#7F8C8D] hidden md:inline">
            {showTrackingSection ? "Cliquer pour replier" : "Cliquer pour afficher la grille"}
          </span>
          <button
            type="button"
            className="px-2.5 py-1 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 rounded-lg transition border border-slate-200 dark:border-slate-700 flex items-center space-x-1 cursor-pointer"
          >
            <span>{showTrackingSection ? "Replier" : "Déplier"}</span>
            <span className="text-[10px]">{showTrackingSection ? "▲" : "▼"}</span>
          </button>
        </div>
      </div>

      {/* CONTENU DE LA SECTION (Journal d'exécution & Grille des 16 sources) - AFFICHE LORSQUE DÉPLIÉ */}
      {showTrackingSection && (
        <div className="space-y-4 animate-fadeIn">
          {/* Note d'aide */}
          <p className="text-[10px] text-[#7F8C8D] -mt-2">
            Survolez ou cliquez sur une source pour afficher son journal de diagnostic détaillé.
          </p>

          {/* Active Source Logs Panel (Viewport-Safe & Inline) */}
          {activeItem && (
            <div className="bg-[#F8F9FA] text-[#2D3436] dark:bg-slate-950 dark:text-slate-100 rounded-lg p-3.5 shadow-sm border border-[#DCDDE1] dark:border-slate-800" id="sources-active-log-panel">
              <div className="flex items-center justify-between border-b border-[#E4E7EB] dark:border-slate-850 pb-2 mb-2">
                <span className="font-bold text-[10px] uppercase text-slate-500 dark:text-slate-400 tracking-wider flex items-center space-x-2">
                  <span className="text-base">{activeItem.icon}</span>
                  <span className="text-[#2D3436] dark:text-slate-100 font-bold">{activeItem.name}</span>
                  <span className="text-[9px] bg-[#E4E7EB] dark:bg-slate-900 px-2 py-0.5 rounded font-mono text-slate-600 dark:text-slate-400 border border-[#DCDDE1] dark:border-slate-800">
                    Journal de Diagnostic ({activeItem.logs.length} ligne(s))
                  </span>
                  {activeItem.status === "running" && (
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse shadow-[0_0_6px_#3b82f6]"></span>
                  )}
                </span>
                
                {/* Close Button (Visible when pinned) */}
                {activePopoverKey === activeItem.key && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActivePopoverKey(null);
                    }}
                    className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition cursor-pointer text-xs font-bold px-1.5 py-0.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded leading-none"
                    title="Fermer et revenir à l'Orchestrateur"
                  >
                    ✕ Fermer
                  </button>
                )}
              </div>
              
              {/* Logs Content */}
              {activeItem.logs.length > 0 ? (
                <div ref={logsContainerRef} className="space-y-1 max-h-36 overflow-y-auto font-mono text-[9px] text-slate-700 dark:text-slate-300 scrollbar-thin select-text">
                  {activeItem.logs.map((log, idx) => {
                    const isWarning = log.includes("⚠️") || log.includes("Panne") || log.includes("Erreur");
                    const isSuccess = log.includes("✔️") || log.includes("Succès") || log.includes("extraits") || log.includes("trouvées");
                    return (
                      <div 
                        key={idx} 
                        className={`leading-relaxed border-b border-slate-200/60 dark:border-slate-900 pb-0.5 last:border-0 ${
                          isWarning ? "text-amber-600 dark:text-amber-400 font-semibold" : 
                          isSuccess ? "text-emerald-600 dark:text-emerald-400 font-semibold" : ""
                        }`}
                      >
                        {cleanLogSource(log)}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[10px] text-slate-500 dark:text-slate-400 italic">Aucun log disponible pour cette source.</p>
              )}
            </div>
          )}

          {/* Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3" id="sources-progress-grid">
            {parsedSources.map((item) => {
              const isPinned = activePopoverKey === item.key;

              return (
                <div 
                  key={item.key}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActivePopoverKey(isPinned ? null : item.key);
                  }}
                  className={`source-card-container relative p-3 border rounded-lg shadow-sm transition-all flex flex-col justify-between overflow-visible cursor-pointer ${
                    isPinned 
                      ? "bg-brand-purple-light/20 border-brand-purple dark:bg-brand-lime-light/20 dark:border-brand-lime scale-[1.01]" 
                      : "bg-[#F8F9FA] dark:bg-slate-900 border-[#DCDDE1] dark:border-slate-850 hover:shadow-md hover:scale-[1.02]"
                  }`}
                >
                  {/* Card Content */}
                  <div>
                    <div className="flex items-center space-x-1.5 mb-1">
                      <span className="text-base">{item.icon}</span>
                      <span className="text-[10px] font-bold text-[#2D3436] dark:text-slate-100 truncate">{item.name}</span>
                    </div>
                    
                    <div className="flex items-center">
                      <span className={`inline-block px-1.5 py-0.5 text-[8px] font-bold font-mono rounded border ${getStatusColorClass(item.status)}`}>
                        {getStatusLabel(item)}
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden mt-3">
                    <div 
                      className={`h-full rounded-full transition-all duration-300 ${
                        item.status === "running" ? "bg-blue-500 animate-pulse" :
                        item.status === "success" ? "bg-emerald-500" :
                        item.status === "failed" ? "bg-rose-500" : "bg-slate-300 dark:bg-slate-700"
                      }`}
                      style={{ width: `${item.progress}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
