import React, { useState, useEffect, useMemo, useRef } from "react";
import Sidebar from "./components/Sidebar";
import ModelDetail from "./components/ModelDetail";
import CategoryLayout from "./components/CategoryLayout";
import ExportPanel from "./components/ExportPanel";
import GcsurplusTab from "./components/GcsurplusTab";
import HistoriqueTab from "./components/HistoriqueTab";
import EcartsTab from "./components/EcartsTab";
import AddModelModal from "./components/AddModelModal";
import ConcurrencyModal from "./components/ConcurrencyModal";
import UpdateModal from "./components/UpdateModal";
import SessionInitModal from "./components/SessionInitModal";
import UserSwitchModal from "./components/UserSwitchModal";
import { MASTER_LIST_MODELS } from "./modelsData";
import { AppState, ModelEvaluation, SiteSelectors, SelfHealingStatus, GcsurplusLot, DataSource, HistoricalLogEntry } from "./types";
import { 
  FileSpreadsheet, 
  Settings, 
  Database, 
  Clock, 
  Activity, 
  AlertCircle,
  HelpCircle,
  Laptop,
  Monitor,
  Smartphone,
  TrendingUp,
  User,
  UserCheck,
  UserX,
  ShieldCheck,
  Sun,
  Moon,
  Cpu,
  Sparkles
} from "lucide-react";
import Logo from "./components/Logo";

