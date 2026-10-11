import React, { useState, useEffect } from "react";
import { 
  ExternalLink, 
  Database, 
  Key, 
  Save, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  HelpCircle, 
  Info, 
  Settings, 
  Activity, 
  Lock, 
  Unlock, 
  FileSpreadsheet, 
  FolderArchive, 
  Globe2, 
  Check, 
  Loader2, 
  Sparkles, 
  MapPin, 
  AlertCircle,
  Trash2,
  Building2,
  Upload,
  RefreshCw,
  Sun,
  Moon,
  Cpu,
  Zap,
  Sliders
} from "lucide-react";
import { DataSource, OrganizationConfig } from "../types";
import Logo from "./Logo";
import HelpTooltip from "./common/HelpTooltip";
import { HELP_CONTENT } from "../constants/helpContent";

export interface SettingsTabProps {
  sources: DataSource[];
  onPurgeAll?: () => Promise<void>;
  organization?: OrganizationConfig;
  onOrganizationUpdate?: (org: OrganizationConfig) => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  concurrency: number;
  onSaveConcurrency: (value: number) => void;
}

export default function SettingsTab({
  sources,
  onPurgeAll,
  organization,
  onOrganizationUpdate,
  theme,
  onToggleTheme,
  concurrency,
  onSaveConcurrency
}: SettingsTabProps) {
  const [credentials, setCredentials] = useState<{
    INTERNAL_CATALOG_PATH?: string;
    INTERNAL_ARCHIVES_PATH?: string;
    INSERTECH_DATA_PATH?: string;
    INSERTECH_ARCHIVES_PATH?: string;
    EBAY_APP_ID?: string;
    EBAY_CERT_ID?: string;
    BESTBUY_API_KEY?: string;
  }>({});
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<"api" | "local">("api");
  const [purging, setPurging] = useState(false);
  const [purgeSuccess, setPurgeSuccess] = useState(false);

  const [orgConfig, setOrgConfig] = useState<OrganizationConfig>({
    name: organization?.name || "",
    logoUrl: organization?.logoUrl || "",
    tagline: organization?.tagline || ""
  });
  const [savingOrg, setSavingOrg] = useState(false);
  const [orgSaveMessage, setOrgSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    if (organization) {
      setOrgConfig({
        name: organization.name || "",
        logoUrl: organization.logoUrl || "",
        tagline: organization.tagline || ""
      });
    }
  }, [organization]);

  const handleSaveOrganization = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSavingOrg(true);
    setOrgSaveMessage(null);
    try {
      const res = await fetch("/api/organization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organization: orgConfig })
      });
      const data = await res.json();
      if (data && data.success) {
        setOrgSaveMessage("✔️ Image de marque enregistrée avec succès !");
        if (onOrganizationUpdate) {
          onOrganizationUpdate(data.organization);
        }
        setTimeout(() => setOrgSaveMessage(null), 4000);
      } else {
        setOrgSaveMessage("⚠️ Erreur lors de l'enregistrement de l'organisation.");
      }
    } catch {
      setOrgSaveMessage("⚠️ Erreur réseau lors de l'enregistrement.");
    } finally {
      setSavingOrg(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("Le fichier est trop volumineux (maximum 2 Mo).");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setOrgConfig(prev => ({ ...prev, logoUrl: base64 }));
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    fetch("/api/credentials")
      .then(res => res.json())
      .then(data => {
        if (data.credentials) setCredentials(data.credentials);
      })
      .catch(err => console.error("Could not load credentials:", err));
  }, []);

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveMessage(null);
    try {
      const res = await fetch("/api/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credentials })
      });
      const data = await res.json();
      if (data.success) {
        setSaveMessage("✔️ Identifiants enregistrés avec succès !");
        setTimeout(() => setSaveMessage(null), 3500);
      } else {
        setSaveMessage("❌ Échec de l'enregistrement des identifiants.");
      }
    } catch (err) {
      setSaveMessage("❌ Erreur réseau lors de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  };

  const toggleShowKey = (field: string) => {
    setShowKeys(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const handlePurgeCache = async () => {
    if (!window.confirm("Êtes-vous sûr de vouloir vider l'ensemble du cache local des scrapers ? Les prochaines requêtes réinterrogeront les sources distantes.")) {
      return;
    }
    setPurging(true);
    try {
      if (onPurgeAll) {
        await onPurgeAll();
      } else {
        await fetch("/api/cache/purge", { method: "POST" });
      }
      setPurgeSuccess(true);
      setTimeout(() => setPurgeSuccess(false), 4000);
    } catch (err) {
      console.error("Purge error:", err);
      alert("Erreur lors de la purge du cache.");
    } finally {
      setPurging(false);
    }
  };

  const getScrapeMethodStyle = (method?: string) => {
    const defaultStyle = "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-800";
    if (!method) return { label: "Automatique", css: defaultStyle };
    
    switch (method.toLowerCase()) {
      case "direct":
        return { label: "Scraping Direct", css: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/50" };
      case "api":
        return { label: "API Directe", css: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900/50" };
      case "rss":
        return { label: "Flux RSS", css: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/20 dark:text-orange-400 dark:border-orange-900/50" };
      case "cache":
        return { label: "Cache Local", css: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50" };
      case "manual-import":
        return { label: "Import Manuel", css: "bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950/20 dark:text-pink-400 dark:border-pink-900/50" };
      default:
        return { label: method, css: defaultStyle };
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn" id="settings-tab-container">
      
      {/* SECTION 1: Préférences Système (Thème & Puissance CPU) */}
      <div className="bg-bg-card border border-border-main rounded-xl p-6 shadow-md" id="section-system-preferences">
        <div className="flex items-center justify-between pb-4 border-b border-border-main mb-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-brand-purple-light dark:bg-brand-lime-light">
              <Sliders className="w-5 h-5 text-brand-purple dark:text-brand-lime" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <h3 className="text-sm font-bold text-text-main uppercase tracking-wider font-title">
                  Préférences Générales du Système
                </h3>
                <HelpTooltip topic={HELP_CONTENT.navSettings || HELP_CONTENT.navSources} size="xs" side="bottom" id="systemSettingsHelp" />
              </div>
              <p className="text-[11px] text-text-muted">
                Personnalisez le thème d'affichage et réglez la puissance de calcul allouée à la collecte de prix en direct.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          {/* 1. Sélecteur de Thème Clair / Sombre */}
          <div className="p-4 rounded-xl border border-border-main bg-slate-50/50 dark:bg-slate-900/40 space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 bg-purple-100 dark:bg-purple-950/60 rounded-md text-purple-700 dark:text-purple-400">
                  {theme === "light" ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-purple-400" />}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-text-main uppercase tracking-wide">
                    Thème Visuel de l'Interface
                  </h4>
                  <p className="text-[10px] text-text-muted">
                    Actuellement : <span className="font-bold text-brand-purple dark:text-brand-lime uppercase">{theme === "light" ? "Mode Clair" : "Mode Sombre"}</span>
                  </p>
                </div>
              </div>
              <HelpTooltip topic={HELP_CONTENT.themeToggle} size="xs" side="bottom" id="settingsThemeHelp" />
            </div>

            <p className="text-[11px] text-text-muted leading-relaxed">
              Basculez entre le mode clair pour une lisibilité maximale en bureau lumineux et le mode sombre pour réduire la fatigue oculaire lors des sessions d'évaluation prolongées.
            </p>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => { if (theme !== "light") onToggleTheme(); }}
                className={`flex items-center justify-center space-x-2 py-2.5 px-3 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                  theme === "light"
                    ? "bg-white text-brand-purple border-brand-purple shadow-sm ring-2 ring-brand-purple/20 font-extrabold"
                    : "bg-white/50 dark:bg-slate-800 border-border-main text-text-muted hover:text-text-main hover:bg-white dark:hover:bg-slate-700"
                }`}
                id="btn-theme-light"
              >
                <Sun className={`w-4 h-4 ${theme === "light" ? "text-amber-500" : "text-slate-400"}`} />
                <span>☀️ Mode Clair</span>
                {theme === "light" && <Check className="w-3.5 h-3.5 text-brand-purple ml-1" />}
              </button>

              <button
                type="button"
                onClick={() => { if (theme !== "dark") onToggleTheme(); }}
                className={`flex items-center justify-center space-x-2 py-2.5 px-3 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                  theme === "dark"
                    ? "bg-slate-800 text-brand-lime border-brand-lime shadow-sm ring-2 ring-brand-lime/20 font-extrabold"
                    : "bg-white/50 dark:bg-slate-800 border-border-main text-text-muted hover:text-text-main hover:bg-white dark:hover:bg-slate-700"
                }`}
                id="btn-theme-dark"
              >
                <Moon className={`w-4 h-4 ${theme === "dark" ? "text-brand-lime" : "text-slate-400"}`} />
                <span>🌙 Mode Sombre</span>
                {theme === "dark" && <Check className="w-3.5 h-3.5 text-brand-lime ml-1" />}
              </button>
            </div>
          </div>

          {/* 2. Puissance CPU & Concurrence de Scraping */}
          <div className="p-4 rounded-xl border border-border-main bg-slate-50/50 dark:bg-slate-900/40 space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 bg-amber-100 dark:bg-amber-950/60 rounded-md text-amber-700 dark:text-amber-400">
                  <Cpu className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-text-main uppercase tracking-wide">
                    Puissance CPU & Parallélisme
                  </h4>
                  <p className="text-[10px] text-text-muted">
                    Concurrence active : <span className="font-bold text-purple-600 dark:text-purple-400 font-mono">{concurrency} {concurrency === 1 ? 'source' : 'sources'}</span>
                  </p>
                </div>
              </div>
              <HelpTooltip topic={HELP_CONTENT.cpuConcurrency} size="xs" side="bottom" id="settingsCpuHelp" />
            </div>

            {/* Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-text-muted flex items-center space-x-1">
                  <Zap className="w-3 h-3 text-amber-500" />
                  <span>Scrapers simultanés :</span>
                </span>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                  {concurrency} {concurrency === 1 ? 'source' : 'sources'}
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={16}
                step={1}
                value={concurrency}
                onChange={(e) => onSaveConcurrency(parseInt(e.target.value, 10))}
                className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-brand-purple dark:accent-brand-lime"
                id="input-concurrency-slider"
              />
              <div className="flex justify-between text-[9px] text-text-muted font-mono">
                <span>1 (Éco / 1 cœur)</span>
                <span>8 (Standard)</span>
                <span>16 (Max / Multicœur)</span>
              </div>
            </div>

            {/* Paliers rapides */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {[2, 4, 8, 12].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => onSaveConcurrency(val)}
                  className={`px-2 py-1 rounded text-[10px] font-mono font-bold border transition-all cursor-pointer ${
                    concurrency === val
                      ? "bg-brand-purple text-white border-brand-purple dark:bg-brand-lime dark:text-slate-900 dark:border-brand-lime shadow-xs"
                      : "bg-white dark:bg-slate-800 text-text-muted border-border-main hover:border-brand-purple dark:hover:border-brand-lime hover:text-text-main"
                  }`}
                >
                  {val === 2 ? "2 (Éco)" : val === 4 ? "4 (Recommandé)" : `${val} sources`}
                </button>
              ))}
            </div>

            {/* Note contextuelle */}
            {concurrency <= 2 ? (
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 p-2 rounded border border-emerald-200 dark:border-emerald-800/50">
                🟢 <strong>Mode Économique :</strong> Consommation minimale de mémoire et de processeur. Idéal pour les ordinateurs d'atelier.
              </p>
            ) : concurrency <= 5 ? (
              <p className="text-[10px] text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 p-2 rounded border border-blue-200 dark:border-blue-800/50">
                🔵 <strong>Mode Équilibré :</strong> Vitesse optimale de collecte sans ralentir votre navigation.
              </p>
            ) : (
              <p className="text-[10px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-2 rounded border border-amber-200 dark:border-amber-800/50">
                ⚠️ <strong>Haute Performance :</strong> Collecte accélérée sollicitant activement le processeur et la ventilation.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* SECTION 2: Organisation & Image de Marque (Marque Blanche) */}
      <div className="bg-bg-card border border-border-main rounded-xl p-6 shadow-md" id="section-organisation">
        <div className="flex items-center justify-between pb-4 border-b border-border-main mb-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-brand-purple-light dark:bg-brand-lime-light">
              <Building2 className="w-5 h-5 text-brand-purple dark:text-brand-lime" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <h3 className="text-sm font-bold text-text-main uppercase tracking-wider font-title">
                  Organisation & Image de Marque (Marque Blanche)
                </h3>
                <HelpTooltip topic={HELP_CONTENT.whiteLabelSettings} size="xs" side="bottom" id="srcOrgHelp" />
              </div>
              <p className="text-[11px] text-text-muted">
                Personnalisez le nom et le logo de l'entreprise. Ces éléments sont dynamiques, sauvegardés en base et synchronisés avec vos exports Excel.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSaveOrganization} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-1.5">
                Nom de l'organisation ou de l'entreprise
              </label>
              <input
                type="text"
                value={orgConfig.name}
                onChange={e => setOrgConfig({ ...orgConfig, name: e.target.value })}
                placeholder="Ex. : Insertech, Réemploi Informatique, Mon Entreprise..."
                className="w-full text-xs p-2.5 border border-border-main rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-purple dark:focus:ring-brand-lime bg-white dark:bg-slate-900 text-text-main"
              />
              <p className="text-[10px] text-text-muted mt-1">
                Laissé vide, le titre par défaut sera « Évaluateur de Prix du Marché Reconditionné ».
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-1.5">
                Logo de l'organisation (URL web ou fichier importé)
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={orgConfig.logoUrl || ""}
                  onChange={e => setOrgConfig({ ...orgConfig, logoUrl: e.target.value })}
                  placeholder="https://... ou téléversez un fichier ci-contre"
                  className="flex-1 text-xs p-2.5 border border-border-main rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-purple dark:focus:ring-brand-lime font-mono bg-white dark:bg-slate-900 text-text-main"
                />
                <label className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-text-main border border-border-main px-3 py-2.5 rounded-lg text-xs font-bold cursor-pointer flex items-center space-x-1.5 transition">
                  <Upload className="w-3.5 h-3.5 text-text-muted" />
                  <span>Téléverser</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml,image/webp"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                </label>
                {orgConfig.logoUrl && (
                  <button
                    type="button"
                    onClick={() => setOrgConfig({ ...orgConfig, logoUrl: "" })}
                    className="p-2.5 border border-border-main rounded-lg text-text-muted hover:text-rose-500 hover:border-rose-300 dark:hover:border-rose-900 transition"
                    title="Réinitialiser au logo générique"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <p className="text-[10px] text-text-muted mt-1">
                Formats acceptés : SVG, PNG, JPG (recommandé : fond transparent ou contrasté).
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-1.5">
                Slogan / Description officielle
              </label>
              <input
                type="text"
                value={orgConfig.tagline || ""}
                onChange={e => setOrgConfig({ ...orgConfig, tagline: e.target.value })}
                placeholder="Ex. : Spécialiste du réemploi et reconditionnement informatique certifié"
                className="w-full text-xs p-2.5 border border-border-main rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-purple dark:focus:ring-brand-lime bg-white dark:bg-slate-900 text-text-main"
              />
            </div>

            <div className="flex items-center space-x-3 pt-2">
              <button
                type="submit"
                disabled={savingOrg}
                className="bg-brand-purple hover:bg-brand-purple-hover text-white dark:bg-brand-lime dark:hover:bg-brand-lime-hover dark:text-slate-950 font-bold px-4 py-2 rounded-lg text-xs flex items-center space-x-2 transition disabled:opacity-50 shadow-md cursor-pointer"
              >
                {savingOrg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>Enregistrer l'organisation</span>
              </button>
              {orgSaveMessage && (
                <span className={`text-[11px] font-bold ${orgSaveMessage.includes('✔️') ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                  {orgSaveMessage}
                </span>
              )}
            </div>
          </div>

          {/* Aperçu en direct */}
          <div className="lg:col-span-5 bg-slate-50 dark:bg-slate-900/40 border border-border-main rounded-xl p-4 space-y-3">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-text-muted block">
              Aperçu en Direct de l'En-tête
            </span>
            <div className="bg-brand-purple dark:bg-slate-950 p-3.5 rounded-lg border border-black/20 text-white shadow-inner">
              <div className="flex items-center space-x-3">
                <Logo className="h-8 w-auto" logoUrl={orgConfig.logoUrl} orgName={orgConfig.name} />
                <div>
                  <h4 className="text-sm font-serif font-bold text-white tracking-normal">
                    {orgConfig.name ? `${orgConfig.name} — Évaluateur de Prix` : "Évaluateur de Prix du Marché Reconditionné"}
                  </h4>
                  <p className="text-[10px] text-slate-300 line-clamp-1">
                    {orgConfig.tagline || "Plateforme d'audit autonome : résilience heuristique et preuves comptables."}
                  </p>
                </div>
              </div>
            </div>
            <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-border-main text-[11px] text-text-muted leading-relaxed">
              💡 <strong>Intégration Excel :</strong> Le nom et le logo définis ici sont automatiquement exportés dans la feuille <em>Organisation</em> et les <em>Métadonnées</em> de vos classeurs Excel. Lors d'un import de classeur, ils sont automatiquement restaurés.
            </div>
          </div>
        </form>
      </div>

      {/* SECTION 3: Architecture & Global Configuration */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Architecture Section */}
        <div className="lg:col-span-5 bg-bg-card border border-border-main rounded-xl p-6 flex flex-col justify-between shadow-md relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-brand-purple/5 dark:bg-brand-lime/5 rounded-full blur-2xl -mr-8 -mt-8 pointer-events-none" />
          
          <div>
            <div className="flex items-center space-x-2.5 mb-5">
              <div className="p-2 rounded-lg bg-brand-purple-light dark:bg-brand-lime-light">
                <Info className="w-5 h-5 text-brand-purple dark:text-brand-lime" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-text-main uppercase tracking-wider font-title">
                  Architecture d'Acquisition Locale
                </h3>
                <p className="text-[10px] text-text-muted">Stratégie 100% Autonome & Tolérante aux pannes</p>
              </div>
            </div>
            
            <p className="text-xs text-text-muted leading-relaxed mb-5">
              Pour satisfaire aux exigences de juste valeur marchande sans dépendre d'API tierces externes payantes ou instables, 
              l'évaluateur utilise une architecture locale autonome en <strong>3 Paliers de Résilience</strong> :
            </p>

            <div className="space-y-4">
              <div className="flex items-start space-x-3 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-100 dark:border-slate-800/60">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 font-bold text-xs flex items-center justify-center font-mono">1</span>
                <div>
                  <h4 className="text-xs font-bold text-text-main">Collecte Directe HTTP Heuristique</h4>
                  <p className="text-[11px] text-text-muted leading-snug mt-0.5">
                    Émulation HTTP via <code>got-scraping</code> pour eBay, BackMarket et Amazon Renewed sans requérir de clés d'API.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-100 dark:border-slate-800/60">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 font-bold text-xs flex items-center justify-center font-mono">2</span>
                <div>
                  <h4 className="text-xs font-bold text-text-main">Émulateur Navigateur Headless (Playwright)</h4>
                  <p className="text-[11px] text-text-muted leading-snug mt-0.5">
                    Chromium embarqué s'active de manière transparente si le site cible applique un rendu dynamique JavaScript lourd.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-100 dark:border-slate-800/60">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 font-bold text-xs flex items-center justify-center font-mono">3</span>
                <div>
                  <h4 className="text-xs font-bold text-text-main">Auto-Guérison Sécurisée & Cache SQLite</h4>
                  <p className="text-[11px] text-text-muted leading-snug mt-0.5">
                    Conservation locale des prix horodatés dans <code>data/evaluations.db</code> assurant la continuité de service hors-ligne.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-border-main mt-6 flex items-center justify-between">
            <span className="text-[10px] text-text-muted flex items-center space-x-1 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Audit Continu Actif</span>
            </span>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handlePurgeCache}
                disabled={purging}
                className="px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900/50 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 text-rose-700 dark:text-rose-400 text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer"
                id="btn-purge-cache"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{purging ? "Purge en cours..." : "Vider le cache"}</span>
              </button>
              <HelpTooltip topic={HELP_CONTENT.purgeCacheBtn} size="xs" side="bottom" id="purgeCacheHelp" />
            </div>
          </div>
        </div>

        {/* Sources Management List */}
        <div className="lg:col-span-7 bg-bg-card border border-border-main rounded-xl p-6 shadow-md flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-lg bg-brand-purple-light dark:bg-brand-lime-light">
                  <Database className="w-5 h-5 text-brand-purple dark:text-brand-lime" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-text-main uppercase tracking-wider font-title">
                    Sources du Marché Secondaire
                  </h3>
                  <p className="text-[10px] text-text-muted">Statut en direct et méthodes d'extraction</p>
                </div>
              </div>
              <HelpTooltip topic={HELP_CONTENT.filterSource} size="xs" side="bottom" id="sourcesListHelp" />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border-main text-[10px] font-bold uppercase tracking-wider text-text-muted">
                    <th className="pb-3 pl-1">Plateforme</th>
                    <th className="pb-3">Type</th>
                    <th className="pb-3">Méthode</th>
                    <th className="pb-3 text-right pr-1">État</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-main font-mono">
                  {sources.map(source => {
                    const badge = getScrapeMethodStyle(source.scrapeMethod);
                    return (
                      <tr key={source.sourceKey || source.name} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                        <td className="py-3 pl-1 font-bold text-text-main flex items-center space-x-2">
                          <Globe2 className="w-3.5 h-3.5 text-text-muted" />
                          <span>{source.name}</span>
                        </td>
                        <td className="py-3 text-[11px] text-text-muted">
                          {source.type}
                        </td>
                        <td className="py-3">
                          <span className={`text-[10px] px-2 py-0.5 rounded border ${badge.css}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="py-3 text-right pr-1">
                          <span className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            <span>Opérationnel</span>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {purgeSuccess && (
            <div className="mt-4 p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs rounded-lg flex items-center space-x-2 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>Le cache local a été vidé avec succès. Les prochains scans réinterrogeront les sources.</span>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 4: Clés & Identifiants (Optionnel) */}
      <div className="bg-bg-card border border-border-main rounded-xl p-6 shadow-md" id="section-credentials">
        <div className="flex items-center justify-between pb-4 border-b border-border-main mb-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-brand-purple-light dark:bg-brand-lime-light">
              <Key className="w-5 h-5 text-brand-purple dark:text-brand-lime" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-text-main uppercase tracking-wider font-title">
                Clés d'Accès d'Atelier & Catalogues Internes (Optionnel)
              </h3>
              <p className="text-[11px] text-text-muted">
                Pour l'intégration de catalogues locaux ou de clés API officielles éventuelles.
              </p>
            </div>
          </div>
        </div>

        {/* Sub-nav Tabs */}
        <div className="flex space-x-2 border-b border-border-main pb-2 mb-6">
          <button
            type="button"
            onClick={() => setActiveSubTab("api")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition ${
              activeSubTab === "api"
                ? "bg-brand-purple text-white dark:bg-brand-lime dark:text-slate-900 shadow-sm"
                : "text-text-muted hover:text-text-main hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>Clés d'API & Marketplace</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab("local")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition ${
              activeSubTab === "local"
                ? "bg-brand-purple text-white dark:bg-brand-lime dark:text-slate-900 shadow-sm"
                : "text-text-muted hover:text-text-main hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <FolderArchive className="w-3.5 h-3.5" />
            <span>Chemins Catalogues Locaux (.xlsx)</span>
          </button>
        </div>

        <form onSubmit={handleSaveCredentials} className="space-y-6">
          {activeSubTab === "api" && (
            <div className="space-y-4 animate-fadeIn">
              <div className="p-3 bg-blue-50/50 dark:bg-blue-950/10 rounded-lg border border-blue-200/40 dark:border-blue-900/40 text-xs text-text-muted flex items-start space-x-2">
                <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                <p>
                  Par défaut, l'application fonctionne de manière 100% autonome sans requérir de clés d'API. Si vous disposez de comptes développeur officiels, vous pouvez les renseigner ici.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wide mb-1.5">
                    eBay App ID (Client ID)
                  </label>
                  <input 
                    type="text" 
                    value={credentials.EBAY_APP_ID || ""} 
                    onChange={e => setCredentials({ ...credentials, EBAY_APP_ID: e.target.value })}
                    placeholder="Optionnel (ex: MonApp-Production-12345)"
                    className="w-full text-xs p-2 border border-border-main rounded-md focus:outline-none focus:ring-1 focus:ring-brand-purple dark:focus:ring-brand-lime font-mono bg-white dark:bg-slate-900 text-text-main"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wide">
                      eBay Cert ID (Client Secret)
                    </label>
                    <button 
                      type="button" 
                      onClick={() => toggleShowKey("EBAY_CERT_ID")}
                      className="text-[10px] text-text-muted hover:text-text-main flex items-center space-x-1"
                    >
                      {showKeys.EBAY_CERT_ID ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      <span>{showKeys.EBAY_CERT_ID ? "Masquer" : "Afficher"}</span>
                    </button>
                  </div>
                  <input 
                    type={showKeys.EBAY_CERT_ID ? "text" : "password"} 
                    value={credentials.EBAY_CERT_ID || ""} 
                    onChange={e => setCredentials({ ...credentials, EBAY_CERT_ID: e.target.value })}
                    placeholder="Optionnel"
                    className="w-full text-xs p-2 border border-border-main rounded-md focus:outline-none focus:ring-1 focus:ring-brand-purple dark:focus:ring-brand-lime font-mono bg-white dark:bg-slate-900 text-text-main"
                  />
                </div>
              </div>
            </div>
          )}

          {activeSubTab === "local" && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between p-3 bg-purple-50/50 dark:bg-purple-950/10 rounded-lg border border-purple-200/40 dark:border-purple-900/40">
                <div className="text-xs text-text-muted flex items-start space-x-2">
                  <Info className="w-4 h-4 text-brand-purple dark:text-brand-lime flex-shrink-0 mt-0.5" />
                  <p>
                    Permet de lier des classeurs Excel internes de stocks ou d'historique de réparations d'atelier pour comparer vos prix d'achat réels aux cotations du marché.
                  </p>
                </div>
                <HelpTooltip topic={HELP_CONTENT.localCatalogFiles} size="xs" side="bottom" id="srcLocalHelp" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wide flex items-center space-x-1">
                    <FileSpreadsheet className="w-3.5 h-3.5 text-brand-purple dark:text-brand-lime" />
                    <span>Fichier Prix Internes (.xlsx)</span>
                  </label>
                  <input 
                    type="text" 
                    value={credentials.INTERNAL_CATALOG_PATH || credentials.INSERTECH_DATA_PATH || ""} 
                    onChange={e => setCredentials({ 
                      ...credentials, 
                      INTERNAL_CATALOG_PATH: e.target.value,
                      INSERTECH_DATA_PATH: e.target.value
                    })}
                    placeholder="data/catalogue-interne.xlsx"
                    className="w-full text-xs p-2.5 border border-border-main rounded-md focus:outline-none focus:ring-1 focus:ring-brand-purple dark:focus:ring-brand-lime font-mono bg-white dark:bg-slate-900 text-text-main"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wide flex items-center space-x-1">
                    <FolderArchive className="w-3.5 h-3.5 text-brand-purple dark:text-brand-lime" />
                    <span>Dossier Archives (.xlsx)</span>
                  </label>
                  <input 
                    type="text" 
                    value={credentials.INTERNAL_ARCHIVES_PATH || credentials.INSERTECH_ARCHIVES_PATH || ""} 
                    onChange={e => setCredentials({ 
                      ...credentials, 
                      INTERNAL_ARCHIVES_PATH: e.target.value,
                      INSERTECH_ARCHIVES_PATH: e.target.value
                    })}
                    placeholder="data/archives/"
                    className="w-full text-xs p-2.5 border border-border-main rounded-md focus:outline-none focus:ring-1 focus:ring-brand-purple dark:focus:ring-brand-lime font-mono bg-white dark:bg-slate-900 text-text-main"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center space-x-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="bg-brand-purple hover:bg-brand-purple-hover text-white dark:bg-brand-lime dark:hover:bg-brand-lime-hover dark:text-slate-950 font-bold px-4 py-2 rounded-lg text-xs flex items-center space-x-2 transition disabled:opacity-50 shadow-md cursor-pointer"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Enregistrer les identifiants</span>
            </button>
            {saveMessage && (
              <span className={`text-[11px] font-bold ${saveMessage.includes('✔️') ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {saveMessage}
              </span>
            )}
          </div>
        </form>
      </div>

    </div>
  );
}
