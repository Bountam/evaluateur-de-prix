import path from "path";
import fs from "fs";
import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import dotenv from "dotenv";
import { MASTER_LIST_MODELS } from "../../src/modelsData.ts";

dotenv.config();

export const PORT = Number(process.env.PORT) || 3000;
export const HOST = process.env.HOST || "127.0.0.1";

export const PROJECT_ROOT = process.cwd();
export const DB_PATH = path.join(PROJECT_ROOT, "db.json");
export const DATA_DIR = path.join(PROJECT_ROOT, "data");
export const SQLITE_PATH = path.join(DATA_DIR, "database.sqlite");
export const BACKUP_DIR = path.join(DATA_DIR, "backups");
export const EXPORTS_DIR = path.join(PROJECT_ROOT, "exports");
export const LOGS_DIR = path.join(PROJECT_ROOT, "logs");
export const MASTER_FILE_NAME = "Export_Donnees_Brutes.xlsx";

// S'assurer que les répertoires critiques existent
[DATA_DIR, BACKUP_DIR, EXPORTS_DIR, LOGS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Logger Winston avec rotation quotidienne
export const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.printf(info => `${info.timestamp} [${info.level.toUpperCase()}]: ${info.message}`)
  ),
  transports: [
    new winston.transports.Console(),
    new DailyRotateFile({
      filename: path.join(LOGS_DIR, "app-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      maxSize: "20m",
      maxFiles: "14d"
    })
  ]
});

// Interception optionnelle de console.log / console.error vers le logger
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
console.log = (...args: any[]) => { logger.info(args.join(" ")); originalConsoleLog(...args); };
console.error = (...args: any[]) => { logger.error(args.join(" ")); originalConsoleError(...args); };

// Ensemble normalisé en minuscules de tous les modèles officiels
export const STANDARD_MODEL_NAMES = new Set<string>();
MASTER_LIST_MODELS.forEach(cat => {
  cat.models.forEach(m => STANDARD_MODEL_NAMES.add(m.toLowerCase().trim()));
});

// Construction d'URL fonctionnelle pour les annonces
export function getFunctionalUrl(source: string, title: string, model: string): string {
  const cleanModel = model.trim();
  const src = (source || "").toLowerCase();

  if (src.includes("ebay")) {
    const isOutlier = title.toLowerCase().includes("pièces") || title.toLowerCase().includes("réparation") || title.toLowerCase().includes("parts");
    const isBox = title.toLowerCase().includes("boîte") || title.toLowerCase().includes("emballage") || title.toLowerCase().includes("box");
    if (isOutlier) {
      return `https://www.ebay.ca/sch/i.html?_nkw=${encodeURIComponent(cleanModel + " pour pieces")}`;
    }
    if (isBox) {
      return `https://www.ebay.ca/sch/i.html?_nkw=${encodeURIComponent(cleanModel + " boite vide")}`;
    }
    return `https://www.ebay.ca/sch/i.html?_nkw=${encodeURIComponent(cleanModel)}`;
  } else if (src.includes("amazon")) {
    return `https://www.amazon.ca/s?k=${encodeURIComponent(cleanModel)}&rh=n%3A17332215011`;
  } else if (src.includes("reebelo")) {
    return `https://www.reebelo.ca/search?q=${encodeURIComponent(cleanModel)}`;
  } else if (src.includes("best buy") || src.includes("bestbuy")) {
    return `https://www.bestbuy.ca/en-ca/search?search=${encodeURIComponent(cleanModel)}`;
  } else if (src.includes("newegg")) {
    return `https://www.newegg.ca/p/pl?d=${encodeURIComponent(cleanModel)}&N=4016`;
  } else if (src.includes("refurb-io") || src.includes("refurb.io")) {
    return `https://refurb.io/search?q=${encodeURIComponent(cleanModel)}`;
  } else if (src.includes("walmart")) {
    return `https://www.walmart.ca/en/search?q=${encodeURIComponent(cleanModel)}`;
  } else if (src.includes("dell")) {
    return `https://www.dellrefurbished.ca/index.php?page=seek&id[m]=pattern&id[q]=${encodeURIComponent(cleanModel)}`;
  } else if (src.includes("it-refurbs") || src.includes("it refurbs")) {
    return `https://itrefurbs.ca/search?q=${encodeURIComponent(cleanModel)}`;
  } else if (src.includes("canada computers")) {
    return `https://www.canadacomputers.com/search/results_details.php?keywords=${encodeURIComponent(cleanModel + ' refurbished')}`;
  } else if (src.includes("seao")) {
    return `https://seao.gouv.qc.ca/`;
  } else if (src.includes("gcsurplus")) {
    return `https://gcsurplus.ca/mn-eng.cfm?snc=wfsav&sc=ach-shop&frm_cmdSearch=1&vndsld=0&frm_txtKeyWord=${encodeURIComponent(cleanModel)}`;
  } else if (src.includes("backmarket") || src.includes("back market")) {
    return `https://www.backmarket.ca/fr-ca/search?q=${encodeURIComponent(cleanModel)}`;
  } else {
    return `https://www.google.com/search?q=${encodeURIComponent(cleanModel)}`;
  }
}