export default function App() {
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    return localStorage.getItem("insertech_selectedModel") || "ThinkPad T480";
  });
  const [selectedCategory, setSelectedCategory] = useState<string>(() => {
    return localStorage.getItem("insertech_selectedCategory") || "Portables Lenovo";
  });
  const [evaluations, setEvaluations] = useState<Record<string, ModelEvaluation>>({});
  const [selectors, setSelectors] = useState<SiteSelectors | null>(null);
  const [healingStatus, setHealingStatus] = useState<Record<string, SelfHealingStatus>>({});
  const [activeTab, setActiveTab] = useState<string>(() => {
    const saved = localStorage.getItem("insertech_activeTab");
    return saved && saved !== "synthese" && saved !== "sources" ? saved : "portables";
  });
  const [scrapingModels, setScrapingModels] = useState<Record<string, { isScraping: boolean; progress: number; logs: string[] }>>({});
  const activePollIntervalsRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  useEffect(() => {
    return () => {
      activePollIntervalsRef.current.forEach(timer => clearInterval(timer));
      activePollIntervalsRef.current.clear();
    };
  }, []);

  const isScraping = !!scrapingModels[selectedModel]?.isScraping;
  const scrapeProgress = scrapingModels[selectedModel]?.progress || 0;
  const scrapingLogs = scrapingModels[selectedModel]?.logs || [];
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [gcsurplusLots, setGcsurplusLots] = useState<GcsurplusLot[]>([]);
  const [sources, setSources] = useState<DataSource[]>([]);
  const [historicalLog, setHistoricalLog] = useState<HistoricalLogEntry[]>([]);
  const [customModels, setCustomModels] = useState<{ category: string; modelName: string }[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => new Date());

  // --- Système de version & Mises à jour ---
  const [appVersion, setAppVersion] = useState("1.4.1");
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);

  // --- Opérateur & Modals de Session ---
  const [operatorName, setOperatorName] = useState<string>(() => {
    return sessionStorage.getItem("insertech_operatorName") || "";
  });
  const [isSessionInitOpen, setIsSessionInitOpen] = useState<boolean>(() => {
    return !sessionStorage.getItem("insertech_operatorName");
  });
  const [isUserSwitchOpen, setIsUserSwitchOpen] = useState<boolean>(false);

  const handleStartSession = async (userName: string, fileData?: string) => {
    setOperatorName(userName);
    sessionStorage.setItem("insertech_operatorName", userName);

    if (fileData) {
      const result = await handleImportExcel(fileData);
      if (result && !result.success) {
        throw new Error(result.message || "Échec de l'importation du fichier Excel.");
      }
    } else {
      await fetchState();
    }
    setIsSessionInitOpen(false);
  };

  const handleExportAndSwitchUser = async () => {
    setIsUserSwitchOpen(false);
    await handleExportExcel("");
    setIsSessionInitOpen(true);
  };

  const handleSwitchUserWithoutExport = () => {
    setIsUserSwitchOpen(false);
    setIsSessionInitOpen(true);
  };

  const handleResetOperator = () => {
    setIsUserSwitchOpen(true);
  };

  // --- Gestion de la concurrence CPU ---
  const [concurrency, setConcurrency] = useState<number>(() => {
    const saved = localStorage.getItem("insertech_concurrency");
    return saved ? parseInt(saved, 10) : 2;
  });
  const [isConcurrencyModalOpen, setIsConcurrencyModalOpen] = useState(false);


  // -------------------------------------------------------

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const allModelsByCat = useMemo(() => {
    const map: Record<string, string[]> = {};
    MASTER_LIST_MODELS.forEach(cat => {
      const customsForCat = (customModels || [])
        .filter(cm => cm.category === cat.categoryName)
        .map(cm => cm.modelName);
      map[cat.categoryName] = Array.from(new Set([...cat.models, ...customsForCat]));
    });
    return map;
  }, [customModels]);

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem("insertech_theme") as 'light' | 'dark') || "light";
  });

  const toggleTheme = () => {
    setTheme(prev => {
      const next = prev === "light" ? "dark" : "light";
      localStorage.setItem("insertech_theme", next);
      return next;
    });
  };

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  // Persist navigation state to localStorage so tab and model remain selected
  useEffect(() => {
    localStorage.setItem("insertech_selectedModel", selectedModel);
  }, [selectedModel]);

  useEffect(() => {
    localStorage.setItem("insertech_selectedCategory", selectedCategory);
  }, [selectedCategory]);

  useEffect(() => {
    localStorage.setItem("insertech_activeTab", activeTab);
  }, [activeTab]);

  const fetchControllerRef = useRef<AbortController | null>(null);

  // Fetch database state from server API with strict no-cache and cancellation support
  const fetchState = async () => {
    if (fetchControllerRef.current) {
      fetchControllerRef.current.abort();
    }
    const controller = new AbortController();
    fetchControllerRef.current = controller;

    try {
      const res = await fetch("/api/state", {
        signal: controller.signal,
        headers: { "Cache-Control": "no-cache, no-store, must-revalidate" }
      });
      if (res.ok) {
        const data: AppState = await res.json();
        setEvaluations(data.evaluations || {});
        setSelectors(data.selectors || null);
        setHealingStatus(data.healingStatus || {});
        setGcsurplusLots(data.gcsurplusLots || []);
        setSources(data.sources || []);
        setHistoricalLog(data.historicalLog || []);
        setCustomModels(data.customModels || []);
        setErrorMsg(null);
      } else {
        setErrorMsg("Impossible de récupérer l'état de l'application depuis le serveur.");
      }

      // Synchroniser la version exacte renvoyée par le serveur backend
      const vRes = await fetch("/api/version", {
        signal: controller.signal,
        headers: { "Cache-Control": "no-cache" }
      });
      if (vRes.ok) {
        const vData = await vRes.json();
        if (vData.version) setAppVersion(vData.version);
      }
    } catch (err: any) {
      if (err.name === "AbortError") return;
      console.error("Error fetching state:", err);
      setErrorMsg("Erreur réseau de communication avec le serveur backend.");
    }
  };

  // Synchronisation automatique en arrière-plan (polling toutes les 3s)
  useEffect(() => {
    fetchState();
    const interval = setInterval(() => {
      fetchState();
    }, 3000);
    return () => {
      clearInterval(interval);
      if (fetchControllerRef.current) {
        fetchControllerRef.current.abort();
      }
    };
  }, []);

  // Handle Model Selection
  const handleSelectModel = (model: string, category: string) => {
    setSelectedModel(model);
    setSelectedCategory(category);
  };

  // Trigger Live Scraping or Simulation of HTML Changes (Auto-Heal fallback)
  const handleScrapeModel = async (model: string, simulateFailure = false, customCategory?: string) => {
    if (scrapingModels[model]?.isScraping) return;

    setScrapingModels(prev => ({
      ...prev,
      [model]: {
        isScraping: true,
        progress: 0,
        logs: [`[${new Date().toLocaleTimeString('fr-CA')}] Démarrage de la requête de collecte standard pour ${model}...`]
      }
    }));
    setErrorMsg(null);

    const category = customCategory || selectedCategory;

    try {
      const startRes = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          category,
          simulateFailure,
          operator: operatorName,
          concurrency
        }),
      });

      const startData = await startRes.json();
      if (!startData.success) {
        setScrapingModels(prev => ({
          ...prev,
          [model]: {
            isScraping: false,
            progress: 0,
            logs: [...(prev[model]?.logs || []), `❌ Échec du démarrage de la tâche : ${startData.message}`]
          }
        }));
        return;
      }

      setScrapingModels(prev => ({
        ...prev,
        [model]: {
          isScraping: true,
          progress: 10,
          logs: [...(prev[model]?.logs || []), `[${new Date().toLocaleTimeString('fr-CA')}] Tâche d'ingestion lancée en arrière-plan. Analyse en cours...`]
        }
      }));

      // Nettoyer un timer précédent si existant pour ce modèle
      if (activePollIntervalsRef.current.has(model)) {
        clearInterval(activePollIntervalsRef.current.get(model)!);
        activePollIntervalsRef.current.delete(model);
      }

      // Suivi continu sans délai d'attente artificiel (attente complète des données)
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/scrape/status?model=${encodeURIComponent(model)}`);
          if (!statusRes.ok) return;
          const statusData = await statusRes.json();
          if (statusData.success) {
            setScrapingModels(prev => {
              const currentModelData = prev[model];
              const newIsScraping = statusData.status !== "completed" && statusData.status !== "failed";
              const newProgress = statusData.progress ?? currentModelData?.progress ?? 0;
              const newLogs = statusData.logs ?? currentModelData?.logs ?? [];

              if (
                currentModelData &&
                currentModelData.isScraping === newIsScraping &&
                currentModelData.progress === newProgress &&
                currentModelData.logs.length === newLogs.length
              ) {
                return prev;
              }

              return {
                ...prev,
                [model]: {
                  isScraping: newIsScraping,
                  progress: newProgress,
                  logs: newLogs
                }
              };
            });

            if (statusData.status === "completed") {
              clearInterval(pollInterval);
              activePollIntervalsRef.current.delete(model);
              if (statusData.evaluation) {
                setEvaluations(prev => ({
                  ...prev,
                  [model]: statusData.evaluation
                }));
              }
              if (simulateFailure) {
                setHealingStatus(prev => ({
                  ...prev,
                  eBay: {
                    status: "HEALED",
                    source: "Gist",
                    lastChecked: new Date().toISOString(),
                    details: "Résilience active : L'extraction s'est auto-réparée avec succès via le Registre de secours Gist."
                  }
                }));
              }
              await fetchState();
            } else if (statusData.status === "failed") {
              clearInterval(pollInterval);
              activePollIntervalsRef.current.delete(model);
              setErrorMsg(statusData.error || "La tâche d'extraction a échoué.");
            }
          }
        } catch (pollErr: any) {
          console.error("Polling error:", pollErr);
        }
      }, 1000);

      activePollIntervalsRef.current.set(model, pollInterval);

    } catch (err: any) {
      setScrapingModels(prev => ({
        ...prev,
        [model]: {
          isScraping: false,
          progress: 0,
          logs: [...(prev[model]?.logs || []), `❌ Échec de communication : ${err.message}`]
        }
      }));
    }
  };

  // Human validation: toggle checkboxes or manually adjust price
  const handleUpdateListing = async (modelName: string, listingId: string, included: boolean, price?: number) => {
    try {
      const res = await fetch("/api/evaluations/update-listing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelName, listingId, included, price, operator: operatorName }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setEvaluations(prev => ({
            ...prev,
            [modelName]: data.evaluation
          }));
        }
      }
    } catch (err) {
      console.error("Error updating listing:", err);
    }
  };

  // Human validation: update configuration, condition, comments
  const handleUpdateMeta = async (modelName: string, configuration: string, condition: string, commentaires: string) => {
    try {
      const res = await fetch("/api/evaluations/update-meta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelName, configuration, condition, commentaires, operator: operatorName }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setEvaluations(prev => ({
            ...prev,
            [modelName]: data.evaluation
          }));
          // Trigger audit history refresh
          await fetchState();
        }
      }
    } catch (err) {
      console.error("Error updating metadata:", err);
    }
  };

  // Save CSS selectors manually
  const handleSaveSelectors = async (newSelectors: SiteSelectors) => {
    try {
      const res = await fetch("/api/selectors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectors: newSelectors }),
      });
      if (res.ok) {
        const data = await res.json();
        setSelectors(data.selectors);
        await fetchState();
      }
    } catch (err) {
      console.error("Error saving selectors:", err);
    }
  };

  // Check CSS selectors integrity
  const handleRunHealthCheck = async (site: "eBay" | "backMarket") => {
    try {
      const res = await fetch("/api/selectors/health-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site }),
      });
      if (res.ok) {
        await fetchState();
      }
    } catch (err) {
      console.error("Error running healthcheck:", err);
    }
  };

  // Run CSS selectors heal from registry
  const handleTriggerHeal = async (site: "eBay" | "backMarket") => {
    try {
      const res = await fetch("/api/selectors/heal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.selectors) {
          setSelectors(data.selectors);
        }
        await fetchState();
      }
    } catch (err) {
      console.error("Error healing selectors:", err);
    }
  };

  // Export full excel report API
  const handleExportExcel = async (targetPath: string) => {
    const res = await fetch("/api/export-excel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetPath }),
    });
    return await res.json();
  };

  const handleImportExcel = async (fileData: string) => {
    try {
      const res = await fetch("/api/import-excel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileData }),
      });
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await res.json();
        if (data.success) {
          await fetchState();
        }
        return data;
      } else {
        const text = await res.text();
        console.error("Non-JSON response from server:", text);
        return { success: false, message: `Erreur du serveur (HTTP ${res.status}). Vérifiez le format du fichier Excel.` };
      }
    } catch (err: any) {
      console.error("Error importing Excel:", err);
      return { success: false, message: `Erreur réseau ou d'importation : ${err.message}` };
    }
  };

  const handlePurgeAll = async () => {
    const res = await fetch("/api/purge-all", {
      method: "POST"
    });
    if (res.ok) {
      await fetchState();
    }
  };

  return (
    <div className="min-h-screen bg-bg-app text-text-main flex flex-col font-sans transition-colors duration-200" id="app-wrapper">
      {/* High-Contrast Technical Top Bar */}
      <header className="bg-brand-purple dark:bg-slate-950 text-white border-b border-black/20 shrink-0" id="app-header">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-4" id="header-content">
          <div>
            <div className="flex items-center space-x-3">
              <Logo className="h-8 md:h-10" />

            </div>
            <h1 className="text-xl font-serif font-bold text-white tracking-normal mt-1.5">
              Évaluateur de tarif du marché reconditionné
            </h1>
            <p className="text-[11px] text-slate-300 mt-0.5">
              Plateforme d'audit autonome : résilience heuristique, nettoyage statistique et preuves comptables réglementaires.
            </p>
          </div>

          {/* Status indicators & Theme toggle */}
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono" id="status-indicators">

            <button
              onClick={() => setIsUserSwitchOpen(true)}
              className="inline-flex items-center space-x-1.5 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-400/40 px-2.5 py-1 rounded-sm text-blue-200 cursor-pointer transition-all active:scale-95 text-[10px] font-bold"
              id="btn-user-switch"
              title="Changer d'utilisateur / Fin de session"
            >
              <UserCheck className="w-3.5 h-3.5 text-blue-300" />
              <span>Usager : {operatorName || "Non défini"}</span>
            </button>

            <span className="inline-flex items-center space-x-1.5 bg-white/5 border border-white/10 px-2.5 py-1 rounded-sm text-slate-300">
              <span className="font-semibold select-all">
                {currentTime.toLocaleDateString("fr-CA", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                }).toUpperCase()}{" - "}{currentTime.toLocaleTimeString("fr-CA")}
              </span>
            </span>

            <button
              onClick={() => setIsUpdateModalOpen(true)}
              className="inline-flex items-center space-x-1 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-400/40 px-2 py-1 rounded-sm text-purple-200 cursor-pointer transition-all active:scale-95 text-[10px] font-bold"
              id="btn-version-update"
              title="Vérifier la version et les mises à jour"
            >
              <Sparkles className="w-3 h-3 text-purple-300" />
              <span>v{appVersion}</span>
            </button>

            <button
              onClick={() => setIsConcurrencyModalOpen(true)}
              className="inline-flex items-center space-x-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 px-2.5 py-1 rounded-sm text-amber-200 cursor-pointer transition-all active:scale-95 text-[10px] font-bold"
              id="btn-concurrency-modal"
              title="Ajuster la concurrence / puissance CPU"
            >
              <Cpu className="w-3.5 h-3.5 text-amber-400" />
              <span>CPU : {concurrency} {concurrency === 1 ? 'SOURCE' : 'SOURCES'}</span>
            </button>

            <button
              onClick={() => setActiveTab("export")}
              className={`inline-flex items-center space-x-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 px-2.5 py-1 rounded-sm text-emerald-200 cursor-pointer transition-all active:scale-95 text-[10px] font-bold ${
                activeTab === "export" ? "ring-2 ring-emerald-400" : ""
              }`}
              id="btn-header-export"
              title="Exporter les évaluations vers Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>EXPORT</span>
            </button>

            <button
              onClick={toggleTheme}
              className="inline-flex items-center space-x-1.5 bg-white/10 hover:bg-white/20 border border-white/20 px-2.5 py-1 rounded-sm text-white cursor-pointer transition-all active:scale-95 text-[10px] font-bold"
              id="btn-theme-toggle"
              title="Basculer le thème"
            >
              {theme === "light" ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
              <span>{theme === "light" ? "SOMBRE" : "CLAIR"}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Navigation tabs */}
      <nav className="bg-bg-card border-b border-border-main shrink-0 sticky top-0 z-20 shadow-sm transition-colors duration-200" id="main-navigation">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap gap-x-5 gap-y-1" id="navigation-tabs">
          <button
            onClick={() => {
              setActiveTab("portables");
              setSelectedModel("ThinkPad T480");
              setSelectedCategory("Portables Lenovo");
            }}
            className={`flex items-center space-x-1.5 py-2.5 border-b-2 font-bold text-xs transition-all outline-none cursor-pointer ${
              activeTab === "portables"
                ? "border-brand-purple text-brand-purple dark:border-brand-lime dark:text-brand-lime"
                : "border-transparent text-text-muted hover:text-text-main"
            }`}
            id="nav-btn-portables"
          >
            <Laptop className="w-3.5 h-3.5" />
            <span>PORTABLES</span>
          </button>

          <button
            onClick={() => {
              setActiveTab("desktops");
              setSelectedModel("ThinkCentre M720q");
              setSelectedCategory("Desktop Lenovo");
            }}
            className={`flex items-center space-x-1.5 py-2.5 border-b-2 font-bold text-xs transition-all outline-none cursor-pointer ${
              activeTab === "desktops"
                ? "border-brand-purple text-brand-purple dark:border-brand-lime dark:text-brand-lime"
                : "border-transparent text-text-muted hover:text-text-main"
            }`}
            id="nav-btn-desktops"
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>BUREAU</span>
          </button>

          <button
            onClick={() => {
              setActiveTab("iphone");
              setSelectedModel("iPhone 11");
              setSelectedCategory("iPhones");
            }}
            className={`flex items-center space-x-1.5 py-2.5 border-b-2 font-bold text-xs transition-all outline-none cursor-pointer ${
              activeTab === "iphone"
                ? "border-brand-purple text-brand-purple dark:border-brand-lime dark:text-brand-lime"
                : "border-transparent text-text-muted hover:text-text-main"
            }`}
            id="nav-btn-iphone"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>IPHONE</span>
          </button>

          <button
            onClick={() => setActiveTab("historique")}
            className={`flex items-center space-x-1.5 py-2.5 border-b-2 font-bold text-xs transition-all outline-none cursor-pointer ${
              activeTab === "historique"
                ? "border-brand-purple text-brand-purple dark:border-brand-lime dark:text-brand-lime"
                : "border-transparent text-text-muted hover:text-text-main"
            }`}
            id="nav-btn-historique"
          >
            <Clock className="w-3.5 h-3.5" />
            <span>HISTORIQUE</span>
          </button>

          <button
            onClick={() => setActiveTab("ecarts")}
            className={`flex items-center space-x-1.5 py-2.5 border-b-2 font-bold text-xs transition-all outline-none cursor-pointer ${
              activeTab === "ecarts"
                ? "border-brand-purple text-brand-purple dark:border-brand-lime dark:text-brand-lime"
                : "border-transparent text-text-muted hover:text-text-main"
            }`}
            id="nav-btn-ecarts"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>ÉCARTS</span>
          </button>

          <div className="flex-1 min-w-4"></div>



        </div>
      </nav>

      {/* Main Content Pane */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 flex flex-col overflow-hidden" id="main-content-pane">
        {errorMsg && (
          <div className="mb-3 p-3 bg-rose-50 border border-rose-200 rounded text-rose-800 text-xs flex items-start space-x-2 animate-fadeIn" id="app-global-error">
            <AlertCircle className="w-4 h-4 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Ordinateurs Portables Tab */}
        {activeTab === "portables" && (
          <CategoryLayout
            id="portables-layout"
            filterCategories={["Portables Lenovo", "Portables Dell", "Portables Dell XPS", "Portables HP", "Apple"]}
            selectedModel={selectedModel}
            onSelectModel={handleSelectModel}
            evaluations={evaluations}
            customModels={customModels}
            onOpenAddModel={() => setIsAddModalOpen(true)}
            onScrapeModel={handleScrapeModel}
            scrapingModels={scrapingModels}
            selectedCategory={selectedCategory}
            onUpdateListing={handleUpdateListing}
            onUpdateMeta={handleUpdateMeta}
            scrapingLogs={scrapingLogs}
            isScraping={isScraping}
            scrapeProgress={scrapeProgress}
            concurrency={concurrency}
            onOpenConcurrencyModal={() => setIsConcurrencyModalOpen(true)}
          />
        )}

        {/* Ordinateurs de Bureau Tab */}
        {activeTab === "desktops" && (
          <CategoryLayout
            id="desktops-layout"
            filterCategories={["Desktop Lenovo", "Desktop Dell", "Desktop HP"]}
            selectedModel={selectedModel}
            onSelectModel={handleSelectModel}
            evaluations={evaluations}
            customModels={customModels}
            onOpenAddModel={() => setIsAddModalOpen(true)}
            onScrapeModel={handleScrapeModel}
            scrapingModels={scrapingModels}
            selectedCategory={selectedCategory}
            onUpdateListing={handleUpdateListing}
            onUpdateMeta={handleUpdateMeta}
            scrapingLogs={scrapingLogs}
            isScraping={isScraping}
            scrapeProgress={scrapeProgress}
            concurrency={concurrency}
            onOpenConcurrencyModal={() => setIsConcurrencyModalOpen(true)}
          />
        )}

        {/* iPhone Tab */}
        {activeTab === "iphone" && (
          <CategoryLayout
            id="iphone-layout"
            filterCategories={["iPhones"]}
            selectedModel={selectedModel}
            onSelectModel={handleSelectModel}
            evaluations={evaluations}
            customModels={customModels}
            onOpenAddModel={() => setIsAddModalOpen(true)}
            onScrapeModel={handleScrapeModel}
            scrapingModels={scrapingModels}
            selectedCategory={selectedCategory}
            onUpdateListing={handleUpdateListing}
            onUpdateMeta={handleUpdateMeta}
            scrapingLogs={scrapingLogs}
            isScraping={isScraping}
            scrapeProgress={scrapeProgress}
            concurrency={concurrency}
            onOpenConcurrencyModal={() => setIsConcurrencyModalOpen(true)}
          />
        )}



        {/* Historique Tab */}
        {activeTab === "historique" && (
          <HistoriqueTab logs={historicalLog} />
        )}

        {/* Écarts Tab */}
        {activeTab === "ecarts" && (
          <EcartsTab evaluations={evaluations} />
        )}



        {/* Export tab */}
        {activeTab === "export" && (
          <div className="max-w-2xl mx-auto w-full py-4 animate-fadeIn" id="tab-export">
            <ExportPanel onExport={handleExportExcel} onImport={handleImportExcel} />
          </div>
        )}
      </main>

      {/* Modal d'ajout de modèle */}
      <AddModelModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        existingModelsByCat={allModelsByCat}
        onModelAdded={async (cat, model, returnedCustomModels, returnedEvaluations) => {
          if (returnedCustomModels && Array.isArray(returnedCustomModels)) {
            setCustomModels(returnedCustomModels);
          }
          if (returnedEvaluations) {
            setEvaluations(returnedEvaluations);
          }
          if (cat.includes("Desktop") || cat.includes("Tours")) {
            setActiveTab("desktops");
          } else if (cat.includes("iPhone")) {
            setActiveTab("iphone");
          } else {
            setActiveTab("portables");
          }
          handleSelectModel(model, cat);
          await fetchState();
          handleScrapeModel(model, false, cat);
        }}
      />



      {/* Modal de configuration de la concurrence CPU */}
      <ConcurrencyModal
        isOpen={isConcurrencyModalOpen}
        onClose={() => setIsConcurrencyModalOpen(false)}
        concurrency={concurrency}
        onSaveConcurrency={(value) => {
          setConcurrency(value);
          localStorage.setItem("insertech_concurrency", value.toString());
        }}
      />

      {/* Modal de version et mise à jour */}
      <UpdateModal
        isOpen={isUpdateModalOpen}
        onClose={() => setIsUpdateModalOpen(false)}
        currentVersion={appVersion}
      />

      {/* Modal d'initialisation de session et import Excel */}
      <SessionInitModal
        isOpen={isSessionInitOpen}
        onStartSession={handleStartSession}
        hasExistingMasterFile={true}
      />

      {/* Modal de changement d'utilisateur avec option d'export et Annuler */}
      <UserSwitchModal
        isOpen={isUserSwitchOpen}
        currentUser={operatorName}
        onClose={() => setIsUserSwitchOpen(false)}
        onExportAndSwitch={handleExportAndSwitchUser}
        onSwitchWithoutExport={handleSwitchUserWithoutExport}
      />

    </div>
  );
}
