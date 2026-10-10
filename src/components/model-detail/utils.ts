import { ComparableListing } from "../../types";
import { ListingFilters, SortColumn, SortOrder, SourceProgressItem } from "./types";

export const SOURCES_LIST = [
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

export const cleanLogSource = (log: string): string => {
  return log.replace(/\[(?:[a-z0-9-]+)\]\s*/gi, "");
};

export const getAnomalyReason = (listing: ComparableListing, medianPrice: number): string => {
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

export const getScreenSize = (l: ComparableListing): string => {
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

export const getOs = (l: ComparableListing): string => {
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

export const hasWarranty = (l: ComparableListing): boolean => {
  if (l.specs?.warranty) return true;
  const src = String(l.source).toLowerCase();
  if (src.includes("back market") || src.includes("amazon") || src.includes("reebelo") || src.includes("best buy") || src.includes("dell refurb") || src.includes("refurb.io") || src.includes("it refurbs") || src.includes("canada comp")) return true;
  const t = l.title.toLowerCase();
  return /\b(?:garantie|warranty|renewed|under\s+warranty|sous\s+garantie|90[- ]day|1[- ]year)\b/i.test(t);
};

export const isLotItem = (l: ComparableListing): boolean => {
  if (l.specs?.isLot !== undefined) return l.specs.isLot;
  if (l.specs?.unitOrLot === 'lot' || l.saleType === 'wholesale') return true;
  const t = l.title.toLowerCase();
  return /\b(?:lot\s+de|lot\s+of|pack\s+de|bundle\s+of|\bqty\b|\blots\b|\bbulk\b|\blot\b|\bx[2-9]\b|\bx10\b|ensemble\s+de)\b/i.test(t);
};

export const getConfidenceBadgeColor = (confidence: string): string => {
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

export const getStatusColorClass = (status: string): string => {
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

export const getStatusLabel = (item: SourceProgressItem): string => {
  if (item.status === "idle") return "En attente";
  if (item.status === "running") return "Collecte...";
  if (item.status === "failed") return "Aucun résultat";
  if (item.status === "success") {
    if (item.key === "general") return "Prêt";
    return `${item.listingCount} comparable(s)`;
  }
  return "En attente";
};

export const parseSourcesProgress = (
  scrapingLogs: string[],
  isScraping: boolean,
  scrapeProgress: number
): SourceProgressItem[] => {
  const list: SourceProgressItem[] = [
    {
      key: "general",
      name: "Orchestrateur",
      icon: "⚙️",
      logs: [],
      status: isScraping ? "running" : "success",
      progress: isScraping ? scrapeProgress : 100,
      listingCount: 0
    },
    ...SOURCES_LIST.map(s => ({
      ...s,
      logs: [] as string[],
      status: "idle" as const,
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
};

export const calculateStandardDeviation = (listings?: ComparableListing[]): number => {
  const activePrices = listings?.filter(l => l.included).map(l => l.price) || [];
  if (activePrices.length > 1) {
    const mean = activePrices.reduce((a, b) => a + b, 0) / activePrices.length;
    const variance = activePrices.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / activePrices.length;
    return Math.sqrt(variance);
  } else if (activePrices.length === 1) {
    return activePrices[0] * 0.05; // 5% fallback
  }
  return 0;
};

export const filterAndSortListings = (
  listings: ComparableListing[] | undefined,
  filters: ListingFilters,
  sortBy: SortColumn,
  sortOrder: SortOrder
): ComparableListing[] => {
  if (!listings) return [];

  const {
    ram: filterRam,
    cpu: filterCpu,
    storage: filterStorage,
    year: filterYear,
    source: filterSource,
    screenSize: filterScreenSize,
    os: filterOs,
    warranty: filterWarranty,
    lot: filterLot,
    specFilter
  } = filters;

  return [...listings].filter(l => {
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
  });
};
