import React, { useState } from "react";
import { ModelEvaluation, ComparableListing } from "../types";
import { 
  Play, 
  RefreshCw,
  Flame, 
  Terminal, 
  TrendingUp, 
  ShieldCheck, 
  Shield,
  Layers, 
  AlertTriangle, 
  ExternalLink, 
  CheckCircle, 
  CheckCircle2,
  HelpCircle,
  Cpu,
  Trash2,
  Sliders,
  Save,
  History
} from "lucide-react";

const getAnomalyReason = (listing: ComparableListing, medianPrice: number): string => {
  const titleLower = listing.title.toLowerCase();
  
  if (/\bno\s+power\b/i.test(titleLower)) {
    return "Appareil non fonctionnel ou ne s'allume pas (NO POWER).";
  }

  if (/\bno\s+ram\b/i.test(titleLower) || /\bno\s+ssd\b/i.test(titleLower) || /\bno\s+storage\b/i.test(titleLower) || /\bno\s+os\b/i.test(titleLower)) {
    return "Composants essentiels manquants (RAM, SSD, OS ou Stockage).";
  }

  if (/\bno\s+ac\b/i.test(titleLower) || /\bno\s+batt\b/i.test(titleLower) || /\bno\s+battery\b/i.test(titleLower) || /\bno\s+charger\b/i.test(titleLower)) {
    return "Accessoires de base manquants (Batterie ou adaptateur secteur).";
  }

  if (/\bgrade\s+d\b/i.test(titleLower)) {
    return "Appareil en mauvais état esthétique ou matériel (Grade D).";
  }

  if (/\b7th\b/i.test(titleLower) || /\b7e\b/i.test(titleLower)) {
    return "Processeur de génération inférieure (7e gén) non conforme pour ce modèle.";
  }

  // Check for defect/parts keywords with word boundaries
  const defectPatterns = [
    /\bparts\b/i,
    /\brepair\b/i,
    /\bbroken\b/i,
    /\bhs\b/i,
    /\bpanne\b/i,
    /\bdefectueux\b/i,
    /\bnon\s+fonctionnel\b/i,
    /\bpour\s+pieces\b/i,
    /\bpour\s+pièces\b/i,
    /\bfissure\b/i,
    /\bcrack\b/i,
    /\blocked\b/i,
    /\bbloqué\b/i
  ];
  if (defectPatterns.some(regex => regex.test(titleLower))) {
    return "Appareil hors-service, incomplet ou vendu pour pièces détachées.";
  }

  // Check for accessory keywords with word boundaries
  const accessoryPatterns = [
    /\bcharger\b/i,
    /\badapter\b/i,
    /\bbattery\b/i,
    /\bkeyboard\b/i,
    /\bfan\b/i,
    /\bcable\b/i,
    /\bchargeur\b/i,
    /\bbatterie\b/i,
    /\bventilateur\b/i,
    /\bcâble\b/i,
    /\balimentation\b/i
  ];
  if (accessoryPatterns.some(regex => regex.test(titleLower))) {
    return "Détecté comme accessoire ou pièce de rechange (chargeur, batterie, etc.).";
  }

  // Check for extreme price variations
  if (medianPrice > 0) {
    if (listing.price < medianPrice * 0.4) {
      return `Prix anormalement bas (${listing.price.toFixed(2)}$ CAD) représentant moins de 40% de la valeur médiane (${medianPrice.toFixed(0)}$ CAD).`;
    }
    if (listing.price > medianPrice * 1.5) {
      return `Prix anormalement élevé (${listing.price.toFixed(2)}$ CAD) dépassant de 150% la valeur médiane (${medianPrice.toFixed(0)}$ CAD).`;
    }
  }

  if (listing.isOutlier) {
    return "Écart de prix extrême détecté par l'analyse interquartile (IQR).";
  }

  return "Écart de prix ou anomalie de configuration détectée.";
};

const cleanLogSource = (log: string) => {
  return log.replace(/\[(?:[a-z0-9-]+)\]\s*/gi, "");
};

const SOURCES_LIST = [
  { key: "ebay-completed", name: "eBay Ventes", icon: "🤝" },
  { key: "ebay-active", name: "eBay Actives", icon: "🏷️" },
  { key: "backmarket", name: "Back Market", icon: "🛒" },
  { key: "reebelo", name: "Reebelo", icon: "📱" },
  { key: "amazon-renewed", name: "Amazon", icon: "📦" },
  { key: "bestbuy", name: "Best Buy", icon: "🔵" },
  { key: "newegg", name: "Newegg CA", icon: "🥚" },
  { key: "refurb-io", name: "Refurb.io", icon: "🇨🇦" },
  { key: "walmart", name: "Walmart", icon: "🏬" },
  { key: "dell", name: "Dell Refurb", icon: "💻" },
  { key: "it-refurbs", name: "IT Refurbs", icon: "🖥️" },
  { key: "canada-computers", name: "Canada Comp", icon: "🔴" },
  { key: "seao", name: "SEAO Québec", icon: "🏛️" },
  { key: "gcsurplus", name: "GCSurplus", icon: "🇨🇦" },
  { key: "insertech-internal", name: "Insertech Interne", icon: "🏢" },
  { key: "insertech-archives", name: "Insertech Archives", icon: "📁" },
];

interface ModelDetailProps {
  modelName: string;
  category: string;
  evaluation: ModelEvaluation | null;
  onScrapeModel: (model: string, simulateFailure: boolean) => Promise<void>;
  onUpdateListing: (modelName: string, listingId: string, included: boolean, price?: number) => Promise<void>;
  onUpdateMeta?: (modelName: string, configuration: string, condition: string, commentaires: string) => Promise<void>;
  scrapingLogs: string[];
  isScraping: boolean;
  scrapeProgress: number;
  concurrency?: number;
  onOpenConcurrencyModal?: () => void;
}

