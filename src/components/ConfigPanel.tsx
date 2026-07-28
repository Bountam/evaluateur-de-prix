import React, { useState } from "react";
import { SiteSelectors, SelfHealingStatus } from "../types";
import { Settings, Shield, ShieldCheck, ShieldAlert, RefreshCw, AlertCircle, Sparkles } from "lucide-react";

interface ConfigPanelProps {
  selectors: SiteSelectors;
  healingStatus: Record<string, SelfHealingStatus>;
  onSaveSelectors: (selectors: SiteSelectors) => Promise<void>;
  onRunHealthCheck: (site: "eBay" | "backMarket") => Promise<void>;
  onTriggerHeal: (site: "eBay" | "backMarket") => Promise<void>;
}

export default function ConfigPanel({
  selectors,
  healingStatus,
  onSaveSelectors,
  onRunHealthCheck,
  onTriggerHeal,
}: ConfigPanelProps) {
  const [editedSelectors, setEditedSelectors] = useState<SiteSelectors>({ ...selectors });
  const [checking, setChecking] = useState<Record<string, boolean>>({ eBay: false, backMarket: false });
  const [healing, setHealing] = useState<Record<string, boolean>>({ eBay: false, backMarket: false });
  const [isSaved, setIsSaved] = useState(false);

  // Keep in sync with props changes
  React.useEffect(() => {
    setEditedSelectors({ ...selectors });
  }, [selectors]);

  const handleChange = (site: "eBay" | "backMarket", field: keyof typeof selectors.eBay, value: string) => {
    setEditedSelectors(prev => ({
      ...prev,
      [site]: {
        ...prev[site],
        [field]: value
      }
    }));
  };

  const handleSave = async () => {
    setIsSaved(false);
    await onSaveSelectors(editedSelectors);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleHealthCheck = async (site: "eBay" | "backMarket") => {
    setChecking(prev => ({ ...prev, [site]: true }));
    await onRunHealthCheck(site);
    setChecking(prev => ({ ...prev, [site]: false }));
  };

  const handleHeal = async (site: "eBay" | "backMarket") => {
    setHealing(prev => ({ ...prev, [site]: true }));
    await onTriggerHeal(site);
    setHealing(prev => ({ ...prev, [site]: false }));
  };

  return (
    <div className="bg-white rounded-lg border border-[#DCDDE1] p-4 space-y-4 shadow-sm" id="config-panel-container">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-[#F1F2F6] pb-3" id="config-header">
        <div className="flex items-start space-x-2.5">
          <div className="p-2 bg-[#F1F2F6] rounded text-[#2D3436]">
            <Settings className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-[#2D3436] uppercase tracking-wider mt-0.5">Registre de Configuration des Sélecteurs CSS</h2>
            <p className="text-[10px] text-[#7F8C8D] mt-0.5 font-medium">
              Configurez, inspectez et réparez les sélecteurs de scraping pour eBay et Back Market.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" id="config-grid">
        {/* eBay Selectors */}
        <div className="border border-[#DCDDE1] rounded-lg p-4 space-y-3 bg-[#F8F9FA]" id="ebay-config-card">
          <div className="flex items-center justify-between border-b border-[#DCDDE1] pb-2">
            <div className="flex items-center space-x-1.5">
              <span className="text-xs font-bold text-[#2D3436]">eBay Canada</span>
              <span className="text-[9px] px-1.5 py-0.5 bg-[#DCDDE1] rounded text-[#2D3436] font-mono font-bold">eBay.ca</span>
            </div>
            {/* Status Badge */}
            <div className="flex items-center space-x-1">
              {healingStatus.eBay?.status === "OK" ? (
                <span className="inline-flex items-center space-x-1 text-[9px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 font-mono font-bold uppercase">
                  <ShieldCheck className="w-3 h-3" />
                  <span>Opérationnel</span>
                </span>
              ) : healingStatus.eBay?.status === "HEALED" ? (
                <span className="inline-flex items-center space-x-1 text-[9px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100 font-mono font-bold uppercase animate-pulse">
                  <Sparkles className="w-3 h-3" />
                  <span>Auto-Guéri (Gist)</span>
                </span>
              ) : (
                <span className="inline-flex items-center space-x-1 text-[9px] text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100 font-mono font-bold uppercase">
                  <ShieldAlert className="w-3 h-3" />
                  <span>Panne détectée</span>
                </span>
              )}
            </div>
          </div>

          <div className="space-y-2.5">
            <div>
              <label className="block text-[9px] font-bold text-[#7F8C8D] uppercase tracking-wider mb-0.5">Conteneur de Produit</label>
              <input
                type="text"
                className="w-full px-2 py-1 font-mono text-[11px] bg-white border border-[#DCDDE1] rounded outline-none focus:border-brand-purple dark:focus:border-brand-lime transition-colors"
                value={editedSelectors.eBay.container}
                onChange={(e) => handleChange("eBay", "container", e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[9px] font-bold text-[#7F8C8D] uppercase tracking-wider mb-0.5">Balise Titre</label>
              <input
                type="text"
                className="w-full px-2 py-1 font-mono text-[11px] bg-white border border-[#DCDDE1] rounded outline-none focus:border-brand-purple dark:focus:border-brand-lime transition-colors"
                value={editedSelectors.eBay.title}
                onChange={(e) => handleChange("eBay", "title", e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[9px] font-bold text-[#7F8C8D] uppercase tracking-wider mb-0.5">Balise Prix (CAD)</label>
              <input
                type="text"
                className="w-full px-2 py-1 font-mono text-[11px] bg-white border border-[#DCDDE1] rounded outline-none focus:border-brand-purple dark:focus:border-brand-lime transition-colors"
                value={editedSelectors.eBay.price}
                onChange={(e) => handleChange("eBay", "price", e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[9px] font-bold text-[#7F8C8D] uppercase tracking-wider mb-0.5">Lien URL de l'Annonce</label>
              <input
                type="text"
                className="w-full px-2 py-1 font-mono text-[11px] bg-white border border-[#DCDDE1] rounded outline-none focus:border-brand-purple dark:focus:border-brand-lime transition-colors"
                value={editedSelectors.eBay.url}
                onChange={(e) => handleChange("eBay", "url", e.target.value)}
              />
            </div>
          </div>

          {/* Action buttons per site */}
          <div className="flex items-center space-x-1.5 pt-2 border-t border-[#DCDDE1] mt-2">
            <button
              onClick={() => handleHealthCheck("eBay")}
              disabled={checking.eBay}
              className="flex items-center space-x-1 px-2 py-1 bg-slate-700 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-sm text-[10px] font-bold uppercase tracking-wider transition cursor-pointer"
            >
              <RefreshCw className={`w-2.5 h-2.5 ${checking.eBay ? "animate-spin" : ""}`} />
              <span>Tester</span>
            </button>
            <button
              onClick={() => handleHeal("eBay")}
              disabled={healing.eBay}
              className="flex items-center space-x-1 px-2 py-1 bg-brand-lime hover:bg-brand-lime-hover text-slate-900 rounded-sm text-[10px] font-bold uppercase tracking-wider transition cursor-pointer"
            >
              <Shield className="w-2.5 h-2.5" />
              <span>Guérir</span>
            </button>
          </div>

          {healingStatus.eBay?.details && (
            <p className="text-[10px] text-[#7F8C8D] italic mt-1.5 bg-white p-1.5 border border-[#DCDDE1] rounded font-mono">
              🔍 {healingStatus.eBay.details}
            </p>
          )}
        </div>

        {/* Back Market Selectors */}
        <div className="border border-[#DCDDE1] rounded-lg p-4 space-y-3 bg-[#F8F9FA]" id="backmarket-config-card">
          <div className="flex items-center justify-between border-b border-[#DCDDE1] pb-2">
            <div className="flex items-center space-x-1.5">
              <span className="text-xs font-bold text-[#2D3436]">Back Market Canada</span>
              <span className="text-[9px] px-1.5 py-0.5 bg-[#DCDDE1] rounded text-[#2D3436] font-mono font-bold">backmarket.ca</span>
            </div>
            {/* Status Badge */}
            <div className="flex items-center space-x-1">
              {healingStatus.backMarket?.status === "OK" ? (
                <span className="inline-flex items-center space-x-1 text-[9px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 font-mono font-bold uppercase">
                  <ShieldCheck className="w-3 h-3" />
                  <span>Opérationnel</span>
                </span>
              ) : healingStatus.backMarket?.status === "HEALED" ? (
                <span className="inline-flex items-center space-x-1 text-[9px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100 font-mono font-bold uppercase animate-pulse">
                  <Sparkles className="w-3 h-3" />
                  <span>Auto-Guéri (Gist)</span>
                </span>
              ) : (
                <span className="inline-flex items-center space-x-1 text-[9px] text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100 font-mono font-bold uppercase">
                  <ShieldAlert className="w-3 h-3" />
                  <span>Panne détectée</span>
                </span>
              )}
            </div>
          </div>

          <div className="space-y-2.5">
            <div>
              <label className="block text-[9px] font-bold text-[#7F8C8D] uppercase tracking-wider mb-0.5">Conteneur de Produit</label>
              <input
                type="text"
                className="w-full px-2 py-1 font-mono text-[11px] bg-white border border-[#DCDDE1] rounded outline-none focus:border-brand-purple dark:focus:border-brand-lime transition-colors"
                value={editedSelectors.backMarket.container}
                onChange={(e) => handleChange("backMarket", "container", e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[9px] font-bold text-[#7F8C8D] uppercase tracking-wider mb-0.5">Balise Titre</label>
              <input
                type="text"
                className="w-full px-2 py-1 font-mono text-[11px] bg-white border border-[#DCDDE1] rounded outline-none focus:border-brand-purple dark:focus:border-brand-lime transition-colors"
                value={editedSelectors.backMarket.title}
                onChange={(e) => handleChange("backMarket", "title", e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[9px] font-bold text-[#7F8C8D] uppercase tracking-wider mb-0.5">Balise Prix (CAD)</label>
              <input
                type="text"
                className="w-full px-2 py-1 font-mono text-[11px] bg-white border border-[#DCDDE1] rounded outline-none focus:border-brand-purple dark:focus:border-brand-lime transition-colors"
                value={editedSelectors.backMarket.price}
                onChange={(e) => handleChange("backMarket", "price", e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[9px] font-bold text-[#7F8C8D] uppercase tracking-wider mb-0.5">Lien URL de l'Annonce</label>
              <input
                type="text"
                className="w-full px-2 py-1 font-mono text-[11px] bg-white border border-[#DCDDE1] rounded outline-none focus:border-brand-purple dark:focus:border-brand-lime transition-colors"
                value={editedSelectors.backMarket.url}
                onChange={(e) => handleChange("backMarket", "url", e.target.value)}
              />
            </div>
          </div>

          {/* Action buttons per site */}
          <div className="flex items-center space-x-1.5 pt-2 border-t border-[#DCDDE1] mt-2">
            <button
              onClick={() => handleHealthCheck("backMarket")}
              disabled={checking.backMarket}
              className="flex items-center space-x-1 px-2 py-1 bg-slate-700 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-sm text-[10px] font-bold uppercase tracking-wider transition cursor-pointer"
            >
              <RefreshCw className={`w-2.5 h-2.5 ${checking.backMarket ? "animate-spin" : ""}`} />
              <span>Tester</span>
            </button>
            <button
              onClick={() => handleHeal("backMarket")}
              disabled={healing.backMarket}
              className="flex items-center space-x-1 px-2 py-1 bg-brand-lime hover:bg-brand-lime-hover text-slate-900 rounded-sm text-[10px] font-bold uppercase tracking-wider transition cursor-pointer"
            >
              <Shield className="w-2.5 h-2.5" />
              <span>Guérir</span>
            </button>
          </div>

          {healingStatus.backMarket?.details && (
            <p className="text-[10px] text-[#7F8C8D] italic mt-1.5 bg-white p-1.5 border border-[#DCDDE1] rounded font-mono">
              🔍 {healingStatus.backMarket.details}
            </p>
          )}
        </div>
      </div>

      {/* Save Action */}
      <div className="flex items-center space-x-3 pt-3 border-t border-[#F1F2F6]" id="config-actions">
        <button
          onClick={handleSave}
          className="px-4 py-2 bg-brand-purple hover:bg-brand-purple-hover dark:bg-brand-lime dark:hover:bg-brand-lime-hover dark:text-slate-950 text-white font-bold rounded-sm text-[10px] uppercase tracking-wider transition shadow-sm cursor-pointer"
          id="btn-save-selectors"
        >
          Enregistrer le Registre Local
        </button>
        {isSaved && (
          <span className="text-[10px] text-emerald-600 font-bold flex items-center space-x-1 animate-fadeIn font-mono uppercase tracking-wider">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Sélecteurs enregistrés avec succès !</span>
          </span>
        )}
      </div>
    </div>
  );
}