// Extraction de la marque commerciale
export function getBrand(model: string, _category: string): string {
  const mLower = model.toLowerCase();
  if (mLower.includes("thinkpad") || mLower.includes("thinkcentre") || mLower.includes("lenovo")) return "Lenovo";
  if (mLower.includes("latitude") || mLower.includes("optiplex") || mLower.includes("dell")) return "Dell";
  if (mLower.includes("elitebook") || mLower.includes("probook") || mLower.includes("elitedesk") || mLower.includes("prodesk") || mLower.includes("hp")) return "HP";
  if (mLower.includes("macbook") || mLower.includes("iphone") || mLower.includes("apple")) return "Apple";
  return "Autre";
}

// Métadonnées réalistes de configuration par modèle
export function getModelMeta(model: string) {
  let configuration = "Intel Core i5, 16 Go RAM, 256 Go SSD";
  let condition = "Très bon";
  let commentaires = "Tarif stable sur le marché secondaire canadien.";

  if (model.includes("MacBook")) {
    configuration = model.includes("M1") ? "Apple M1, 8 Go RAM, 256 Go SSD" : (model.includes("M2") ? "Apple M2, 8 Go RAM, 256 Go SSD" : "Intel Core i5, 8 Go RAM, 256 Go SSD");
    condition = "Excellent";
    commentaires = "Forte valeur résiduelle. Matériel très recherché par les étudiants.";
  } else if (model.includes("iPhone")) {
    configuration = model.includes("Pro Max") ? "Écran 6.7\", 128 Go, Débloqué" : (model.includes("Pro") ? "Écran 6.1\", 128 Go, Débloqué" : "Écran 6.1\", 64 Go, Débloqué");
    condition = "Excellent";
    commentaires = "Marché secondaire extrêmement liquide. Rotation rapide en magasin Insertech.";
  } else if (model.includes("ThinkCentre") || model.includes("OptiPlex") || model.includes("Desk")) {
    configuration = "Intel Core i5, 16 Go RAM, 512 Go NVMe SSD, Format Mini PC";
    condition = "Très bon";
    commentaires = "Idéal pour les postes de bureau légers et le télétravail.";
  } else if (model.includes("T14") || model.includes("5420") || model.includes("840 G7")) {
    configuration = "Intel Core i5 Gen 11, 16 Go RAM, 512 Go SSD, Écran 14\" FHD";
    condition = "Excellent";
    commentaires = "Génération récente, de plus en plus disponible sur le marché d'occasion.";
  }

  return { configuration, condition, commentaires };
}