export default function ModelDetail({
  modelName,
  category,
  evaluation,
  onScrapeModel,
  onUpdateListing,
  onUpdateMeta,
  scrapingLogs,
  isScraping,
  scrapeProgress,
  concurrency = 2,
  onOpenConcurrencyModal,
}: ModelDetailProps) {
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [tempPrice, setTempPrice] = useState<string>("");

  const [activePopoverKey, setActivePopoverKey] = useState<string | null>(null);

  const logsContainerRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [scrapingLogs]);

  React.useEffect(() => {
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
  }, [activePopoverKey]);

  const [configInput, setConfigInput] = useState("");
  const [condInput, setCondInput] = useState("");
  const [commentsInput, setCommentsInput] = useState("");
  const [specFilter, setSpecFilter] = useState("");

  const [filterRam, setFilterRam] = useState<string>("Toutes");
  const [filterCpu, setFilterCpu] = useState<string>("Tous");
  const [filterStorage, setFilterStorage] = useState<string>("Tous");
  const [filterYear, setFilterYear] = useState<string>("Toutes");
  const [filterSource, setFilterSource] = useState<string>("Toutes");
  const [filterScreenSize, setFilterScreenSize] = useState<string>("Toutes");
  const [filterOs, setFilterOs] = useState<string>("Tous");
  const [filterWarranty, setFilterWarranty] = useState<string>("Toutes");
  const [filterLot, setFilterLot] = useState<string>("Tous");

  const [sortBy, setSortBy] = useState<'default' | 'price' | 'date' | 'source'>('default');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // États de repli pour chaque section de volet
  const [showSourceSection, setShowSourceSection] = useState<boolean>(false);
  const [showScreenOsSection, setShowScreenOsSection] = useState<boolean>(false);
  const [showWarrantyLotSection, setShowWarrantyLotSection] = useState<boolean>(false);
  const [showHardwareSection, setShowHardwareSection] = useState<boolean>(false);
  const [showTrackingSection, setShowTrackingSection] = useState<boolean>(true);

  const activeFiltersCount = [
    filterRam !== "Toutes",
    filterCpu !== "Tous",
    filterStorage !== "Tous",
    filterYear !== "Toutes",
    filterSource !== "Toutes",
    filterScreenSize !== "Toutes",
    filterOs !== "Tous",
    filterWarranty !== "Toutes",
    filterLot !== "Tous",
    Boolean(specFilter)
  ].filter(Boolean).length;

  const handleSortHeader = (col: 'price' | 'date' | 'source') => {
    if (sortBy === col) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setSortOrder(col === 'price' ? 'desc' : 'asc');
    }
  };

  const getScreenSize = (l: ComparableListing): string => {
    if (l.specs?.screenSize) return l.specs.screenSize;
    const t = l.title;
    const match = t.match(/\b(11\.6|12\.5|13\.3|14\.0|14|15\.6|15|16|17\.3|17|6\.1|6\.7)[\s-]*(?:"|''|inch|in|pouces?)\b/i) ||
                  t.match(/\b(11\.6|12\.5|13\.3|14\.0|14|15\.6|15|16|17\.3|17)\s*(?:FHD|HD|4K|QHD|OLED|IPS)\b/i);
    if (match && match[1]) {
      const r = match[1];
      return r === "14.0" ? '14"' : r === "15.0" ? '15"' : `${r}"`;
    }
    return "";
  };

  const getOs = (l: ComparableListing): string => {
    if (l.specs?.os) return l.specs.os;
    const t = l.title.toLowerCase();
    if (/\bwin(?:dows)?\s*11\s*(?:pro|professionnel)/i.test(t)) return "Windows 11 Pro";
    if (/\bwin(?:dows)?\s*11\s*(?:home|familial|famille)/i.test(t)) return "Windows 11 Familial";
    if (/\bwin(?:dows)?\s*11\b/i.test(t)) return "Windows 11";
    if (/\bwin(?:dows)?\s*10\s*(?:pro|professionnel)/i.test(t)) return "Windows 10 Pro";
    if (/\bwin(?:dows)?\s*10\s*(?:home|familial|famille)/i.test(t)) return "Windows 10 Familial";
    if (/\bwin(?:dows)?\s*10\b/i.test(t)) return "Windows 10";
    if (/\b(?:mac\s*os|macos|os\s*x|sequoia|sonoma|ventura|monterey)\b/i.test(t)) return "macOS";
    if (/\b(?:chrome\s*os|chromebook)\b/i.test(t)) return "ChromeOS";
    if (/\b(?:no\s+os|sans\s+os|freedos|no\s+operating\s+system)\b/i.test(t)) return "No OS";
    return "";
  };

  const hasWarranty = (l: ComparableListing): boolean => {
    if (l.specs?.warranty) return true;
    const src = String(l.source).toLowerCase();
    if (src.includes("back market") || src.includes("amazon") || src.includes("reebelo") || src.includes("best buy") || src.includes("dell refurb") || src.includes("refurb.io") || src.includes("it refurbs") || src.includes("canada comp")) return true;
    const t = l.title.toLowerCase();
    return /\b(?:garantie|warranty|renewed|under\s+warranty|sous\s+garantie|90[- ]day|1[- ]year)\b/i.test(t);
  };

  const isLotItem = (l: ComparableListing): boolean => {
    if (l.specs?.isLot !== undefined) return l.specs.isLot;
    if (l.specs?.unitOrLot === 'lot' || l.saleType === 'wholesale') return true;
    const t = l.title.toLowerCase();
    return /\b(?:lot\s+de|lot\s+of|pack\s+de|bundle\s+of|\bqty\b|\blots\b|\bbulk\b|\blot\b|\bx[2-9]\b|\bx10\b|ensemble\s+de)\b/i.test(t);
  };

  React.useEffect(() => {
    setFilterRam("Toutes");
    setFilterCpu("Tous");
    setFilterStorage("Tous");
    setFilterYear("Toutes");
    setFilterSource("Toutes");
    setFilterScreenSize("Toutes");
    setFilterOs("Tous");
    setFilterWarranty("Toutes");
    setFilterLot("Tous");
    setSpecFilter("");
  }, [modelName]);

  // Sync inputs with evaluation changes
  React.useEffect(() => {
    if (evaluation) {
      setConfigInput(evaluation.configuration || "Intel Core i5, 16 Go RAM, 256 Go SSD");
      setCondInput(evaluation.condition || "Très bon");
      setCommentsInput(evaluation.commentaires || "Tarif stable sur le marché secondaire canadien.");
    }
  }, [modelName, evaluation]);

  const handleSaveMetaDirect = async (cfg: string, cond: string, comm: string) => {
    if (onUpdateMeta) {
      await onUpdateMeta(modelName, cfg, cond, comm);
    }
  };

  const renderSparkline = (historicalPrices?: { date: string; price: number }[], currentPrice?: number) => {
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
    const colorClass = isUp ? "text-rose-600 dark:text-rose-400" : isDown ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500 dark:text-slate-400";

    return (
      <div className="flex items-center space-x-2 mt-2 pt-2 border-t border-slate-200 dark:border-slate-800">
        <div className="flex flex-col">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Tendance historique</span>
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
                className={i === points.length - 1 ? (isUp ? "fill-rose-600" : isDown ? "fill-emerald-600" : "fill-slate-600") : "fill-slate-400"}
              />
            );
          })}
        </svg>
      </div>
    );
  };

  const handlePriceEditStart = (listing: ComparableListing) => {
    setEditingPriceId(listing.id);
    setTempPrice(listing.price.toString());
  };

  const handlePriceEditSave = async (listingId: string) => {
    const val = parseFloat(tempPrice);
    if (!isNaN(val) && val > 0) {
      await onUpdateListing(modelName, listingId, true, val);
    }
    setEditingPriceId(null);
  };

  const handleToggleInclude = async (listing: ComparableListing) => {
    await onUpdateListing(modelName, listing.id, !listing.included);
  };

  const getConfidenceBadgeColor = (confidence: string) => {
    switch (confidence) {
      case "Élevé":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "Moyen":
        return "bg-sky-100 text-sky-800 border-sky-200";
      case "Faible":
        return "bg-amber-100 text-amber-800 border-amber-200";
      default:
        return "bg-slate-100 text-slate-500 border-slate-200";
    }
  };

  // Liste dynamique et exhaustive des 16 sources de données + sources présentes
  const availableSourcesList = React.useMemo(() => {
    const default16 = [
      "Toutes",
      "eBay (Ventes complétées)",
      "eBay (Annonces actives)",
      "Back Market",
      "Reebelo",
      "Amazon Renewed",
      "Best Buy Marketplace",
      "GCSurplus",
      "Newegg Canada (Refurbished)",
      "Refurb.io Canada",
      "Walmart Canada (Restored)",
      "Dell Refurbished Canada",
      "IT Refurbs Canada",
      "Canada Computers (Refurbished)",
      "SEAO (Appels d'offres & Lots publics)",
      "Insertech (Interne)",
      "Insertech (Archives)"
    ];
    const presentSources = new Set<string>(default16);
    if (evaluation?.listings) {
      evaluation.listings.forEach(l => {
        if (l.source) presentSources.add(String(l.source));
      });
    }
    return Array.from(presentSources);
  }, [evaluation?.listings]);

  // Listings triés et filtrés avec précision empirique multi-critères
  const sortedListings = React.useMemo(() => {
    return evaluation?.listings 
      ? [...evaluation.listings].filter(l => {
          const titleLower = l.title.toLowerCase();
          const ramSpec = l.specs?.ram?.toLowerCase() || "";
          const cpuSpec = l.specs?.cpu?.toLowerCase() || "";
          const storageSpec = l.specs?.storage?.toLowerCase() || "";
          const yearSpec = l.specs?.year || "";
          const screenSize = getScreenSize(l);
          const os = getOs(l);
          const hasWarr = hasWarranty(l);
          const isLot = isLotItem(l);

          // Filter RAM
          if (filterRam !== "Toutes") {
            if (filterRam === "8 Go" && !ramSpec.includes("8") && !titleLower.includes("8go") && !titleLower.includes("8 gb") && !titleLower.includes("8gb")) return false;
            if (filterRam === "16 Go" && !ramSpec.includes("16") && !titleLower.includes("16go") && !titleLower.includes("16 gb") && !titleLower.includes("16gb")) return false;
            if (filterRam === "32 Go+" && !ramSpec.includes("32") && !ramSpec.includes("64") && !titleLower.includes("32go") && !titleLower.includes("32 gb") && !titleLower.includes("64gb")) return false;
          }

          // Filter CPU
          if (filterCpu !== "Tous") {
            if (filterCpu === "Core i5" && !cpuSpec.includes("i5") && !titleLower.includes("i5")) return false;
            if (filterCpu === "Core i7" && !cpuSpec.includes("i7") && !titleLower.includes("i7")) return false;
            if (filterCpu === "Core i9" && !cpuSpec.includes("i9") && !titleLower.includes("i9")) return false;
            if (filterCpu === "Ryzen" && !cpuSpec.includes("ryzen") && !titleLower.includes("ryzen")) return false;
            if (filterCpu === "Apple M" && !cpuSpec.includes("m1") && !cpuSpec.includes("m2") && !cpuSpec.includes("m3") && !titleLower.includes("m1") && !titleLower.includes("m2") && !titleLower.includes("m3")) return false;
          }

          // Filter Storage
          if (filterStorage !== "Tous") {
            if (filterStorage === "256 Go" && !storageSpec.includes("256") && !titleLower.includes("256")) return false;
            if (filterStorage === "512 Go" && !storageSpec.includes("512") && !titleLower.includes("512")) return false;
            if (filterStorage === "1 To+" && !storageSpec.includes("1 to") && !storageSpec.includes("1tb") && !storageSpec.includes("2 to") && !storageSpec.includes("2tb") && !titleLower.includes("1to") && !titleLower.includes("1tb") && !titleLower.includes("2tb")) return false;
          }

          // Filter Year
          if (filterYear !== "Toutes") {
            const yNum = parseInt(yearSpec) || 0;
            if (filterYear === "2023+" && !(yNum >= 2023 || titleLower.includes("2023") || titleLower.includes("2024") || titleLower.includes("2025"))) return false;
            if (filterYear === "2021-2022" && !(yNum === 2021 || yNum === 2022 || titleLower.includes("2021") || titleLower.includes("2022"))) return false;
            if (filterYear === "2020 ou -" && !(yNum > 0 && yNum <= 2020 || titleLower.includes("2020") || titleLower.includes("2019") || titleLower.includes("2018"))) return false;
          }

          // Filter Screen Size
          if (filterScreenSize !== "Toutes") {
            if (filterScreenSize === '11-12"' && !['11.6"', '12.5"', '12"'].includes(screenSize) && !titleLower.includes("11.6") && !titleLower.includes("12.5") && !titleLower.includes('12"')) return false;
            if (filterScreenSize === '13-13.3"' && !['13.3"', '13"', '13.4"'].includes(screenSize) && !titleLower.includes("13.3") && !titleLower.includes('13"')) return false;
            if (filterScreenSize === '14"' && !['14"', '14.0"'].includes(screenSize) && !titleLower.includes("14")) return false;
            if (filterScreenSize === '15-15.6"' && !['15.6"', '15"', '15.4"'].includes(screenSize) && !titleLower.includes("15.6") && !titleLower.includes('15"')) return false;
            if (filterScreenSize === '16-17"+' && !['16"', '17.3"', '17"'].includes(screenSize) && !titleLower.includes("16") && !titleLower.includes("17.3") && !titleLower.includes('17"')) return false;
          }

          // Filter OS
          if (filterOs !== "Tous") {
            if (filterOs === "Win 11 Pro" && os !== "Windows 11 Pro" && !titleLower.includes("win 11 pro") && !titleLower.includes("windows 11 pro")) return false;
            if (filterOs === "Win 11 Home" && os !== "Windows 11 Familial" && !titleLower.includes("win 11 home") && !titleLower.includes("windows 11 home") && !titleLower.includes("11 familial")) return false;
            if (filterOs === "Win 10 Pro" && os !== "Windows 10 Pro" && !titleLower.includes("win 10 pro") && !titleLower.includes("windows 10 pro")) return false;
            if (filterOs === "Win 10 Home" && os !== "Windows 10 Familial" && !titleLower.includes("win 10 home") && !titleLower.includes("windows 10 home") && !titleLower.includes("10 familial")) return false;
            if (filterOs === "macOS" && os !== "macOS" && !titleLower.includes("macos") && !titleLower.includes("mac os")) return false;
            if (filterOs === "ChromeOS" && os !== "ChromeOS" && !titleLower.includes("chromeos") && !titleLower.includes("chromebook")) return false;
            if (filterOs === "Sans OS / No OS" && os !== "No OS" && !titleLower.includes("no os") && !titleLower.includes("sans os") && !titleLower.includes("freedos")) return false;
          }

          // Filter Warranty
          if (filterWarranty !== "Toutes") {
            if (filterWarranty === "Avec garantie" && !hasWarr) return false;
            if (filterWarranty === "Sans garantie mentionnée" && hasWarr) return false;
          }

          // Filter Lot vs Unit
          if (filterLot !== "Tous") {
            if (filterLot === "Unité" && isLot) return false;
            if (filterLot === "Lot" && !isLot) return false;
          }

          // Filter Source (gérant parfaitement les 16 sources)
          if (filterSource !== "Toutes") {
            const srcString = String(l.source).toLowerCase();
            const targetSource = filterSource.toLowerCase();
            if (filterSource === "eBay (Ventes complétées)" || filterSource === "eBay Ventes") {
              if (!srcString.includes("ventes") && !srcString.includes("completed") && l.sourceKey !== "ebay-completed") return false;
            } else if (filterSource === "eBay (Annonces actives)" || filterSource === "eBay Actives") {
              if (!srcString.includes("actives") && !srcString.includes("active") && l.sourceKey !== "ebay-active") return false;
            } else {
              const cleanedTarget = targetSource
                .replace(/\s*\([^)]*\)/g, "")
                .trim();
              if (!srcString.includes(cleanedTarget) && l.sourceKey !== targetSource) return false;
            }
          }

          // Filter Spec/Keyword Filter
          if (specFilter.trim()) {
            const q = specFilter.toLowerCase();
            const specsText = l.specs ? `${l.specs.year || ""} ${l.specs.cpu || ""} ${l.specs.ram || ""} ${l.specs.storage || ""} ${l.specs.model || ""} ${screenSize} ${os}`.toLowerCase() : "";
            if (!titleLower.includes(q) && !specsText.includes(q) && !String(l.source).toLowerCase().includes(q)) return false;
          }

          return true;
        }).sort((a, b) => {
          if (sortBy === 'price') {
            return sortOrder === 'asc' ? a.price - b.price : b.price - a.price;
          }
          if (sortBy === 'date') {
            const dateA = new Date(a.date).getTime() || 0;
            const dateB = new Date(b.date).getTime() || 0;
            return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
          }
          if (sortBy === 'source') {
            const srcA = String(a.source).toLowerCase();
            const srcB = String(b.source).toLowerCase();
            return sortOrder === 'asc' ? srcA.localeCompare(srcB) : srcB.localeCompare(srcA);
          }

          // Tri par défaut : annonces sélectionnées d'abord, puis par prix décroissant
          if (a.included !== b.included) return a.included ? -1 : 1;
          return b.price - a.price;
        })
      : [];
  }, [evaluation?.listings, filterRam, filterCpu, filterStorage, filterYear, filterSource, filterScreenSize, filterOs, filterWarranty, filterLot, specFilter, sortBy, sortOrder]);

  // Calculate standard deviation for active listings
  const standardDeviation = React.useMemo(() => {
    const activePrices = evaluation?.listings.filter(l => l.included).map(l => l.price) || [];
    if (activePrices.length > 1) {
      const mean = activePrices.reduce((a, b) => a + b, 0) / activePrices.length;
      const variance = activePrices.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / activePrices.length;
      return Math.sqrt(variance);
    } else if (activePrices.length === 1) {
      return activePrices[0] * 0.05; // 5% fallback
    }
    return 0;
  }, [evaluation?.listings]);

  const parsedSources = React.useMemo(() => {
    const list = [
      { key: "general", name: "Orchestrateur", icon: "⚙️", logs: [] as string[], status: isScraping ? "running" : ("success" as any), progress: isScraping ? scrapeProgress : 100, listingCount: 0 },
      ...SOURCES_LIST.map(s => ({
        ...s,
        logs: [] as string[],
        status: "idle" as "idle" | "running" | "success" | "failed",
        progress: 0,
        listingCount: 0
      }))
    ];

    scrapingLogs.forEach(log => {
      let found = false;
      for (const item of list) {
        if (item.key === "general") continue;
        if (log.includes(`[${item.key}]`) || (item.key === "facebook" && log.includes("[facebook-marketplace]"))) {
          item.logs.push(log);
          found = true;
          
          if (log.includes("🚀") || log.includes("Scraping direct") || log.includes("Extraction via")) {
            item.status = "running";
            item.progress = 50;
          }
          if (log.includes("✔️") || log.includes("produits extraits") || log.includes("ventes complétées trouvées") || log.includes("success") || log.includes("complété")) {
            item.status = "success";
            item.progress = 100;
            const countMatch = log.match(/(\d+)\s+(?:produits|ventes|annonces|comparables|lots)/i);
            if (countMatch && countMatch[1]) {
              item.listingCount = parseInt(countMatch[1], 10);
            }
          }
          if (log.includes("❌") || log.includes("Échec") || (log.includes("échoué") && !log.includes("retrying")) || log.includes("error")) {
            item.status = "failed";
            item.progress = 100;
          }
          break;
        }
      }
      
      if (!found) {
        list[0].logs.push(log);
      }
    });

    list.forEach(item => {
      if (item.key !== "general" && isScraping && item.logs.length > 0 && item.status === "idle") {
        item.status = "running";
        item.progress = 40;
      }
      if (!isScraping && item.key !== "general") {
        if (item.status === "running") {
          item.status = "success";
          item.progress = 100;
        }
      }
    });

    return list;
  }, [scrapingLogs, isScraping, scrapeProgress]);

  const getStatusColorClass = (status: string) => {
    switch (status) {
      case "running":
        return "text-blue-600 bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-800/40";
      case "success":
        return "text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-800/40";
      case "failed":
        return "text-rose-600 bg-rose-50 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-800/40";
      default:
        return "text-slate-400 bg-slate-50 border-slate-200 dark:bg-slate-800/40 dark:text-slate-500 dark:border-slate-800";
    }
  };

  const getStatusLabel = (item: any) => {
    if (item.status === "idle") return "En attente";
    if (item.status === "running") return "Collecte...";
    if (item.status === "failed") return "Aucun résultat";
    if (item.status === "success") {
      if (item.key === "general") return "Prêt";
      return `${item.listingCount} comparable(s)`;
    }
    return "En attente";
  };

  const activeItem = React.useMemo(() => {
    return parsedSources.find(item => activePopoverKey === item.key) || 
           parsedSources.find(item => item.key === "general");
  }, [parsedSources, activePopoverKey]);

  return (
    <div className="space-y-4" id="model-detail-container">
      {/* Overview Card */}
      <div className="bg-white rounded-lg border border-[#DCDDE1] p-4 shadow-sm" id="model-summary-card">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4" id="model-header-row">
          <div>
            <span className="text-[10px] font-bold text-brand-purple dark:text-brand-lime uppercase tracking-wider font-mono">{category}</span>
            <h1 className="text-3xl font-serif italic text-[#2D3436] tracking-tight mt-0.5">{modelName}</h1>
            <p className="text-xs text-[#7F8C8D] mt-1">
              Analyse comparative et calcul empirique de la valeur médiane d'approvisionnement.
            </p>
          </div>

        </div>

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
              {renderSparkline(evaluation.historicalPrices, evaluation.medianPrice)}
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



      {/* Registre d'exécution & Diagnostic - Section Repliable & Barre de progression au niveau du Titre */}
      {(isScraping || scrapingLogs.length > 0) && (
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
      )}

      {/* Grid of Listings Validation */}
      {evaluation && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden" id="validation-panel">
          
          {/* Header Clair & Rassurant */}
          <div className="p-4 bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center space-x-2">
                <span>Annonces comparables & Filtrage</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Filtrez et vérifiez les offres du marché d'occasion pour ajuster la valeur marchande.
              </p>
            </div>
          </div>

          {/* Interface 100% Pills Select à Volets Repliables (Accordéons Indépendants) */}
          <div className="p-3.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 space-y-3">
            
            {/* Ligne 1 : Recherche mot-clé & Boutons d'accès aux 4 volets repliables */}
            <div className="flex flex-wrap items-center gap-2">
              
              {/* Recherche Mot-clé (À gauche) */}
              <div className="relative flex items-center min-w-[150px] max-w-[240px] flex-1">
                <input
                  type="text"
                  placeholder="🔍 Rechercher par mot-clé..."
                  value={specFilter}
                  onChange={(e) => setSpecFilter(e.target.value)}
                  className="w-full pl-3 pr-7 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-brand-purple font-medium shadow-inner"
                />
                {specFilter && (
                  <button onClick={() => setSpecFilter("")} className="absolute right-2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer">✕</button>
                )}
              </div>

              {/* Bouton Volet 1 : Sources (16 Connecteurs) */}
              <button
                type="button"
                onClick={() => setShowSourceSection(!showSourceSection)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition border cursor-pointer ${
                  filterSource !== "Toutes" || showSourceSection
                    ? "bg-brand-purple text-white border-brand-purple dark:bg-brand-lime dark:text-slate-950 dark:border-brand-lime shadow-sm"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-200"
                }`}
              >
                <span>🏪 Sources ({filterSource === "Toutes" ? "Toutes" : filterSource})</span>
                <span className="text-[10px]">{showSourceSection ? "▲" : "▼"}</span>
              </button>

              {/* Bouton Volet 2 : Écran & OS */}
              <button
                type="button"
                onClick={() => setShowScreenOsSection(!showScreenOsSection)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition border cursor-pointer ${
                  filterScreenSize !== "Toutes" || filterOs !== "Tous" || showScreenOsSection
                    ? "bg-sky-600 text-white border-sky-600 dark:bg-sky-500 dark:text-slate-950 shadow-sm"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-200"
                }`}
              >
                <span>🖥️ Écran & OS</span>
                {(filterScreenSize !== "Toutes" || filterOs !== "Tous") && (
                  <span className="w-2 h-2 rounded-full bg-white animate-ping"></span>
                )}
                <span className="text-[10px]">{showScreenOsSection ? "▲" : "▼"}</span>
              </button>

              {/* Bouton Volet 3 : Garantie & Format Vente */}
              <button
                type="button"
                onClick={() => setShowWarrantyLotSection(!showWarrantyLotSection)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition border cursor-pointer ${
                  filterWarranty !== "Toutes" || filterLot !== "Tous" || showWarrantyLotSection
                    ? "bg-emerald-600 text-white border-emerald-600 dark:bg-emerald-500 dark:text-slate-950 shadow-sm"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-200"
                }`}
              >
                <span>🛡️ Garantie & Vente</span>
                {(filterWarranty !== "Toutes" || filterLot !== "Tous") && (
                  <span className="w-2 h-2 rounded-full bg-white animate-ping"></span>
                )}
                <span className="text-[10px]">{showWarrantyLotSection ? "▲" : "▼"}</span>
              </button>

              {/* Bouton Volet 4 : Hardware (RAM, CPU, SSD, Année) */}
              <button
                type="button"
                onClick={() => setShowHardwareSection(!showHardwareSection)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition border cursor-pointer ${
                  filterRam !== "Toutes" || filterCpu !== "Tous" || filterStorage !== "Tous" || filterYear !== "Toutes" || showHardwareSection
                    ? "bg-purple-600 text-white border-purple-600 dark:bg-purple-500 dark:text-slate-950 shadow-sm"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-200"
                }`}
              >
                <span>⚙️ Specs (RAM, CPU, SSD)</span>
                {(filterRam !== "Toutes" || filterCpu !== "Tous" || filterStorage !== "Tous" || filterYear !== "Toutes") && (
                  <span className="w-2 h-2 rounded-full bg-white animate-ping"></span>
                )}
                <span className="text-[10px]">{showHardwareSection ? "▲" : "▼"}</span>
              </button>

            </div>

            {/* VOLET 1 : Sélection des 16 Sources (Repliable) */}
            {showSourceSection && (
              <div className="p-3 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">🏪 Filtrer par Source de Données (16 Connecteurs) :</span>
                  <button onClick={() => setShowSourceSection(false)} className="text-xs text-slate-400 hover:text-slate-600">Masquer ✕</button>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {availableSourcesList.map(srcName => (
                    <button
                      key={srcName}
                      type="button"
                      onClick={() => setFilterSource(srcName)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                        filterSource === srcName
                          ? "bg-brand-purple text-white shadow-sm dark:bg-brand-lime dark:text-slate-950"
                          : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {srcName}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* VOLET 2 : Écran & Système OS (Repliable) */}
            {showScreenOsSection && (
              <div className="p-3 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-700 grid grid-cols-1 md:grid-cols-2 gap-3 animate-fadeIn">
                
                {/* Écran Pills */}
                <div className="flex flex-col space-y-1.5">
                  <span className="text-xs font-bold text-sky-700 dark:text-sky-400">🖥️ Taille d'Écran :</span>
                  <div className="flex flex-wrap items-center gap-1">
                    {["Toutes", '11-12"', '13-13.3"', '14"', '15-15.6"', '16-17"+'].map(opt => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setFilterScreenSize(opt)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                          filterScreenSize === opt
                            ? "bg-sky-600 text-white shadow-sm"
                            : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 border border-slate-200 dark:border-slate-700"
                        }`}
                      >
                        {opt === "Toutes" ? "Toutes les tailles" : opt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* OS Pills */}
                <div className="flex flex-col space-y-1.5">
                  <span className="text-xs font-bold text-indigo-700 dark:text-indigo-400">🪟 Système d'Exploitation (OS) :</span>
                  <div className="flex flex-wrap items-center gap-1">
                    {["Tous", "Win 11 Pro", "Win 11 Home", "Win 10 Pro", "Win 10 Home", "macOS", "ChromeOS", "Sans OS / No OS"].map(opt => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setFilterOs(opt)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                          filterOs === opt
                            ? "bg-indigo-600 text-white shadow-sm"
                            : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 border border-slate-200 dark:border-slate-700"
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

              </div>
            )}

            {/* VOLET 3 : Garantie & Format Vente (Repliable) */}
            {showWarrantyLotSection && (
              <div className="p-3 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-700 grid grid-cols-1 md:grid-cols-2 gap-3 animate-fadeIn">
                
                {/* Garantie Pills */}
                <div className="flex flex-col space-y-1.5">
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">🛡️ Option Garantie :</span>
                  <div className="flex flex-wrap items-center gap-1">
                    {["Toutes", "Avec garantie", "Sans garantie mentionnée"].map(opt => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setFilterWarranty(opt)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                          filterWarranty === opt
                            ? "bg-emerald-600 text-white shadow-sm"
                            : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 border border-slate-200 dark:border-slate-700"
                        }`}
                      >
                        {opt === "Toutes" ? "Toutes les offres" : opt === "Avec garantie" ? "🛡️ Avec garantie incluse" : "Sans mention de garantie"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Vente Pills */}
                <div className="flex flex-col space-y-1.5">
                  <span className="text-xs font-bold text-teal-700 dark:text-teal-400">📦 Format de Vente :</span>
                  <div className="flex flex-wrap items-center gap-1">
                    {["Tous", "Unité", "Lot"].map(opt => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setFilterLot(opt)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                          filterLot === opt
                            ? "bg-teal-600 text-white shadow-sm"
                            : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 border border-slate-200 dark:border-slate-700"
                        }`}
                      >
                        {opt === "Tous" ? "Tous les formats" : opt === "Unité" ? "💻 Vente à l'unité" : "📦 Vente en lot"}
                      </button>
                    ))}
                  </div>
                </div>

              </div>
            )}

            {/* VOLET 4 : Hardware (RAM, CPU, SSD, Année) (Repliable) */}
            {showHardwareSection && (
              <div className="p-3 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-700 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 animate-fadeIn">
                
                {/* RAM Pills */}
                <div className="flex flex-col space-y-1.5">
                  <span className="text-xs font-bold text-purple-700 dark:text-purple-400">💾 Mémoire RAM :</span>
                  <div className="flex flex-wrap items-center gap-1">
                    {["Toutes", "8 Go", "16 Go", "32 Go+"].map(opt => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setFilterRam(opt)}
                        className={`px-2 py-0.5 rounded text-xs font-bold transition cursor-pointer ${
                          filterRam === opt
                            ? "bg-purple-600 text-white shadow-sm"
                            : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 border border-slate-200 dark:border-slate-700"
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* CPU Pills */}
                <div className="flex flex-col space-y-1.5">
                  <span className="text-xs font-bold text-blue-700 dark:text-blue-400">⚡ Processeur CPU :</span>
                  <div className="flex flex-wrap items-center gap-1">
                    {["Tous", "Core i5", "Core i7", "Core i9", "Ryzen", "Apple M"].map(opt => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setFilterCpu(opt)}
                        className={`px-2 py-0.5 rounded text-xs font-bold transition cursor-pointer ${
                          filterCpu === opt
                            ? "bg-blue-600 text-white shadow-sm"
                            : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 border border-slate-200 dark:border-slate-700"
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* SSD Pills */}
                <div className="flex flex-col space-y-1.5">
                  <span className="text-xs font-bold text-amber-700 dark:text-amber-400">💽 Stockage SSD :</span>
                  <div className="flex flex-wrap items-center gap-1">
                    {["Tous", "256 Go", "512 Go", "1 To+"].map(opt => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setFilterStorage(opt)}
                        className={`px-2 py-0.5 rounded text-xs font-bold transition cursor-pointer ${
                          filterStorage === opt
                            ? "bg-amber-600 text-white shadow-sm"
                            : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 border border-slate-200 dark:border-slate-700"
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Année Pills */}
                <div className="flex flex-col space-y-1.5">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">📅 Année :</span>
                  <div className="flex flex-wrap items-center gap-1">
                    {["Toutes", "2023+", "2021-2022", "2020 ou -"].map(opt => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setFilterYear(opt)}
                        className={`px-2 py-0.5 rounded text-xs font-bold transition cursor-pointer ${
                          filterYear === opt
                            ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 shadow-sm"
                            : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 border border-slate-200 dark:border-slate-700"
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

              </div>
            )}

            {/* Ligne des Filtres Actifs (Active Filter Chips) */}
            {activeFiltersCount > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800 animate-fadeIn">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mr-1">Filtres actifs :</span>

                {filterSource !== "Toutes" && (
                  <span className="inline-flex items-center space-x-1 bg-brand-purple/10 text-brand-purple dark:bg-brand-lime/20 dark:text-brand-lime px-2 py-0.5 rounded-md text-xs font-semibold border border-brand-purple/20 dark:border-brand-lime/30">
                    <span>🏪 {filterSource}</span>
                    <button onClick={() => setFilterSource("Toutes")} className="hover:text-rose-500 font-bold ml-1 font-mono">✕</button>
                  </span>
                )}

                {filterScreenSize !== "Toutes" && (
                  <span className="inline-flex items-center space-x-1 bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 px-2 py-0.5 rounded-md text-xs font-semibold border border-sky-200 dark:border-sky-800">
                    <span>🖥️ Écran : {filterScreenSize}</span>
                    <button onClick={() => setFilterScreenSize("Toutes")} className="hover:text-rose-500 font-bold ml-1 font-mono">✕</button>
                  </span>
                )}

                {filterOs !== "Tous" && (
                  <span className="inline-flex items-center space-x-1 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 px-2 py-0.5 rounded-md text-xs font-semibold border border-indigo-200 dark:border-indigo-800">
                    <span>🪟 OS : {filterOs}</span>
                    <button onClick={() => setFilterOs("Tous")} className="hover:text-rose-500 font-bold ml-1 font-mono">✕</button>
                  </span>
                )}

                {filterWarranty !== "Toutes" && (
                  <span className="inline-flex items-center space-x-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 px-2 py-0.5 rounded-md text-xs font-semibold border border-emerald-200 dark:border-emerald-800">
                    <span>🛡️ {filterWarranty}</span>
                    <button onClick={() => setFilterWarranty("Toutes")} className="hover:text-rose-500 font-bold ml-1 font-mono">✕</button>
                  </span>
                )}

                {filterLot !== "Tous" && (
                  <span className="inline-flex items-center space-x-1 bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300 px-2 py-0.5 rounded-md text-xs font-semibold border border-teal-200 dark:border-teal-800">
                    <span>📦 Vente : {filterLot}</span>
                    <button onClick={() => setFilterLot("Tous")} className="hover:text-rose-500 font-bold ml-1 font-mono">✕</button>
                  </span>
                )}

                {filterRam !== "Toutes" && (
                  <span className="inline-flex items-center space-x-1 bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 px-2 py-0.5 rounded-md text-xs font-semibold border border-purple-200 dark:border-purple-800">
                    <span>💾 RAM : {filterRam}</span>
                    <button onClick={() => setFilterRam("Toutes")} className="hover:text-rose-500 font-bold ml-1 font-mono">✕</button>
                  </span>
                )}

                {filterCpu !== "Tous" && (
                  <span className="inline-flex items-center space-x-1 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 px-2 py-0.5 rounded-md text-xs font-semibold border border-blue-200 dark:border-blue-800">
                    <span>⚡ CPU : {filterCpu}</span>
                    <button onClick={() => setFilterCpu("Tous")} className="hover:text-rose-500 font-bold ml-1 font-mono">✕</button>
                  </span>
                )}

                {filterStorage !== "Tous" && (
                  <span className="inline-flex items-center space-x-1 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 px-2 py-0.5 rounded-md text-xs font-semibold border border-amber-200 dark:border-amber-800">
                    <span>💽 SSD : {filterStorage}</span>
                    <button onClick={() => setFilterStorage("Tous")} className="hover:text-rose-500 font-bold ml-1 font-mono">✕</button>
                  </span>
                )}

                {filterYear !== "Toutes" && (
                  <span className="inline-flex items-center space-x-1 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 px-2 py-0.5 rounded-md text-xs font-semibold border border-slate-200 dark:border-slate-700">
                    <span>📅 Année : {filterYear}</span>
                    <button onClick={() => setFilterYear("Toutes")} className="hover:text-rose-500 font-bold ml-1 font-mono">✕</button>
                  </span>
                )}

                {specFilter && (
                  <span className="inline-flex items-center space-x-1 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 px-2 py-0.5 rounded-md text-xs font-semibold border border-slate-200 dark:border-slate-700">
                    <span>🔍 "{specFilter}"</span>
                    <button onClick={() => setSpecFilter("")} className="hover:text-rose-500 font-bold ml-1 font-mono">✕</button>
                  </span>
                )}

                <button
                  onClick={() => {
                    setFilterRam("Toutes");
                    setFilterCpu("Tous");
                    setFilterStorage("Tous");
                    setFilterYear("Toutes");
                    setFilterSource("Toutes");
                    setFilterScreenSize("Toutes");
                    setFilterOs("Tous");
                    setFilterWarranty("Toutes");
                    setFilterLot("Tous");
                    setSpecFilter("");
                    setSortBy('default');
                    setSortOrder('desc');
                  }}
                  className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline ml-2 cursor-pointer"
                >
                  Tout effacer
                </button>

                <div className="ml-auto text-xs text-slate-500 dark:text-slate-400 font-mono font-medium">
                  <strong>{sortedListings.length}</strong> / {evaluation?.listings.length || 0} comparables trouvés
                </div>
              </div>
            )}
          </div>

          {/* Listings Table */}
          <div className="overflow-x-auto" id="listings-table-container">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 text-xs font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                  <th className="py-2.5 px-3 w-12 text-center border-r border-slate-200 dark:border-slate-700">SEL</th>
                  
                  {/* Colonne SOURCE cliquable pour le tri */}
                  <th 
                    onClick={() => handleSortHeader('source')}
                    className="py-2.5 px-3 w-36 border-r border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-700/60 select-none transition"
                    title="Cliquer pour trier par source (A-Z / Z-A)"
                  >
                    <div className="flex items-center justify-between">
                      <span>SOURCE</span>
                      <span className="text-[10px] text-slate-400">{sortBy === 'source' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}</span>
                    </div>
                  </th>

                  <th className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-700">DESCRIPTION DE L'ANNONCE</th>
                  
                  {/* Colonne DATE cliquable pour le tri */}
                  <th 
                    onClick={() => handleSortHeader('date')}
                    className="py-2.5 px-3 w-28 text-right border-r border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-700/60 select-none transition"
                    title="Cliquer pour trier par date (Récente / Ancienne)"
                  >
                    <div className="flex items-center justify-end space-x-1">
                      <span>DATE</span>
                      <span className="text-[10px] text-slate-400">{sortBy === 'date' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}</span>
                    </div>
                  </th>

                  {/* Colonne PRIX cliquable pour le tri */}
                  <th 
                    onClick={() => handleSortHeader('price')}
                    className="py-2.5 px-3 w-32 text-right text-brand-purple dark:text-brand-lime border-r border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-700/60 select-none transition"
                    title="Cliquer pour trier par prix (Plus bas / Plus élevé)"
                  >
                    <div className="flex items-center justify-end space-x-1">
                      <span>PRIX (CAD)</span>
                      <span className="text-[10px] text-slate-400">{sortBy === 'price' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}</span>
                    </div>
                  </th>

                  <th className="py-2.5 px-3 w-12 text-center">LIEN</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F2F6]">
                {sortedListings.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 text-xs italic">
                      Aucun comparable trouvé pour ces critères. {specFilter ? "Veuillez modifier ou effacer votre filtre." : "Veuillez réinitialiser vos filtres ou cliquer sur \"Collecte Multi-Sources\"."}
                    </td>
                  </tr>
                ) : (
                  sortedListings.map((listing, index) => {
                    const isOutlier = listing.isOutlier;
                    const isEditing = editingPriceId === listing.id;

                    return (
                      <tr 
                        key={listing.id} 
                        className={`hover:bg-[#F1F2F6]/60 dark:hover:bg-slate-800/50 transition-colors ${
                          !listing.included 
                            ? (isOutlier ? "bg-rose-50/30 dark:bg-rose-950/20 text-slate-450 dark:text-slate-400" : "bg-slate-100/40 dark:bg-slate-800/30 text-slate-450 dark:text-slate-400 line-through")
                            : (index % 2 === 0 ? "bg-white dark:bg-slate-900/10" : "bg-[#F8F9FA] dark:bg-slate-800/5")
                        }`}
                        id={`row-listing-${listing.id}`}
                      >
                        {/* Checkbox */}
                        <td className="py-2 px-3 text-center border-r border-[#F1F2F6] dark:border-slate-800">
                          <input
                            type="checkbox"
                            checked={listing.included}
                            onChange={() => handleToggleInclude(listing)}
                            className="w-3.5 h-3.5 text-brand-purple dark:text-brand-lime border-slate-300 dark:border-slate-700 rounded focus:ring-amber-500 cursor-pointer"
                            id={`checkbox-include-${listing.id}`}
                          />
                        </td>

                      {/* Source */}
                      <td className="py-2 px-3 font-bold border-r border-[#F1F2F6] relative">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold font-mono tracking-wide ${
                          String(listing.source).includes("eBay") ? "bg-blue-50 text-blue-800 border border-blue-100" :
                          String(listing.source).includes("Back Market") ? "bg-purple-50 text-purple-800 border border-purple-100" :
                          String(listing.source).includes("GCSurplus") ? "bg-emerald-50 text-emerald-800 border border-emerald-100" :
                          String(listing.source).includes("Insertech") ? "bg-amber-50 text-amber-800 border border-amber-100" :
                          String(listing.source).includes("Amazon") ? "bg-orange-50 text-orange-800 border border-orange-100" :
                          String(listing.source).includes("BestBuy") ? "bg-blue-50 text-blue-800 border border-blue-100" :
                          String(listing.source).includes("Newegg") ? "bg-red-50 text-red-800 border border-red-100" :
                          String(listing.source).includes("Kijiji") ? "bg-indigo-50 text-indigo-800 border border-indigo-100" :
                          String(listing.source).includes("Facebook") ? "bg-cyan-50 text-cyan-800 border border-cyan-100" :
                          String(listing.source).includes("Dell") ? "bg-blue-50 text-blue-800 border border-blue-100" :
                          String(listing.source).includes("Lenovo") ? "bg-red-50 text-red-800 border border-red-100" :
                          String(listing.source).includes("HP") ? "bg-sky-50 text-sky-800 border border-sky-100" :
                          "bg-slate-50 text-slate-800 border border-slate-200"
                        }`}>
                          {listing.source}
                        </span>
                        {isOutlier && (
                          <span 
                            className="relative group inline-block ml-1.5 text-[8px] bg-rose-50 text-rose-600 border border-rose-200 px-1 py-0.5 rounded font-mono font-bold uppercase tracking-wider cursor-help"
                            id={`badge-anomalie-${listing.id}`}
                          >
                            Anomalie ⚠️
                            <span className="pointer-events-none absolute bottom-full left-0 mb-1.5 hidden group-hover:block w-64 bg-slate-950 dark:bg-slate-900 text-white dark:text-slate-100 text-[10px] font-sans font-medium normal-case tracking-normal p-2.5 rounded shadow-xl border border-slate-800 z-50 text-left leading-normal">
                              {getAnomalyReason(listing, evaluation?.medianPrice || 0)}
                            </span>
                          </span>
                        )}
                      </td>

                      {/* Title & Granular Specs Badges */}
                      <td className="py-2 px-3 max-w-xs md:max-w-md border-r border-[#F1F2F6] dark:border-slate-800">
                        <div className={`truncate font-medium ${listing.included ? "text-[#1A1A1B] dark:text-slate-200" : "text-slate-450 dark:text-slate-500"}`} title={listing.title}>
                          {listing.title}
                        </div>
                        
                        {/* Badges d'étiquettes cliquables */}
                        <div className="flex flex-wrap gap-1 mt-1 text-[9px] font-mono">
                          {listing.specs?.year && (
                            <button
                              type="button"
                              onClick={() => {
                                const y = parseInt(listing.specs?.year || "0");
                                if (y >= 2023) setFilterYear("2023+");
                                else if (y === 2021 || y === 2022) setFilterYear("2021-2022");
                                else if (y <= 2020 && y > 0) setFilterYear("2020 ou -");
                              }}
                              title="Cliquer pour filtrer par cette période"
                              className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                            >
                              📅 {listing.specs.year}
                            </button>
                          )}
                          {listing.specs?.cpu && (
                            <button
                              type="button"
                              onClick={() => {
                                const c = listing.specs?.cpu?.toLowerCase() || "";
                                if (c.includes("i5")) setFilterCpu("Core i5");
                                else if (c.includes("i7")) setFilterCpu("Core i7");
                                else if (c.includes("i9")) setFilterCpu("Core i9");
                                else if (c.includes("ryzen")) setFilterCpu("Ryzen");
                                else if (c.includes("m1") || c.includes("m2") || c.includes("m3")) setFilterCpu("Apple M");
                              }}
                              title="Cliquer pour filtrer par ce processeur"
                              className="bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900 transition-colors cursor-pointer"
                            >
                              ⚡ {listing.specs.cpu}
                            </button>
                          )}
                          {listing.specs?.ram && (
                            <button
                              type="button"
                              onClick={() => {
                                const r = listing.specs?.ram || "";
                                if (r.includes("8")) setFilterRam("8 Go");
                                else if (r.includes("16")) setFilterRam("16 Go");
                                else if (r.includes("32") || r.includes("64")) setFilterRam("32 Go+");
                              }}
                              title="Cliquer pour filtrer par cette mémoire RAM"
                              className="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-colors cursor-pointer"
                            >
                              💾 {listing.specs.ram}
                            </button>
                          )}
                          {listing.specs?.storage && (
                            <button
                              type="button"
                              onClick={() => {
                                const s = listing.specs?.storage?.toLowerCase() || "";
                                if (s.includes("256")) setFilterStorage("256 Go");
                                else if (s.includes("512")) setFilterStorage("512 Go");
                                else if (s.includes("1 to") || s.includes("1tb") || s.includes("2 to") || s.includes("2tb")) setFilterStorage("1 To+");
                              }}
                              title="Cliquer pour filtrer par ce stockage SSD"
                              className="bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900 transition-colors cursor-pointer"
                            >
                              💽 {listing.specs.storage}
                            </button>
                          )}

                          {/* Badge Écran */}
                          {getScreenSize(listing) && (
                            <button
                              type="button"
                              onClick={() => {
                                const sz = getScreenSize(listing);
                                if (sz === '14"') setFilterScreenSize('14"');
                                else if (sz === '15.6"' || sz === '15"') setFilterScreenSize('15-15.6"');
                                else if (sz === '13.3"' || sz === '13"') setFilterScreenSize('13-13.3"');
                                else if (sz === '11.6"' || sz === '12.5"') setFilterScreenSize('11-12"');
                                else setFilterScreenSize('16-17"+');
                              }}
                              title="Cliquer pour filtrer par cette taille d'écran"
                              className="bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 px-1.5 py-0.5 rounded border border-sky-200 dark:border-sky-800 hover:bg-sky-100 dark:hover:bg-sky-900 transition-colors cursor-pointer"
                            >
                              🖥️ {getScreenSize(listing)}
                            </button>
                          )}

                          {/* Badge OS */}
                          {getOs(listing) && (
                            <button
                              type="button"
                              onClick={() => {
                                const osVal = getOs(listing);
                                if (osVal === "Windows 11 Pro") setFilterOs("Win 11 Pro");
                                else if (osVal === "Windows 11 Familial") setFilterOs("Win 11 Home");
                                else if (osVal === "Windows 10 Pro") setFilterOs("Win 10 Pro");
                                else if (osVal === "Windows 10 Familial") setFilterOs("Win 10 Home");
                                else if (osVal === "macOS") setFilterOs("macOS");
                                else if (osVal === "ChromeOS") setFilterOs("ChromeOS");
                                else if (osVal === "No OS") setFilterOs("Sans OS / No OS");
                              }}
                              title="Cliquer pour filtrer par ce système d'exploitation"
                              className="bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded border border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900 transition-colors cursor-pointer"
                            >
                              🪟 {getOs(listing)}
                            </button>
                          )}

                          {/* Badge Garantie */}
                          {hasWarranty(listing) && (
                            <button
                              type="button"
                              onClick={() => setFilterWarranty("Avec garantie")}
                              title="Cliquer pour filtrer les annonces avec garantie"
                              className="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-colors cursor-pointer"
                            >
                              🛡️ Garantie
                            </button>
                          )}

                          {/* Badge Lot vs Unité */}
                          {isLotItem(listing) ? (
                            <button
                              type="button"
                              onClick={() => setFilterLot("Lot")}
                              title="Cliquer pour filtrer les offres en lot"
                              className="bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 px-1.5 py-0.5 rounded border border-teal-200 dark:border-teal-800 hover:bg-teal-100 dark:hover:bg-teal-900 transition-colors cursor-pointer"
                            >
                              📦 Lot
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setFilterLot("Unité")}
                              title="Cliquer pour filtrer les offres à l'unité"
                              className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                            >
                              👤 Unité
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Date */}
                      <td className="py-2 px-3 text-right font-mono text-[10px] text-[#7F8C8D] border-r border-[#F1F2F6]">
                        {listing.date}
                      </td>

                      {/* Price (Editable on Double-Click or Click) */}
                      <td className="py-2 px-3 text-right border-r border-[#F1F2F6]">
                        {isEditing ? (
                          <div className="flex items-center justify-end space-x-1">
                            <input
                              type="text"
                              className="w-16 px-1.5 py-0.5 text-right font-mono text-[11px] border border-brand-purple dark:border-brand-lime rounded outline-none"
                              value={tempPrice}
                              onChange={(e) => setTempPrice(e.target.value)}
                              onBlur={() => handlePriceEditSave(listing.id)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handlePriceEditSave(listing.id);
                              }}
                              autoFocus
                              id={`input-price-edit-${listing.id}`}
                            />
                            <span className="text-[10px] font-mono text-slate-500">CAD</span>
                          </div>
                        ) : (
                          <div
                            onDoubleClick={() => handlePriceEditStart(listing)}
                            className="flex flex-col items-end space-y-0.5 cursor-pointer hover:bg-slate-200/80 dark:hover:bg-slate-800 px-2 py-0.5 rounded"
                            id={`price-display-${listing.id}`}
                          >
                            {/* Prix avant rabais (barré) */}
                            {listing.originalPrice && listing.originalPrice > listing.price && (
                              <span className="font-mono text-[9px] text-slate-400 dark:text-slate-500 line-through leading-none">
                                {listing.originalPrice.toFixed(2)}$
                              </span>
                            )}

                            {/* Prix final + badge rabais */}
                            <div className="flex items-center justify-end space-x-1">
                              {listing.discountPercent && listing.discountPercent >= 1 && (
                                <span className="text-[8px] font-bold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 px-1 py-px rounded font-mono leading-none">
                                  -{listing.discountPercent.toFixed(0)}%
                                </span>
                              )}
                              <span
                                className={`font-mono font-bold text-xs ${
                                  listing.included ? "text-[#1A1A1B] dark:text-slate-200" : "text-slate-450 dark:text-slate-500"
                                }`}
                                title={[
                                  listing.currency && listing.exchangeRate
                                    ? `Converti depuis ${listing.currency} · 1 ${listing.currency} = ${listing.exchangeRate.toFixed(4)} CAD`
                                    : null,
                                  listing.originalPrice && listing.originalPrice > listing.price
                                    ? `Prix avant rabais : ${listing.originalPrice.toFixed(2)} $ → Rabais : ${listing.discountAmount?.toFixed(2) ?? "?"} $ (-${listing.discountPercent?.toFixed(1) ?? "?"}%)`
                                    : null,
                                  !listing.currency && !listing.originalPrice
                                    ? "Double-cliquez pour corriger le prix"
                                    : null,
                                ].filter(Boolean).join("\n") || "Double-cliquez pour corriger le prix"}
                              >
                                {listing.price.toFixed(2)}$
                              </span>
                            </div>
                          </div>
                        )}
                      </td>


                      {/* External Link */}
                      <td className="py-2 px-3 text-center">
                        <a
                          href={listing.url}
                          target="_blank"
                          rel="noopener"
                          className="inline-flex p-1 hover:bg-[#F1F2F6] rounded text-[#7F8C8D] hover:text-[#1A1A1B] transition"
                          title="Ouvrir la fiche d'origine (Preuve comptable)"
                          id={`link-proof-${listing.id}`}
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </td>
                    </tr>
                  );
                }))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Dynamic Retro Summary Footer */}
      {evaluation && (
        <div className="bg-brand-purple dark:bg-slate-800 border-none rounded-lg p-4 px-6 flex flex-col sm:flex-row items-center justify-between text-white shadow-md animate-fadeIn" id="model-summary-footer">
          <div className="flex flex-wrap gap-8 items-center">
            <div>
              <div className="text-[9px] uppercase font-bold text-[#95A5A6] mb-0.5 tracking-wider font-mono">Médiane Calculée</div>
              <div className="text-3xl font-mono text-[#2ECC71] font-bold tracking-tighter">
                {evaluation.medianPrice > 0 ? `${evaluation.medianPrice.toFixed(2)}$` : "Non évalué"} {evaluation.medianPrice > 0 && <span className="text-xs text-white font-normal ml-0.5 uppercase">CAD</span>}
              </div>
            </div>
            <div className="hidden sm:block h-10 w-px bg-white/10"></div>
            <div>
              <div className="text-[9px] uppercase font-bold text-[#95A5A6] mb-0.5 tracking-wider font-mono">Écart-Type (Filtres Actifs)</div>
              <div className="text-lg font-mono text-[#F1C40F] font-bold">
                ± {standardDeviation.toFixed(2)}$
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
