import { REFERENCE_MODELS, ReferenceModelItem } from "../constants/referenceModels";
import { normalizeCategory } from "../modelsData";

export interface ParsedModelResult {
  raw: string;
  cleanModelName: string;
  brand: string;
  category: string;
  formFactor: "portable" | "desktop" | "phone" | "unknown";
  specs: {
    cpu?: string;
    ram?: string;
    storage?: string;
    fullConfiguration: string;
  };
  matchedReference?: ReferenceModelItem;
}

// Codes châssis constructeurs connus (notamment Dell XPS, Lenovo MT-M)
const KNOWN_CHASSIS_MAP: Record<string, { modelName: string; category: string }> = {
  "p129f001": { modelName: "Dell XPS 15 9500", category: "Portables Dell XPS" },
  "p129f": { modelName: "Dell XPS 15 9500", category: "Portables Dell XPS" },
  "p117g": { modelName: "Dell XPS 13 9300", category: "Portables Dell XPS" },
  "p117g001": { modelName: "Dell XPS 13 9300", category: "Portables Dell XPS" },
  "p92f": { modelName: "Dell XPS 17 9700", category: "Portables Dell XPS" },
  "p92f001": { modelName: "Dell XPS 17 9720", category: "Portables Dell XPS" }
};

/**
 * Déduit automatiquement la catégorie officielle à partir du nom d'un modèle
 */
export function inferCategoryFromModel(modelName: string): string {
  if (!modelName || !modelName.trim()) return "Portables Lenovo";
  const trimmed = modelName.trim();
  const lower = trimmed.toLowerCase();

  // 1. Vérification dans les codes châssis connus
  if (KNOWN_CHASSIS_MAP[lower]) {
    return KNOWN_CHASSIS_MAP[lower].category;
  }

  // 2. Recherche directe dans le dictionnaire de référence
  const exactRef = REFERENCE_MODELS.find(
    ref => ref.name.toLowerCase() === lower || ref.aliases?.some(a => a.toLowerCase() === lower)
  );
  if (exactRef) {
    return exactRef.category;
  }

  // 3. iPhones & Téléphones
  if (lower.includes("iphone") || lower.includes("téléphone") || lower.includes("smartphone")) {
    return "iPhones";
  }

  // 4. Apple Mac (MacBook, Mac mini, iMac, Mac Studio)
  if (lower.includes("macbook") || lower.includes("apple") || lower.includes("mac mini") || lower.includes("imac")) {
    return "Apple";
  }

  // 5. Dell XPS
  if (lower.includes("xps")) {
    return "Portables Dell XPS";
  }

  // 6. Dell Desktops (OptiPlex, Precision Tower/SFF/Micro)
  if (
    lower.includes("optiplex") ||
    (lower.includes("dell") && (lower.includes("desktop") || lower.includes("tour") || lower.includes("micro") || lower.includes("sff")))
  ) {
    return "Desktop Dell";
  }

  // 7. Dell Portables (Latitude, Precision Mobile, Inspiron, Vostro)
  if (lower.includes("latitude") || (lower.includes("dell") && (lower.includes("precision") || lower.includes("portable")))) {
    return "Portables Dell";
  }
  // Détection du numéro seul à 4 chiffres classique Latitude (ex: 5420, 7490, 5400)
  if (/\b(?:latitude\s*)?[357][345][0-9]{2}\b/.test(lower) && !lower.includes("optiplex") && !lower.includes("think")) {
    return "Portables Dell";
  }

  // 8. HP Desktops (EliteDesk, ProDesk, Z2)
  if (
    lower.includes("elitedesk") ||
    lower.includes("prodesk") ||
    (lower.includes("hp") && (lower.includes("desktop") || lower.includes("tour") || lower.includes("mini") || lower.includes("sff")))
  ) {
    return "Desktop HP";
  }

  // 9. HP Portables (EliteBook, ProBook, ZBook, Firefly)
  if (
    lower.includes("elitebook") ||
    lower.includes("probook") ||
    lower.includes("zbook") ||
    lower.includes("firefly") ||
    (lower.includes("hp") && (lower.includes("portable") || lower.includes("laptop")))
  ) {
    return "Portables HP";
  }
  // Détection EliteBook par code (ex: 840 G6, 850 G7, 830 G8)
  if (/\b8[345]0\s*g[0-9]{1,2}\b/.test(lower)) {
    return "Portables HP";
  }

  // 10. Lenovo Desktops (ThinkCentre, Tiny)
  if (
    lower.includes("thinkcentre") ||
    lower.includes("tiny") ||
    (lower.includes("lenovo") && (lower.includes("desktop") || lower.includes("tour") || lower.includes("bureau"))) ||
    /\bm[789][0-9]{1,2}[qs]?\b/.test(lower)
  ) {
    return "Desktop Lenovo";
  }

  // 11. Lenovo Portables (ThinkPad T, X, L, E, P, Carbon, Yoga)
  if (
    lower.includes("thinkpad") ||
    lower.includes("carbon") ||
    lower.includes("yoga") ||
    /\bt[14][0-9]\b/.test(lower) ||
    /\bx[123][0-9]{1,2}\b/.test(lower) ||
    /\bl[14][0-9]\b/.test(lower) ||
    /\bp[145][0-9]\b/.test(lower)
  ) {
    return "Portables Lenovo";
  }

  // 12. Fallback via normalizeCategory existant
  return normalizeCategory(modelName);
}

