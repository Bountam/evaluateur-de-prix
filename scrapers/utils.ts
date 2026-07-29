// ─── Scraper Utilities & Universal CAD Price / URL Parsing ───

/**
 * Normalise et parse un prix en dollars canadiens (CAD), gérant parfaitement :
 * - Le format français canadien (ex: "549,00 $", "1 234,56 $", "34,99 $")
 * - Le format anglais canadien (ex: "$549.00", "$1,234.56", "$34.99")
 * Évite le bug où "549,00 $" était converti en 54900$.
 */
export function parseCADPrice(raw: string | number | undefined | null): number | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw === 'number') {
    if (isNaN(raw) || raw < 10) return null;
    return Math.round(raw * 100) / 100;
  }

  const str = String(raw).trim();
  if (!str) return null;

  // 1. Nettoyage initial des symboles monétaires et espaces insécables
  let cleaned = str
    .replace(/C\s*\$/gi, '')
    .replace(/CA\s*\$/gi, '')
    .replace(/CAD/gi, '')
    .replace(/\$/g, '')
    .replace(/\s+/g, '')
    .replace(/[^\d.,]/g, '');

  if (!cleaned) return null;

  // 2. Gestion des séparateurs virgule (,) et point (.)
  const hasComma = cleaned.includes(',');
  const hasDot = cleaned.includes('.');

  if (hasComma && hasDot) {
    const commaIndex = cleaned.lastIndexOf(',');
    const dotIndex = cleaned.lastIndexOf('.');
    if (commaIndex > dotIndex) {
      // Ex: "1.234,56" -> virgule comme séparateur décimal
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      // Ex: "1,234.56" -> point comme séparateur décimal
      cleaned = cleaned.replace(/,/g, '');
    }
  } else if (hasComma) {
    // Il y a uniquement des virgules : ex "549,00" vs "1,234" vs "34,99"
    const parts = cleaned.split(',');
    const lastPart = parts[parts.length - 1];
    // Si la dernière partie après la virgule a exactement 2 chiffres (ex: ",00" ou ",99" ou ",50"), c'est un séparateur décimal
    if (lastPart && lastPart.length === 2) {
      cleaned = parts.slice(0, -1).join('') + '.' + lastPart;
    } else {
      // Sinon c'est un séparateur de milliers ou autre : on supprime la virgule
      cleaned = cleaned.replace(/,/g, '');
    }
  }

  let val = parseFloat(cleaned);
  if (isNaN(val) || val < 10) return null;
  // Correction automatique si le prix a été extrait sans point décimal (ex: 69900 ou 154999 au lieu de 699.00 / 1549.99)
  if (val > 5000) {
    val = val / 100;
  }
  return Math.round(val * 100) / 100;
}

/**
 * Nettoie et normalise une URL de produit pour qu'elle soit absolue, sans paramètres de suivi (tracking/UTM),
 * et redirige directement vers l'article.
 */
