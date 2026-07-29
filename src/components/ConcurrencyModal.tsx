import React, { useState, useEffect } from "react";
import { Cpu, Zap, AlertTriangle, CheckCircle2, ShieldAlert, X } from "lucide-react";

interface ConcurrencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  concurrency: number;
  onSaveConcurrency: (value: number) => void;
}

export default function ConcurrencyModal({
  isOpen,
  onClose,
  concurrency,
  onSaveConcurrency,
}: ConcurrencyModalProps) {
  const [selectedConcurrency, setSelectedConcurrency] = useState<number>(concurrency);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    setSelectedConcurrency(concurrency);
  }, [concurrency]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveConcurrency(selectedConcurrency);
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
      onClose();
    }, 1200);
  };

  // Déterminer la catégorie de performance
  const isLow = selectedConcurrency <= 2;
  const isMedium = selectedConcurrency >= 3 && selectedConcurrency <= 5;
  const isHigh = selectedConcurrency >= 6;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-purple-100 dark:bg-purple-950/60 rounded-lg text-purple-700 dark:text-purple-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wide">
                Configuration de la Concurrence CPU
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Ajustez le niveau de parallélisme du scraping selon la puissance de votre PC.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 space-y-5">
          {/* Slider Controls */}
          <div className="space-y-3 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center space-x-2">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span>Scrapers simultanés :</span>
              </label>
              <span className="text-lg font-extrabold font-mono text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 px-3 py-0.5 rounded-md border border-purple-200 dark:border-purple-800">
                {selectedConcurrency} {selectedConcurrency === 1 ? 'source' : 'sources'}
              </span>
            </div>

            <input
              type="range"
              min={1}
              max={16}
              step={1}
              value={selectedConcurrency}
              onChange={(e) => setSelectedConcurrency(parseInt(e.target.value, 10))}
              className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-600 dark:accent-purple-400"
            />

            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>1 (Lent / CPU Éco)</span>
              <span>8 (Standard)</span>
              <span>16 (Max / CPU Fort)</span>
            </div>
          </div>

          {/* Dynamic Warning Banners */}
          {isLow && (
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 space-y-1">
              <div className="flex items-center space-x-2 font-bold text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                <span>Mode Économique (1 à 2 scrapers simultanés) — Recommandé PC Faibles</span>
              </div>
              <p className="text-[11px] leading-relaxed text-emerald-700 dark:text-emerald-400/90 pl-6">
                <strong>Effet :</strong> Sollicitation processeur minimale (&lt; 25% CPU). Idéal pour les ordinateurs reconditionnés anciens ou peu puissants. La collecte complète prendra environ 15 à 25 secondes.
              </p>
            </div>
          )}

          {isMedium && (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 space-y-1">
              <div className="flex items-center space-x-2 font-bold text-xs">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                <span>Mode Équilibré (3 à 5 scrapers simultanés) — Pour PC Réco Standard</span>
              </div>
              <p className="text-[11px] leading-relaxed text-amber-700 dark:text-amber-400/90 pl-6">
                <strong>Effet :</strong> Bon compromis vitesse / ressources. Charge CPU modérée (~40-60%). Temps de recherche rapide (~8 à 12 secondes).
              </p>
            </div>
          )}

          {isHigh && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-300 space-y-1 animate-pulse">
              <div className="flex items-center space-x-2 font-bold text-xs">
                <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0" />
                <span>Mode Haute Performance (6+ scrapers simultanés) — Attention PC Faibles !</span>
              </div>
              <p className="text-[11px] leading-relaxed text-rose-700 dark:text-rose-400/90 pl-6">
                <strong>Avertissement :</strong> La vitesse sera maximale (~4 à 6 secondes), mais ce mode pousse le processeur à 100% et peut faire ramer les machines peu puissantes. À réserver aux processeurs 6+ cœurs.
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition"
          >
            Annuler
          </button>
          <div className="flex items-center space-x-2">
            {isSaved && (
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center space-x-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Enregistré !</span>
              </span>
            )}
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white dark:bg-purple-500 dark:hover:bg-purple-600 font-bold rounded-lg text-xs tracking-wider uppercase shadow-md transition cursor-pointer"
            >
              Appliquer la configuration
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