/**
 * Smart Parser : Analyse une ligne complète et extrait le modèle, la marque, la catégorie et les composants
 */
export function parseModelRawString(rawInput: string): ParsedModelResult {
  const raw = (rawInput || "").trim();
  if (!raw) {
    return {
      raw: "",
      cleanModelName: "",
      brand: "Générique",
      category: "Portables Lenovo",
      formFactor: "portable",
      specs: { fullConfiguration: "" }
    };
  }

  let working = raw;

  // 1. Extraction de la RAM
  let ram: string | undefined;
  const ramMatch = working.match(/\b(4|8|12|16|24|32|48|64|128)\s*(?:go|gb|g)\s*(?:ram|ddr[345]|memoire)?\b/i);
  if (ramMatch) {
    ram = `${ramMatch[1]} Go RAM`;
    working = working.replace(ramMatch[0], " ");
  }

  // 2. Extraction du Stockage (SSD, HDD, NVMe)
  let storage: string | undefined;
  const storageTbMatch = working.match(/\b([124])\s*(?:(?:to|tb|t)\s*(?:ssd|nvme|hdd|disque)?|tb|to)\b/i);
  const storageGbMatch = working.match(/\b(128|256|512)\s*(?:(?:go|gb|g)\s*(?:ssd|nvme|hdd|disque)?|ssd|nvme|hdd|go|gb)\b/i);
  if (storageTbMatch) {
    storage = `${storageTbMatch[1]} To SSD`;
    working = working.replace(storageTbMatch[0], " ");
  } else if (storageGbMatch) {
    storage = `${storageGbMatch[1]} Go SSD`;
    working = working.replace(storageGbMatch[0], " ");
  }

  // 3. Extraction du Processeur (CPU)
  let cpu: string | undefined;
  const intelCoreMatch = working.match(/\b(?:core\s*)?(i[3579])[- ]?([0-9]{4,5}[a-z0-9]*)?\b/i);
  const amdRyzenMatch = working.match(/\bryzen\s*([3579])\s*(?:pro)?(?:[- ]?[0-9]{4}[a-z]*)?\b/i);
  const appleSiliconMatch = working.match(/\b(m[1234](?:\s*pro|\s*max|\s*ultra)?)\b/i);

  if (intelCoreMatch) {
    cpu = `Core ${intelCoreMatch[1].toLowerCase()}`;
    working = working.replace(intelCoreMatch[0], " ");
  } else if (amdRyzenMatch) {
    cpu = `Ryzen ${amdRyzenMatch[1]} Pro`;
    working = working.replace(amdRyzenMatch[0], " ");
  } else if (appleSiliconMatch) {
    cpu = `Apple ${appleSiliconMatch[1].toUpperCase()}`;
    working = working.replace(appleSiliconMatch[0], " ");
  }

  // 4. Nettoyage des mots parasites fréquents d'inventaire
  const noisePatterns = [
    /\b(?:windows|win\s*10|win\s*11|macos|chromeos|android|ios)\s*(?:pro|home|ent)?\b/gi,
    /\b(?:tactile|touch|non-touch|touchscreen|fhd|uhd|4k|ips|oled|wuxga)\b/gi,
    /\b(?:grade\s*[abc]\+?|reconditionne|refurbished|usagé|occasion|tres\s*bon\s*etat|bon\s*etat)\b/gi,
    /\b(?:noir|black|argent|silver|gris|space\s*gray|sideral|blanc|white|bleu|blue|gold|or)\b/gi,
    /\b(?:azerty|qwerty|clavier\s*francais|bilingue|retro\s*eclaire|backlit)\b/gi,
    /\b(?:garantie|warranty|avec\s*chargeur|sans\s*chargeur|batterie\s*neuve)\b/gi,
    /\b(?:14\s*pouces|15\.6\s*pouces|13\.3\s*pouces|16\s*pouces|14"|15\.6"|13\.3"|16")\b/gi
  ];
  for (const pattern of noisePatterns) {
    working = working.replace(pattern, " ");
  }

  // 5. Nettoyer les espaces résiduels
  working = working.replace(/\s+/g, " ").trim();

  // 6. Vérifier si un code châssis correspond
  let cleanModelName = working;
  let category = inferCategoryFromModel(raw);

  const lowerRaw = raw.toLowerCase();
  for (const [code, info] of Object.entries(KNOWN_CHASSIS_MAP)) {
    if (lowerRaw.includes(code)) {
      cleanModelName = info.modelName;
      category = info.category;
      break;
    }
  }

  // 7. Recherche de correspondance dans le dictionnaire de référence (les plus spécifiques d'abord)
  const sortedRefs = [...REFERENCE_MODELS].sort((a, b) => b.name.length - a.name.length);
  const matchedRef = sortedRefs.find(ref => {
    const refLower = ref.name.toLowerCase();
    if (working.toLowerCase() === refLower) return true;
    if (raw.toLowerCase().includes(refLower)) return true;
    return ref.aliases?.some(a => raw.toLowerCase().includes(a.toLowerCase()));
  });

  if (matchedRef) {
    cleanModelName = matchedRef.name;
    category = matchedRef.category;
  } else {
    // Normalisation syntaxique de la casse
    cleanModelName = cleanModelName
      .replace(/\bthinkpad\b/i, "ThinkPad")
      .replace(/\blatitude\b/i, "Latitude")
      .replace(/\boptiplex\b/i, "OptiPlex")
      .replace(/\belitebook\b/i, "EliteBook")
      .replace(/\bprobook\b/i, "ProBook")
      .replace(/\bthinkcentre\b/i, "ThinkCentre")
      .replace(/\bmacbook\b/i, "MacBook")
      .replace(/\belitedesk\b/i, "EliteDesk")
      .replace(/\bprodesk\b/i, "ProDesk")
      .replace(/\biphone\b/i, "iPhone")
      .replace(/\bxps\b/i, "XPS")
      .replace(/\bgen\b/i, "Gen");
  }

  // Si après tout le nettoyage le modèle est vide, garder le raw trimé
  if (!cleanModelName) {
    cleanModelName = raw;
  }

  // Déduire la marque
  let brand = "Générique";
  const catLower = category.toLowerCase();
  if (catLower.includes("lenovo")) brand = "Lenovo";
  else if (catLower.includes("dell")) brand = "Dell";
  else if (catLower.includes("hp")) brand = "HP";
  else if (catLower.includes("apple") || catLower.includes("iphone")) brand = "Apple";

  // Déduire le form factor
  let formFactor: "portable" | "desktop" | "phone" | "unknown" = "portable";
  if (catLower.includes("desktop") || catLower.includes("tour") || catLower.includes("bureau")) {
    formFactor = "desktop";
  } else if (catLower.includes("iphone") || catLower.includes("phone")) {
    formFactor = "phone";
  }

  // Composer la chaîne complète de spécifications
  const specsParts: string[] = [];
  if (cpu) specsParts.push(cpu);
  if (ram) specsParts.push(ram);
  if (storage) specsParts.push(storage);

  return {
    raw,
    cleanModelName,
    brand,
    category,
    formFactor,
    specs: {
      cpu,
      ram,
      storage,
      fullConfiguration: specsParts.join(", ")
    },
    matchedReference: matchedRef
  };
}