export function cleanProductUrl(rawUrl: string | undefined, baseUrl: string): string {
  if (!rawUrl || rawUrl === '#' || rawUrl.trim() === '') {
    return baseUrl;
  }

  let fullUrl = rawUrl.trim();
  if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://')) {
    try {
      const baseOrigin = fullUrl.startsWith('/') ? new URL(baseUrl).origin : baseUrl.replace(/\/+$/, '');
      const pathClean = fullUrl.startsWith('/') ? fullUrl : `/${fullUrl}`;
      fullUrl = `${baseOrigin}${pathClean}`;
    } catch {
      const baseClean = baseUrl.replace(/\/+$/, '');
      const pathClean = fullUrl.startsWith('/') ? fullUrl : `/${fullUrl}`;
      fullUrl = `${baseClean}${pathClean}`;
    }
  }

  try {
    const urlObj = new URL(fullUrl);
    // Conserver uniquement le chemin propre sans les paramètres de recherche (?ref=..., ?utm=..., ?_nkw=...)
    // Sauf si l'URL dépend d'un paramètre clé (comme id=... ou p=...)
    if (urlObj.hostname.includes('amazon.')) {
      // Pour Amazon, le chemin canonique est /dp/ASIN ou /titre/dp/ASIN
      const dpMatch = urlObj.pathname.match(/\/(?:[^\/]+\/)?(?:dp|gp\/product)\/([A-Z0-9]{10})/i);
      if (dpMatch && dpMatch[1]) {
        return `https://www.${urlObj.hostname.replace(/^www\./, '')}/dp/${dpMatch[1]}`;
      }
    } else if (urlObj.hostname.includes('ebay.')) {
      // Pour eBay, le chemin canonique est /itm/ITEM_ID
      const itmMatch = urlObj.pathname.match(/\/itm\/(?:[^\/]+\/)?(\d+)/i);
      if (itmMatch && itmMatch[1]) {
        return `https://www.${urlObj.hostname.replace(/^www\./, '')}/itm/${itmMatch[1]}`;
      }
    } else if (urlObj.hostname.includes('backmarket.')) {
      // Conserver les paramètres d'ID de configuration pour Back Market (comme ?id=... ou ?l=...)
      return fullUrl;
    } else if (urlObj.hostname.includes('reebelo.')) {
      // Conserver les paramètres d'ID de configuration pour Reebelo (comme ?skuId=...)
      return fullUrl;
    } else if (urlObj.hostname.includes('bestbuy.')) {
      // Pour Best Buy, enlever les query strings
      return `${urlObj.origin}${urlObj.pathname}`;
    } else if (urlObj.hostname.includes('gcsurplus.ca')) {
      // Pour GCSurplus, les paramètres (snc, sc, scn, lcn, etc.) sont indispensables pour accéder à l'enchère/lot
      return fullUrl;
    }

    // Par défaut, retourner le pathname propre (ou avec le minimum requis)
    if (urlObj.pathname.length > 1) {
      return `${urlObj.origin}${urlObj.pathname}`;
    }
    return fullUrl;
  } catch {
    return fullUrl.split('?')[0] || baseUrl;
  }
}

export interface ListingSpecs {
  year?: string;      // ex: "2020", "2022"
  cpu?: string;       // ex: "i7-10750H", "i5", "M2"
  ram?: string;       // ex: "16 Go", "8 Go", "32 Go"
  storage?: string;   // ex: "512 Go SSD", "1 To SSD", "256 Go"
  model?: string;     // ex: "XPS 15 9500", "ThinkPad T480"
  screenSize?: string; // ex: "14"", "15.6"", "13.3""
  os?: string;        // ex: "Windows 11 Pro", "Windows 10 Home", "No OS", "macOS"
  warranty?: string;  // ex: "Garantie 1 an", "90 jours", "Garantie incluse"
  isLot?: boolean;    // true si vente en lot
  unitOrLot?: 'unit' | 'lot'; // 'unit' ou 'lot'
}

/**
 * Détecte si une annonce vend uniquement des pièces détachées ou un assemblage
 * (écran seul, carte mère, batterie, boite vide, pour pièces, broken, etc.)
 */
// Expression régulières pré-compilées globalement pour la détection de pièces/assemblages
const EXACT_PATTERNS = [
  /\bfor parts\b/,
  /\bparts only\b/,
  /\bpart only\b/,
  /\bparts\/repair\b/,
  /\bpour pi[eè]ces?\b/,
  /\bpi[eè]ce seule\b/,
  /\b(?:keycap|keycaps|touche|touches)\b/i,
  /\b(?:mother|main|logic|system)[\s-]*board\b/,
  /\bcarte[\s-]*m[eè]re\b/,
  /\bassembly\b/i,
  /\bassemblage\b/i,
  /\b(?:empty|bo[iî]te)[\s-]*box\b/,
  /\bbox[\s-]*only\b/,
  /\b(?:broken|bris[eé]|cracked|cass[eé]|d[eé]fectu(?:eux|euse)|not working|non fonctionnel)\b/,
  /\bas[\s-]*is\b/
];