export const ESTIMATED_BASE_PRICES: { pattern: string; price: number }[] = [
  // Lenovo ThinkPad
  { pattern: "T480s", price: 310 },
  { pattern: "T480", price: 280 },
  { pattern: "T490s", price: 360 },
  { pattern: "T490", price: 330 },
  { pattern: "T14 Gen 1", price: 450 },
  { pattern: "T14 Gen 2", price: 580 },
  { pattern: "L480", price: 220 },
  { pattern: "L490", price: 260 },
  { pattern: "E480", price: 210 },
  { pattern: "E490", price: 250 },
  { pattern: "X390", price: 290 },
  { pattern: "X13", price: 380 },
  { pattern: "X1 Carbon Gen 6", price: 410 },

  // Dell Latitude
  { pattern: "5400", price: 320 },
  { pattern: "5410", price: 370 },
  { pattern: "5420", price: 440 },
  { pattern: "5430", price: 580 },
  { pattern: "5490", price: 260 },
  { pattern: "5500", price: 340 },
  { pattern: "5510", price: 390 },
  { pattern: "5520", price: 460 },
  { pattern: "7300", price: 330 },
  { pattern: "7310", price: 380 },
  { pattern: "7400", price: 350 },
  { pattern: "7410", price: 410 },
  { pattern: "7420", price: 480 },

  // HP EliteBook / ProBook
  { pattern: "840 G5", price: 290 },
  { pattern: "840 G6", price: 340 },
  { pattern: "840 G7", price: 430 },
  { pattern: "840 G8", price: 550 },
  { pattern: "850 G5", price: 330 },
  { pattern: "850 G6", price: 380 },
  { pattern: "440 G5", price: 240 },
  { pattern: "450 G5", price: 260 },

  // Apple MacBooks
  { pattern: "MacBook Air Intel", price: 390 },
  { pattern: "MacBook Air M1", price: 580 },
  { pattern: "MacBook Air M2", price: 850 },
  { pattern: "MacBook Pro Intel", price: 480 },
  { pattern: "MacBook Pro M1", price: 750 },
  { pattern: "MacBook Pro M2", price: 1050 },

  // Lenovo ThinkCentre
  { pattern: "M720q", price: 160 },
  { pattern: "M720", price: 180 },
  { pattern: "M920q", price: 195 },
  { pattern: "M920", price: 220 },
  { pattern: "M70q", price: 260 },
  { pattern: "M80q", price: 310 },
  { pattern: "M90q", price: 380 },

  // Dell OptiPlex
  { pattern: "3060", price: 150 },
  { pattern: "5060", price: 170 },
  { pattern: "7060", price: 190 },
  { pattern: "3070", price: 210 },
  { pattern: "5070", price: 230 },
  { pattern: "7070", price: 255 },
  { pattern: "3080", price: 310 },
  { pattern: "5080", price: 350 },
  { pattern: "7080", price: 395 },

  // HP EliteDesk / ProDesk
  { pattern: "800 G4", price: 185 },
  { pattern: "800 G5", price: 240 },
  { pattern: "800 G6", price: 350 },
  { pattern: "600 G4", price: 160 },
  { pattern: "600 G5", price: 210 },

  // Apple iPhones
  { pattern: "iPhone 11 Pro Max", price: 340 },
  { pattern: "iPhone 11 Pro", price: 310 },
  { pattern: "iPhone 11", price: 240 },
  { pattern: "iPhone SE 2020", price: 150 },
  { pattern: "iPhone 12 Mini", price: 280 },
  { pattern: "iPhone 12 Pro Max", price: 450 },
  { pattern: "iPhone 12 Pro", price: 410 },
  { pattern: "iPhone 12", price: 330 },
  { pattern: "iPhone 13 Mini", price: 380 },
  { pattern: "iPhone 13 Pro Max", price: 590 },
  { pattern: "iPhone 13 Pro", price: 520 },
  { pattern: "iPhone 13", price: 440 },
  { pattern: "iPhone SE 2022", price: 240 },
  { pattern: "iPhone 14 Plus", price: 530 },
  { pattern: "iPhone 14 Pro Max", price: 790 },
  { pattern: "iPhone 14 Pro", price: 690 },
  { pattern: "iPhone 14", price: 560 },
  { pattern: "iPhone 15 Plus", price: 730 },
  { pattern: "iPhone 15 Pro Max", price: 1050 },
  { pattern: "iPhone 15 Pro", price: 950 },
  { pattern: "iPhone 15", price: 760 }
];

export function getEstimatedBasePrice(model: string): number {
  const matched = ESTIMATED_BASE_PRICES.find(item => model.includes(item.pattern));
  return matched ? matched.price : 250;
}