/**
 * Recherche rapide dans les modèles de référence pour l'autocomplétion
 */
export function searchReferenceModels(query: string, limit: number = 8): ReferenceModelItem[] {
  if (!query || query.trim().length < 2) return [];
  const q = query.trim().toLowerCase();

  const results: { item: ReferenceModelItem; score: number }[] = [];

  for (const item of REFERENCE_MODELS) {
    const nameLower = item.name.toLowerCase();

    // Correspondance exacte
    if (nameLower === q) {
      results.push({ item, score: 100 });
      continue;
    }

    // Préfixe direct (ex: "542" -> "Latitude 5420")
    if (nameLower.startsWith(q)) {
      results.push({ item, score: 80 });
      continue;
    }

    // Nom contenant la requête
    if (nameLower.includes(q)) {
      results.push({ item, score: 60 });
      continue;
    }

    // Alias contenant la requête
    if (item.aliases?.some(a => a.toLowerCase().includes(q))) {
      results.push({ item, score: 50 });
      continue;
    }

    // Recherche mot par mot (ex: "t14 g3" -> "ThinkPad T14 Gen 3")
    const words = q.split(/\s+/).filter(Boolean);
    if (words.length > 1 && words.every(w => nameLower.includes(w))) {
      results.push({ item, score: 40 });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit).map(r => r.item);
}