const PART_KEYWORDS = [
  /\bchargeur(?:s)?\b/,
  /\bcharger(?:s)?\b/,
  /\bbat(?:t)?er(?:y|ies)\b/,
  /\bbat(?:t)er(?:ie|ies)\b/,
  /\badapter(?:s)?\b/,
  /\badaptateur(?:s)?\b/,
  /\bpower\s+supply\b/,
  /\bpower\s+cord\b/,
  /\bcordon\s+d'alimentation\b/,
  /\bcooling\s+fan\b/,
  /\bventilateur(?:s)?\b/,
  /\bfan(?:s)?\b/,
  /\bhousse(?:s)?\b/,
  /\bsleeve(?:s)?\b/,
  /\bétui(?:s)?\b/,
  /\bsacoche(?:s)?\b/,
  /\bbag(?:s)?\b/,
  /\bprotecteur(?:s)?\s+d'écran\b/,
  /\bprotecteur(?:s)?\s+ecran\b/,
  /\bscreen\s+protectors?\b/,
  /\bfilm(?:s)?\s+protecteur(?:s)?\b/,
  /\bfilm(?:s)?\s+de\s+protection\b/,
  /\brubber\s+feet\b/,
  /\brubber\s+foot\b/,
  /\bpieds?\s+en\s+caoutchouc\b/,
  /\bpatins?\s+en\s+caoutchouc\b/,
  /\bpieds?\s+de\s+rechange\b/,
  /\bpatins?\s+de\s+rechange\b/,
  /\bfeet\s+pad(?:s)?\b/,
  /\bbottom\s+cover\b/,
  /\bcoque\s+inférieure\b/,
  /\bbase\s+inférieure\b/,
  /\bkeyboard(?:s)?\b/,
  /\bclavier(?:s)?\b/,
  /\btrackpad(?:s)?\b/,
  /\btouchpad(?:s)?\b/,
  /\blcd\s+screen\b/,
  /\bdalle\s+lcd\b/,
  /\breplacement\s+screen\b/,
  /\bpalmrest\b/,
  /\brepose-poignet\b/,
  /\bhinges?\b/,
  /\bcharnières?\b/,
  /\bbezel(?:s)?\b/,
  /\bcadre(?:s)?\b/,
  /\bglass\s+only\b/,
  /\bvitre\s+seule\b/
];

/**
 * Détecte si une annonce vend uniquement des pièces détachées ou un assemblage
 * (écran seul, carte mère, batterie, boite vide, pour pièces, broken, etc.)
 */
export function isPartOrAssembly(title: string | undefined | null): boolean {
  if (!title) return false;
  const t = title.toLowerCase();

  // 1. Détection immédiate si le titre indique que c'est une pièce ou pour pièces
  if (EXACT_PATTERNS.some(regex => regex.test(t))) {
    return true;
  }

  // 2. Détecter si le titre contient des mots-clés d'accessoires ou pièces détachées
  const hasPartKeyword = PART_KEYWORDS.some(regex => regex.test(t));
  if (hasPartKeyword) {
    // Si c'est explicitement relié par des conjonctions de pièces
    const isAccessoryProduct = /\b(?:pour|for|compatible|replacement|rechange|remplacement|convient|fits?|fit|adapté|de\s+rechange|de\s+remplacement)\b/.test(t);
    if (isAccessoryProduct) {
      return true;
    }

    const isIncludedMatch = /\b(?:inclus|incluse|inclu|included|includes|with|avec|fourni|livré|neuve|nouvelle|new)\b/.test(t);
    if (!isIncludedMatch) {
      return true;
    }
  }

  return false;
}

/**
 * Vérifie si le titre de l'annonce correspond réellement au modèle recherché.
 * Évite d'inclure des modèles alternatifs de la même marque ramenés par recherche floue.
 */
