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
  RefreshCw
} from "lucide-react";
import { DataSource, OrganizationConfig } from "../types";
import Logo from "./Logo";
import HelpTooltip from "./common/HelpTooltip";
import { HELP_CONTENT } from "../constants/helpContent";

interface SourcesTabProps {
  sources: DataSource[];
  onPurgeAll?: () => Promise<void>;
  organization?: OrganizationConfig;
  onOrganizationUpdate?: (org: OrganizationConfig) => void;
}

export default function SourcesTab({ sources, onPurgeAll, organization, onOrganizationUpdate }: SourcesTabProps) {
  const [credentials, setCredentials] = useState<{
    GCSURPLUS_USERNAME?: string;
    GCSURPLUS_PASSWORD?: string;
    INTERNAL_CATALOG_PATH?: string;
    INTERNAL_ARCHIVES_PATH?: string;
    INSERTECH_DATA_PATH?: string;
    INSERTECH_ARCHIVES_PATH?: string;
    EBAY_APP_ID?: string;
    EBAY_CERT_ID?: string;
    BESTBUY_API_KEY?: string;
  }>({});
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
      alert("L'image ne doit pas dépasser 2 Mo.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setOrgConfig(prev => ({ ...prev, logoUrl: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [purging, setPurging] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"api" | "local" | "gcsurplus">("api");

  useEffect(() => {
    fetch("/api/credentials")
      .then(res => res.json())
      .then(data => {
        if (data && data.success && data.credentials) {
          setCredentials(data.credentials);
        }
      })
      .catch(err => console.error("Erreur chargement credentials:", err));
  }, []);

  const handleSaveCredentials = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    setSaveMessage(null);
    try {
      const res = await fetch("/api/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credentials })
      });
      const data = await res.json();
      if (data && data.success) {
        setSaveMessage("✔️ Configurations enregistrées avec succès !");
        setTimeout(() => setSaveMessage(null), 4000);
      } else {
        setSaveMessage("⚠️ Erreur lors de l'enregistrement.");
      }
    } catch (err) {
      setSaveMessage("⚠️ Erreur de connexion au serveur.");
    } finally {
      setSaving(false);
    }
  };

  const handlePurgeAll = async () => {
    if (!window.confirm("Êtes-vous sûr de vouloir purger toutes les évaluations et l'historique de l'application ? Cette action videra également les caches de scraping locaux.")) {
      return;
    }
    setPurging(true);
    try {
      if (onPurgeAll) {
        await onPurgeAll();
      }
      alert("Purge de la base de données effectuée avec succès.");
    } catch (err) {
      console.error("Purge error:", err);
      alert("Erreur technique lors de la purge.");
    } finally {
      setPurging(false);
    }
  };

  // Helper to format scan methods beautifully
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
    <div className="space-y-8 animate-fadeIn" id="sources-tab-container">
      
      {/* SECTION 0: Organisation & Image de Marque (Marque Blanche) */}
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

      {/* SECTION 1: Architecture & Global Configuration */}
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

            <div className="space-y-4 relative">
              {/* Vertical connector line */}
              <div className="absolute left-6 top-3 bottom-3 w-[1px] bg-slate-200 dark:bg-slate-800 z-0" />

              {/* Tier 1 */}
              <div className="flex items-start space-x-4 relative z-10">
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 flex items-center justify-center font-title text-base font-bold text-blue-700 dark:text-blue-400">
                  1
                </div>
                <div className="bg-slate-50/50 dark:bg-slate-900/20 p-3 rounded-lg border border-border-main flex-1">
                  <span className="text-xs font-bold text-text-main block">Tier 1 : Got-Scraping (Empreintes TLS)</span>
                  <p className="text-[11px] text-text-muted mt-1 leading-relaxed">
                    Usurpation d'empreintes TLS et en-têtes HTTP de navigateurs réels pour des requêtes directes ultra-rapides.
                  </p>
                </div>
              </div>

              {/* Tier 2 */}
              <div className="flex items-start space-x-4 relative z-10">
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900 flex items-center justify-center font-title text-base font-bold text-purple-700 dark:text-purple-400">
                  2
                </div>
                <div className="bg-slate-50/50 dark:bg-slate-900/20 p-3 rounded-lg border border-border-main flex-1">
                  <span className="text-xs font-bold text-text-main block">Tier 2 : Émulation Chromium Stealth Local</span>
                  <p className="text-[11px] text-text-muted mt-1 leading-relaxed">
                    Si le site utilise des protections anti-bot complexes (Cloudflare/Akamai), un navigateur headless Chromium Stealth s'exécute localement.
                  </p>
                </div>
              </div>

              {/* Tier 3 */}
              <div className="flex items-start space-x-4 relative z-10">
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 flex items-center justify-center font-title text-base font-bold text-emerald-700 dark:text-emerald-400">
                  3
                </div>
                <div className="bg-slate-50/50 dark:bg-slate-900/20 p-3 rounded-lg border border-border-main flex-1">
                  <span className="text-xs font-bold text-text-main block">Tier 3 : Cache Certifié Local</span>
                  <p className="text-[11px] text-text-muted mt-1 leading-relaxed">
                    Stockage temporisé par source et par modèle sur disque local pour garantir la disponibilité constante des évaluations.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Global Settings Section */}
        <div className="lg:col-span-7 bg-bg-card border border-border-main rounded-xl p-6 shadow-md flex flex-col justify-between">
          <form onSubmit={handleSaveCredentials} className="space-y-5">
            
            <div className="flex items-center justify-between pb-3 border-b border-border-main">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-lg bg-brand-purple-light dark:bg-brand-lime-light">
                  <Settings className="w-5 h-5 text-brand-purple dark:text-brand-lime" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-text-main uppercase tracking-wider font-title">
                    Configuration des Connecteurs
                  </h3>
                  <p className="text-[10px] text-text-muted">Gérez vos clés d'APIs, comptes et chemins de fichiers</p>
                </div>
              </div>
            </div>

            {/* Sub Tabs for better organization */}
            <div className="flex space-x-1 p-1 bg-slate-100 dark:bg-slate-800/60 rounded-lg">
              <button
                type="button"
                onClick={() => setActiveTab("api")}
                className={`flex-1 py-1.5 text-xs font-bold rounded-md transition ${
                  activeTab === "api"
                    ? "bg-white dark:bg-slate-900 text-text-main shadow-sm"
                    : "text-text-muted hover:text-text-main"
                }`}
              >
                🔑 Clés d'APIs
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("local")}
                className={`flex-1 py-1.5 text-xs font-bold rounded-md transition ${
                  activeTab === "local"
                    ? "bg-white dark:bg-slate-900 text-text-main shadow-sm"
                    : "text-text-muted hover:text-text-main"
                }`}
              >
                📁 Fichiers Internes & Atelier
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("gcsurplus")}
                className={`flex-1 py-1.5 text-xs font-bold rounded-md transition ${
                  activeTab === "gcsurplus"
                    ? "bg-white dark:bg-slate-900 text-text-main shadow-sm"
                    : "text-text-muted hover:text-text-main"
                }`}
              >
                🛡️ GCSurplus Auth
              </button>
            </div>

            {/* Tab Content: API */}
            {activeTab === "api" && (
              <div className="space-y-4 animate-fadeIn">
                <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/10 rounded-lg border border-emerald-200/40 dark:border-emerald-900/40 text-xs text-text-muted flex items-start space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                  <p>
                    L'application s'appuie désormais sur une <strong>collecte locale 100% autonome</strong> (Playwright Stealth & Got-Scraping). Les clés d'APIs tierces ci-dessous restent optionnelles.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wide mb-1.5">
                      eBay App ID (Optionnel)
                    </label>
                    <input 
                      type="text" 
                      value={credentials.EBAY_APP_ID || ""} 
                      onChange={e => setCredentials({ ...credentials, EBAY_APP_ID: e.target.value })}
                      placeholder="Identifiant d'application API eBay"
                      className="w-full text-xs p-2 border border-border-main rounded-md focus:outline-none focus:ring-1 focus:ring-brand-purple dark:focus:ring-brand-lime font-mono bg-white dark:bg-slate-900 text-text-main"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wide mb-1.5">
                      Best Buy API Key (Optionnel)
                    </label>
                    <input 
                      type="text" 
                      value={credentials.BESTBUY_API_KEY || ""} 
                      onChange={e => setCredentials({ ...credentials, BESTBUY_API_KEY: e.target.value })}
                      placeholder="Clé d'API Best Buy"
                      className="w-full text-xs p-2 border border-border-main rounded-md focus:outline-none focus:ring-1 focus:ring-brand-purple dark:focus:ring-brand-lime font-mono bg-white dark:bg-slate-900 text-text-main"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Tab Content: Local */}
            {activeTab === "local" && (
              <div className="space-y-4 animate-fadeIn">
                <div className="p-3 bg-blue-50/50 dark:bg-blue-950/10 rounded-lg border border-blue-200/40 dark:border-blue-900/40 text-xs text-text-muted flex items-start justify-between">
                  <div className="flex items-start space-x-2">
                    <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                    <p>
                      Ces chemins configurent l'emplacement des fichiers Excel contenant vos grilles de prix internes (boutique et atelier) et vos archives d'anciennes analyses de valeur marchande.
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

            {/* Tab Content: GCSurplus */}
            {activeTab === "gcsurplus" && (
              <div className="space-y-4 animate-fadeIn">
                <div className="p-3 bg-amber-50/50 dark:bg-amber-950/10 rounded-lg border border-amber-200/40 dark:border-amber-900/40 text-xs text-text-muted flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <p>
                    <strong>GCSurplus (GC Surplus Canada)</strong> permet de renseigner des identifiants d'accès d'acheteur pour interroger l'inventaire complet de lots informatiques fermés ou actifs. Sans compte, le moteur bascule en mode de recherche publique.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wide mb-1.5 flex items-center space-x-1">
                      <Lock className="w-3 h-3 text-text-muted" />
                      <span>GCSurplus : Utilisateur</span>
                    </label>
                    <input 
                      type="text" 
                      value={credentials.GCSURPLUS_USERNAME || ""} 
                      onChange={e => setCredentials({ ...credentials, GCSURPLUS_USERNAME: e.target.value })}
                      placeholder="achats@votre-organisation.ca"
                      className="w-full text-xs p-2 border border-border-main rounded-md focus:outline-none focus:ring-1 focus:ring-brand-purple dark:focus:ring-brand-lime font-mono bg-white dark:bg-slate-900 text-text-main"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wide flex items-center space-x-1">
                        <Lock className="w-3 h-3 text-text-muted" />
                        <span>GCSurplus : Mot de passe</span>
                      </label>
                      <button 
                        type="button" 
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-text-muted hover:text-text-main flex items-center space-x-1 text-[9px] lowercase font-normal"
                      >
                        {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        <span>{showPassword ? "Masquer" : "Afficher"}</span>
                      </button>
                    </div>
                    <input 
                      type={showPassword ? "text" : "password"} 
                      value={credentials.GCSURPLUS_PASSWORD || ""} 
                      onChange={e => setCredentials({ ...credentials, GCSURPLUS_PASSWORD: e.target.value })}
                      placeholder="••••••••••••"
                      className="w-full text-xs p-2 border border-border-main rounded-md focus:outline-none focus:ring-1 focus:ring-brand-purple dark:focus:ring-brand-lime font-mono bg-white dark:bg-slate-900 text-text-main"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Save Button Bar */}
            <div className="flex items-center justify-between pt-3.5 border-t border-border-main">
              {saveMessage ? (
                <span className={`text-[11px] font-bold flex items-center space-x-1 ${saveMessage.includes('✔️') ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                  {saveMessage.includes('✔️') && <Check className="w-4 h-4 text-emerald-500" />}
                  <span>{saveMessage}</span>
                </span>
              ) : <span />}
              <div className="flex items-center space-x-1.5">
                <button
                  type="button"
                  onClick={handlePurgeAll}
                  disabled={purging || saving}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-4 py-2 rounded-lg text-xs flex items-center space-x-2 transition disabled:opacity-50 shadow-md cursor-pointer duration-200"
                >
                  {purging ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  <span>Purger toutes les données</span>
                </button>
                <HelpTooltip topic={HELP_CONTENT.purgeCacheBtn} size="xs" side="top" id="srcPurgeHelp" />
              </div>
              <div className="flex items-center space-x-3">
                {saveMessage && (
                  <span className={`text-[11px] font-bold flex items-center space-x-1 ${saveMessage.includes('✔️') ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                    {saveMessage.includes('✔️') && <Check className="w-4 h-4 text-emerald-500" />}
                    <span>{saveMessage}</span>
                  </span>
                )}
                <button 
                  type="submit"
                  disabled={saving || purging}
                  className="bg-brand-purple hover:bg-brand-purple-hover text-white dark:bg-brand-lime dark:hover:bg-brand-lime-hover dark:text-slate-950 font-bold px-4 py-2 rounded-lg text-xs flex items-center space-x-2 transition disabled:opacity-50 shadow-md cursor-pointer duration-200"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span>{saving ? "Sauvegarde..." : "Sauvegarder les configurations"}</span>
                </button>
              </div>
            </div>
          </form>
        </div>

      </div>

      {/* SECTION 2: Active Connectors Registry */}
      <div className="space-y-4">
        <div className="flex items-center space-x-2.5 pb-2 border-b border-border-main">
          <div className="p-1.5 rounded bg-brand-purple-light dark:bg-brand-lime-light">
            <Activity className="w-4 h-4 text-brand-purple dark:text-brand-lime animate-pulse" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-text-main uppercase tracking-wider font-title">
              Registre des Connecteurs Actifs ({sources.length} Sources)
            </h3>
            <p className="text-[10px] text-text-muted">État de santé et méthodes de collecte en temps réel</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" id="sources-grid">
          {sources.map((src, index) => {
            const isActive = src.status.includes("Connecté") || src.status.includes("Actif") || src.status.includes("Connexion") || src.status.includes("Recherche");
            const methodDetails = getScrapeMethodStyle(src.scrapeMethod || src.method);
            return (
              <div 
                key={src.sourceKey || index} 
                className="bg-bg-card rounded-xl border border-border-main p-5 shadow-sm flex flex-col justify-between hover:shadow-md hover:border-brand-purple/40 dark:hover:border-brand-lime/40 transition-all duration-300 transform hover:-translate-y-0.5"
                id={`source-card-${src.sourceKey || index}`}
              >
                <div>
                  <div className="flex items-start justify-between space-x-2">
                    <div className="flex items-center space-x-2">
                      <div className="p-1.5 rounded bg-slate-50 dark:bg-slate-800">
                        <Database className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                      </div>
                      <h4 className="font-bold text-xs text-text-main leading-tight font-title">{src.name}</h4>
                    </div>
                    
                    {/* Status Badge */}
                    <span className={`inline-flex items-center space-x-1 px-2 py-0.5 text-[8px] font-bold uppercase rounded-full border ${
                      isActive 
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50" 
                        : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/50"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-[#2ECC71]' : 'bg-[#F1C40F]'} ${isActive && 'animate-pulse'}`}></span>
                      <span>{src.status}</span>
                    </span>
                  </div>

                  <p className="text-[11px] text-text-muted mt-3 leading-relaxed min-h-[44px]">{src.description}</p>
                  
                  {/* Metadata labels */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {/* Scrape Method */}
                    <span className={`inline-flex items-center space-x-1 text-[9px] font-mono px-2 py-0.5 rounded border ${methodDetails.css}`}>
                      <span>{methodDetails.label}</span>
                    </span>

                    {/* Coverage */}
                    <span className="inline-flex items-center space-x-1 text-[9px] font-mono px-2 py-0.5 rounded bg-slate-50 text-slate-600 border border-slate-200 dark:bg-slate-800/20 dark:text-slate-400 dark:border-slate-800">
                      <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
                      <span>{src.coverage || "Canada"}</span>
                    </span>

                    {/* Authorization status */}
                    <span className={`inline-flex items-center space-x-1 text-[9px] font-mono px-2 py-0.5 rounded border ${
                      src.authorized 
                        ? "bg-purple-50 text-purple-600 border-purple-200 dark:bg-purple-950/10 dark:text-purple-400 dark:border-purple-900/40" 
                        : "bg-slate-50 text-slate-400 border-slate-200 dark:bg-slate-800/10 dark:text-slate-500 dark:border-slate-800/40"
                    }`}>
                      {src.authorized ? <Lock className="w-2.5 h-2.5" /> : <Unlock className="w-2.5 h-2.5" />}
                      <span>{src.authorized ? "Accès Protégé" : "Accès Public"}</span>
                    </span>
                  </div>
                </div>

                {/* Action Link */}
                <div className="mt-4 pt-3 border-t border-border-main flex justify-end">
                  <a 
                    href={src.url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    referrerPolicy="no-referrer"
                    className="inline-flex items-center space-x-1 text-[9px] font-bold text-brand-purple dark:text-brand-lime uppercase tracking-wider hover:underline"
                    id={`btn-source-link-${src.sourceKey || index}`}
                  >
                    <span>Consulter le site</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