export function isModelMatch(title: string | undefined | null, searchModel: string): boolean {
  if (!title) return false;
  const t = title.toLowerCase();
  const sm = searchModel.toLowerCase().trim();

  // 1. Détection des codes numériques à 4 chiffres (ex: 9730, 9530, 7590, 5420)
  const searchFourDigit = sm.match(/\b\d{4}\b/g);
  if (searchFourDigit) {
    for (const code of searchFourDigit) {
      if (!t.includes(code)) return false;
    }
  }

  // 2. ThinkPad (T480, T480s, T490, etc.)
  const searchThinkPadCode = sm.match(/\b(t\d{3}s?|x\d{2,3}|l\d{3}|e\d{3}|t14(?:s)?|x1)\b/i);
  if (searchThinkPadCode && searchThinkPadCode[1]) {
    const code = searchThinkPadCode[1].toLowerCase();
    if (!t.includes(code)) return false;
    // Si on a cherché t480, exclure t480s
    if (code === 't480' && t.includes('t480s')) return false;
    if (code === 't490' && t.includes('t490s')) return false;
  }

  // 3. HP EliteBook (G5, G6, G7, G8, etc.)
  const searchEliteBookCode = sm.match(/\b840\s*g\d\b/i);
  if (searchEliteBookCode) {
    const gMatch = sm.match(/g(\d)/i);
    if (gMatch && gMatch[1]) {
      const gNum = gMatch[1];
      if (!t.includes('840')) return false;
      if (!t.includes(`g${gNum}`) && !t.includes(`gen ${gNum}`) && !t.includes(`generation ${gNum}`)) return false;
    }
  }

  // 4. Dell XPS (XPS 15 vs XPS 17 vs XPS 13)
  if (sm.includes('xps')) {
    if (sm.includes('15') && t.includes('xps 17')) return false;
    if (sm.includes('17') && t.includes('xps 15')) return false;
    if (sm.includes('13') && (t.includes('xps 15') || t.includes('xps 17'))) return false;
  }

  // 5. iPhones (11, 12, 13, 14, 15, SE, Pro, Max, Mini, Plus)
  if (sm.includes('iphone')) {
    const iphoneNumMatch = sm.match(/\b(11|12|13|14|15|se)\b/i);
    if (iphoneNumMatch && iphoneNumMatch[1]) {
      const num = iphoneNumMatch[1].toLowerCase();
      if (!t.includes(num)) return false;

      if (num === 'se') {
        if (sm.includes('2020') && t.includes('2022')) return false;
        if (sm.includes('2022') && t.includes('2020')) return false;
      }
      
      const searchPro = sm.includes('pro');
      const searchMax = sm.includes('max');
      const searchMini = sm.includes('mini');
      const searchPlus = sm.includes('plus');

      const titlePro = t.includes('pro');
      const titleMax = t.includes('max');
      const titleMini = t.includes('mini');
      const titlePlus = t.includes('plus');

      if (searchPro !== titlePro) return false;
      if (searchMax !== titleMax) return false;
      if (searchMini !== titleMini) return false;
      if (searchPlus !== titlePlus) return false;
    }
  }

  return true;
}

/**
 * Extrait les caractéristiques techniques détaillées (année, processeur, RAM, stockage)
 * à partir du titre brut d'une annonce.
 */
export function extractSpecsFromTitle(title: string | undefined | null): ListingSpecs {
  if (!title) return {};
  const specs: ListingSpecs = {};

  // 1. Année (Year)
  const yearMatch = title.match(/\b(201[5-9]|202[0-9])\b/);
  if (yearMatch) {
    specs.year = yearMatch[1];
  }

  // 2. RAM
  const ramMatch = title.match(/\b(\d+)\s*(?:GB|Go|G)\b(?:\s*(?:RAM|DDR\d|LPDDR\d))?/i) ||
                   title.match(/\b(?:RAM|Mémoire|Memory)[\s:]*(\d+)\s*(?:GB|Go|G)?\b/i);
  if (ramMatch && ramMatch[1]) {
    const num = parseInt(ramMatch[1], 10);
    if (num === 4 || num === 8 || num === 12 || num === 16 || num === 24 || num === 32 || num === 64 || num === 128) {
      specs.ram = `${num} Go`;
    }
  }

  // 3. Stockage (Storage / SSD / HDD) - Priorité aux mentions explicites SSD/HDD/NVMe
  const explicitStorageMatch = title.match(/\b(\d+(?:\.\d+)?)\s*(TB|To|GB|Go|T)\b[\s-]*(?:SSD|HDD|NVMe|PCIe|eMMC|Flash)\b/i) ||
                               title.match(/\b(?:SSD|HDD|NVMe|PCIe|eMMC|Flash|Stockage|Storage)[\s:-]*(\d+(?:\.\d+)?)\s*(TB|To|GB|Go|T)\b/i);
  if (explicitStorageMatch && explicitStorageMatch[1]) {
    const val = parseFloat(explicitStorageMatch[1]);
    let unit = (explicitStorageMatch[2] || 'GB').toUpperCase();
    if (unit === 'T' || unit === 'TB' || unit === 'TO') {
      specs.storage = `${val} To SSD`;
    } else {
      specs.storage = `${val} Go SSD`;
    }
  } else {
    // Sinon, on cherche toutes les occurrences de capacités et on filtre celles qui ne sont pas la RAM
    const allCapacities = [...title.matchAll(/\b(\d+(?:\.\d+)?)\s*(TB|To|GB|Go|T)\b/gi)];
    for (const match of allCapacities) {
      const val = parseFloat(match[1]);
      let unit = match[2].toUpperCase();
      if (unit === 'T' || unit === 'TB' || unit === 'TO') {
        specs.storage = `${val} To SSD`;
        break;
      } else if (val >= 128 && val !== parseInt(specs.ram || '0', 10)) {
        specs.storage = `${val} Go SSD`;
        break;
      }
    }
  }

  // 4. Processeur (CPU)
  const intelMatch = title.match(/\b(?:Intel\s+)?(?:Core\s+)?(i[3579][\s-]?\d{4,5}[A-Z]*)\b/i);
  const amdMatch = title.match(/\b(?:AMD\s+)?(Ryzen\s*[3579][\s-]?\d{4}[A-Z]*)\b/i);
  const appleMatch = title.match(/\b(M[1-4](?:\s*(?:Pro|Max|Ultra))?)\b/i);

  if (intelMatch && intelMatch[1]) {
    specs.cpu = intelMatch[1].toUpperCase().replace(/\s+/g, '-');
  } else if (amdMatch && amdMatch[1]) {
    specs.cpu = amdMatch[1].replace(/\s+/g, ' ');
  } else if (appleMatch && appleMatch[1]) {
    specs.cpu = appleMatch[1];
  }

  // 5. Taille d'écran (Screen Size)
  const screenMatch = title.match(/\b(11\.6|12\.5|13\.3|14\.0|14|15\.6|15|16|17\.3|17|6\.1|6\.7)[\s-]*(?:"|''|inch|in|pouces?)\b/i) ||
                      title.match(/\b(11\.6|12\.5|13\.3|14\.0|14|15\.6|15|16|17\.3|17)\s*(?:FHD|HD|4K|QHD|OLED|IPS)\b/i);
  if (screenMatch && screenMatch[1]) {
    const rawSize = screenMatch[1];
    if (rawSize === "14.0") specs.screenSize = '14"';
    else if (rawSize === "15.0") specs.screenSize = '15"';
    else specs.screenSize = `${rawSize}"`;
  }

  // 6. Système d'exploitation (OS)
  const tLower = title.toLowerCase();
  if (/\bwin(?:dows)?\s*11\s*(?:pro|professionnel)/i.test(tLower)) {
    specs.os = "Windows 11 Pro";
  } else if (/\bwin(?:dows)?\s*11\s*(?:home|familial|famille)/i.test(tLower)) {
    specs.os = "Windows 11 Familial";
  } else if (/\bwin(?:dows)?\s*11\b/i.test(tLower)) {
    specs.os = "Windows 11";
  } else if (/\bwin(?:dows)?\s*10\s*(?:pro|professionnel)/i.test(tLower)) {
    specs.os = "Windows 10 Pro";
  } else if (/\bwin(?:dows)?\s*10\s*(?:home|familial|famille)/i.test(tLower)) {
    specs.os = "Windows 10 Familial";
  } else if (/\bwin(?:dows)?\s*10\b/i.test(tLower)) {
    specs.os = "Windows 10";
  } else if (/\b(?:mac\s*os|macos|os\s*x|sequoia|sonoma|ventura|monterey)\b/i.test(tLower)) {
    specs.os = "macOS";
  } else if (/\b(?:chrome\s*os|chromebook)\b/i.test(tLower)) {
    specs.os = "ChromeOS";
  } else if (/\b(?:no\s+os|sans\s+os|freedos|no\s+operating\s+system)\b/i.test(tLower)) {
    specs.os = "No OS";
  }

  // 7. Garantie (Warranty)
  if (/\b(?:garantie|warranty|renewed|refurbished\s+guarantee|certified\s+refurbished|under\s+warranty|sous\s+garantie)\b/i.test(tLower)) {
    if (/\b1\s*(?:an|yr|year)\b/i.test(tLower)) {
      specs.warranty = "Garantie 1 an";
    } else if (/\b(?:90\s*jours?|90\s*days?)\b/i.test(tLower)) {
      specs.warranty = "Garantie 90 jours";
    } else if (/\b(?:2\s*ans?|2\s*yrs?|2\s*years?)\b/i.test(tLower)) {
      specs.warranty = "Garantie 2 ans";
    } else {
      specs.warranty = "Garantie incluse";
    }
  }

  // 8. Format Lot vs Unité (isLot / unitOrLot)
  if (/\b(?:lot\s+de|lot\s+of|pack\s+de|bundle\s+of|\bqty\b|\blots\b|\bbulk\b|\blot\b|\bx[2-9]\b|\bx10\b|ensemble\s+de)\b/i.test(tLower)) {
    specs.isLot = true;
    specs.unitOrLot = 'lot';
  } else {
    specs.isLot = false;
    specs.unitOrLot = 'unit';
  }

  return specs;
}
