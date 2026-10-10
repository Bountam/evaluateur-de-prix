import fs from "fs";
import path from "path";
import crypto from "crypto";
import * as XLSX from "xlsx";
import { normalizeCategory } from "../../src/modelsData.ts";
import {
  EXPORTS_DIR,
  MASTER_FILE_NAME,
  STANDARD_MODEL_NAMES,
  getBrand,
  getFunctionalUrl
} from "../config/index.ts";
import {
  readDB,
  writeDB,
  withDBLock,
  createBackupBeforeImport,
  cachedStateHash,
  setCachedStateHash
} from "../database/repository.ts";

export function parseExcelDate(val: any): Date {
  if (!val) return new Date(0);
  if (val instanceof Date) return val;
  if (typeof val === "number") {
    return new Date(Math.round((val - 25569) * 86400 * 1000));
  }
  const str = String(val).trim();
  const frMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (frMatch) {
    return new Date(parseInt(frMatch[3], 10), parseInt(frMatch[2], 10) - 1, parseInt(frMatch[1], 10));
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? new Date(0) : d;
}

export function parseCADPrice(val: any): number {
  if (val === undefined || val === null) return 0;
  if (typeof val === "number") return isNaN(val) ? 0 : Math.round(val * 100) / 100;
  const str = String(val).replace(/[\s\u00A0]/g, "").replace(/\$/g, "").replace(/CAD/gi, "").replace(/,/g, ".");
  const match = str.match(/[-+]?[0-9]*\.?[0-9]+/);
  if (!match) return 0;
  const num = parseFloat(match[0]);
  return isNaN(num) ? 0 : Math.round(num * 100) / 100;
}

export function generateMasterExcel(_targetPath?: string) {
  const db = readDB();
  if (!db.customModels) db.customModels = [];
  if (!db.evaluations) db.evaluations = {};

  // 1. Garantir que TOUS les modèles personnalisés ont une fiche d'évaluation pour l'export
  db.customModels.forEach((cm: any) => {
    if (!db.evaluations[cm.modelName]) {
      db.evaluations[cm.modelName] = {
        modelName: cm.modelName,
        category: normalizeCategory(cm.category),
        medianPrice: 0,
        confidence: "Aucun",
        comparablesCount: 0,
        lastScraped: "",
        listings: [],
        configuration: cm.configuration || "Spécifications standard à valider",
        condition: "Très bon",
        commentaires: "Modèle personnalisé ajouté manuellement.",
        historicalPrices: []
      };
    }
  });

  // 2. Garantir que tout modèle non-standard présent dans les évaluations est aussi répertorié dans les modèles personnalisés
  Object.keys(db.evaluations).forEach(modelName => {
    const cleanModel = modelName.trim();
    if (!STANDARD_MODEL_NAMES.has(cleanModel.toLowerCase())) {
      const exists = db.customModels.some((cm: any) => cm.modelName.toLowerCase() === cleanModel.toLowerCase());
      if (!exists) {
        db.customModels.push({
          category: normalizeCategory(db.evaluations[modelName].category),
          modelName: cleanModel,
          addedAt: new Date().toISOString(),
          configuration: db.evaluations[modelName].configuration || ""
        });
      }
    }
  });

  const dbStr = JSON.stringify(db.evaluations || {});
  const currentHash = crypto.createHash('md5').update(dbStr).digest('hex');

  const excelPath = path.join(EXPORTS_DIR, MASTER_FILE_NAME);
  const evaluations = Object.values(db.evaluations || {}) as any[];

  // Réutilisation du fichier Excel pré-généré si les données n'ont pas changé
  if (cachedStateHash === currentHash && fs.existsSync(excelPath)) {
    return {
      success: true,
      fileName: MASTER_FILE_NAME,
      localMasterPath: excelPath,
      downloadUrl: `/api/download-excel`,
      count: evaluations.length
    };
  }

  if (!fs.existsSync(EXPORTS_DIR)) {
    fs.mkdirSync(EXPORTS_DIR, { recursive: true });
  }

  const todayStr = new Date().toLocaleDateString("fr-CA");

  // 1. Inventaire Global (100% de tous les modèles évalués)
  const allModelsData = evaluations.map(ev => {
    const prices = ev.listings ? ev.listings.filter((l: any) => l.included).map((l: any) => l.price) : [];
    const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
    const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
    const avgPrice = prices.length > 0 ? Math.round(prices.reduce((a: number, b: number) => a + b, 0) / prices.length) : 0;
    const urlsStr = ev.listings ? ev.listings.filter((l: any) => l.included).slice(0, 5).map((l: any) => l.url).join(" | ") : "";
    const brand = getBrand(ev.modelName, ev.category);
    const dateAnalyse = ev.lastScraped ? new Date(ev.lastScraped).toLocaleDateString("fr-CA") : todayStr;

    return {
      "Date analyse": dateAnalyse,
      "Marque": brand,
      "Modèle": ev.modelName,
      "Catégorie": ev.category,
      "Configuration": ev.configuration || "Intel Core i5, 16 Go, 256 Go SSD",
      "Condition": ev.condition || "Très bon",
      "Nombre comparables": ev.comparablesCount || (ev.listings ? ev.listings.length : 0),
      "Prix minimum (CAD)": minPrice || 0,
      "Prix médian (CAD)": ev.medianPrice || 0,
      "Prix moyen (CAD)": avgPrice || 0,
      "Prix maximum (CAD)": maxPrice || 0,
      "Valeur recommandée (CAD)": ev.medianPrice || 0,
      "Niveau confiance": ev.confidence || "Moyen",
      "Source principale": ev.listings && ev.listings.length > 0 ? ev.listings[0].source : "eBay / Back Market",
      "URLs principales": urlsStr,
      "Commentaires": ev.commentaires || ""
    };
  }).sort((a, b) => {
    const catCompare = a["Catégorie"].localeCompare(b["Catégorie"]);
    if (catCompare !== 0) return catCompare;
    return a["Modèle"].localeCompare(b["Modèle"]);
  });

  // Filtres par famille de matériel
  const filterByKeywords = (keywords: string[]) => {
    return allModelsData.filter(m => {
      const cLower = m["Catégorie"].toLowerCase();
      return keywords.some(k => cLower.includes(k));
    });
  };

  const laptopsData = filterByKeywords(["portable", "laptop", "macbook"]);
  const desktopsData = filterByKeywords(["desktop", "bureau", "mini pc", "thinkcentre", "optiplex", "desk"]);
  const iphoneData = filterByKeywords(["iphone", "mobile", "smartphone"]);
  const otherData = allModelsData.filter(m =>
    !laptopsData.includes(m) && !desktopsData.includes(m) && !iphoneData.includes(m)
  );

  // 2. Comparables Détaillés
  const allComparablesRows: any[] = [];
  evaluations.forEach(ev => {
    if (ev.listings && Array.isArray(ev.listings)) {
      ev.listings.forEach((l: any) => {
        allComparablesRows.push({
          "Modèle": ev.modelName,
          "Catégorie": ev.category,
          "Source": l.source,
          "Titre de l'annonce": l.title,
          "Prix final (CAD)": l.price,
          "Prix d'origine (CAD)": l.originalPrice || l.price,
          "Rabais ($)": l.discountAmount || 0,
          "Rabais (%)": l.discountPercent ? `${l.discountPercent}%` : "0%",
          "Devise source": l.currency || "CAD",
          "Taux de change": l.exchangeRate || 1.0,
          "Type de vente": l.saleType || "Achat immédiat",
          "Date relevée": l.date || ev.lastScraped || todayStr,
          "Inclus (Calcul Médiane)": l.included ? "Oui" : "Non",
          "Anomalie (Outlier)": l.isOutlier ? "Oui" : "Non",
          "Spécifications": l.specs ? (typeof l.specs === "object" ? Object.values(l.specs).filter(Boolean).join(", ") : String(l.specs)) : "",
          "URL de l'offre": l.url
        });
      });
    }
  });

  // 3. Historique complet des Prix par modèle
  const priceHistoryRows: any[] = [];
  evaluations.forEach(ev => {
    if (ev.historicalPrices && Array.isArray(ev.historicalPrices)) {
      ev.historicalPrices.forEach((hp: any) => {
        priceHistoryRows.push({
          "Date": hp.date,
          "Catégorie": ev.category,
          "Modèle": ev.modelName,
          "Prix Médian (CAD)": hp.price,
          "Niveau Confiance": hp.confidence || "Moyen"
        });
      });
    }
  });
  priceHistoryRows.sort((a, b) => new Date(a["Date"]).getTime() - new Date(b["Date"]).getTime());

  // 4. Journal d'Audit global
  const historicalLog = db.historicalLog || [];
  const historicalRows = historicalLog.map((log: any) => ({
    "Date / Heure": new Date(log.date).toLocaleString("fr-CA"),
    "Modèle informatique": log.model,
    "Type d'Action": log.action,
    "Ancien Prix Médian (CAD)": log.previousPrice,
    "Nouveau Prix Médian (CAD)": log.currentPrice,
    "Variation constatée (CAD)": log.currentPrice - log.previousPrice,
    "Opérateur d'Étude": log.operator
  }));

  // 5. Écarts Marché
  const varianceRows = evaluations.map(ev => {
    const prevPrice = ev.historicalPrices && ev.historicalPrices.length > 0 ? ev.historicalPrices[ev.historicalPrices.length - 1].price : ev.medianPrice;
    const diff = ev.medianPrice - prevPrice;
    const pct = prevPrice > 0 ? ((diff / prevPrice) * 100).toFixed(1) : "0.0";
    const trend = diff > 0 ? "Hausse" : (diff < 0 ? "Baisse" : "Stable");
    return {
      "Modèle d'équipement": ev.modelName,
      "Catégorie": ev.category,
      "Prix Médian Précédent (CAD)": prevPrice,
      "Prix Actuel Observé (CAD)": ev.medianPrice,
      "Écart absolu (CAD)": diff,
      "Écart relatif (%)": `${pct} %`,
      "Tendance du Marché": trend
    };
  });

  // 6. Modèles Personnalisés
  const customModels = db.customModels || [];
  const customModelsRows = customModels.map((cm: any) => ({
    "Modèle": cm.modelName,
    "Catégorie": normalizeCategory(cm.category),
    "Date d'ajout": cm.addedAt || todayStr,
    "Configuration": cm.configuration || (db.evaluations[cm.modelName]?.configuration || "")
  }));

  // 7. Lots GCSurplus (si présents)
  const gcsurplusLots = db.gcsurplusLots || [];
  const gcsurplusRows = gcsurplusLots.map((lot: any) => ({
    "Numéro de lot": lot.lotNumber,
    "Titre": lot.title,
    "Date de clôture": lot.closingDate,
    "Mise actuelle (CAD)": lot.currentBid,
    "Quantité": lot.quantity,
    "Prix unitaire (CAD)": lot.unitPrice,
    "Statut": lot.status,
    "Emplacement": lot.location,
    "URL": lot.url,
    "Commentaires": lot.comments
  }));

  // 8. Métadonnées Système
  const metadataRows = [
    { "Propriété": "Date d'exportation", "Valeur": new Date().toISOString() },
    { "Propriété": "Date lisible", "Valeur": new Date().toLocaleString("fr-CA") },
    { "Propriété": "Application", "Valeur": "Évaluateur de Prix Insertech - Version Autonome" },
    { "Propriété": "Format de sauvegarde", "Valeur": "Excel Exhaustif (.xlsx)" },
    { "Propriété": "Total des modèles évalués", "Valeur": evaluations.length },
    { "Propriété": "Total des annonces comparables brutes", "Valeur": allComparablesRows.length },
    { "Propriété": "Total des relevés d'historique de prix", "Valeur": priceHistoryRows.length },
    { "Propriété": "Total des entrées de journal d'audit", "Valeur": historicalRows.length },
    { "Propriété": "Total des modèles sur mesure", "Valeur": customModelsRows.length },
    { "Propriété": "Empreinte d'intégrité (Hash)", "Valeur": currentHash }
  ];

  const wb = XLSX.utils.book_new();

  const emptyModelRow = [{
    "Date analyse": todayStr,
    "Marque": "",
    "Modèle": "Aucun modèle",
    "Catégorie": "",
    "Configuration": "",
    "Condition": "",
    "Nombre comparables": 0,
    "Prix minimum (CAD)": 0,
    "Prix médian (CAD)": 0,
    "Prix moyen (CAD)": 0,
    "Prix maximum (CAD)": 0,
    "Valeur recommandée (CAD)": 0,
    "Niveau confiance": "Aucun",
    "Source principale": "",
    "URLs principales": "",
    "Commentaires": ""
  }];

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(allModelsData.length > 0 ? allModelsData : emptyModelRow),
    "Inventaire Global"
  );
  if (laptopsData.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(laptopsData), "Portables");
  if (desktopsData.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(desktopsData), "Bureau");
  if (iphoneData.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(iphoneData), "iPhones");
  if (otherData.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(otherData), "Autres Catégories");

  if (allComparablesRows.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(allComparablesRows), "Comparables Détaillés");
  if (priceHistoryRows.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(priceHistoryRows), "Historique des Prix");
  if (historicalRows.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(historicalRows), "Journal d'Audit");
  if (varianceRows.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(varianceRows), "Écarts Marché");
  if (customModelsRows.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(customModelsRows), "Modèles Personnalisés");
  if (gcsurplusRows.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(gcsurplusRows), "Lots GCSurplus");

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(metadataRows), "Métadonnées");

  XLSX.writeFile(wb, excelPath);
  setCachedStateHash(currentHash);

  return {
    success: true,
    fileName: MASTER_FILE_NAME,
    localMasterPath: excelPath,
    downloadUrl: `/api/download-excel`,
    count: evaluations.length,
    comparablesCount: allComparablesRows.length,
    historyCount: priceHistoryRows.length
  };
}

export function generateTemplateExcel(): Buffer {
  const templateWb = XLSX.utils.book_new();
  const sampleRows = [
    {
      "Date analyse": new Date().toLocaleDateString("fr-CA"),
      "Marque": "Lenovo",
      "Modèle": "ThinkPad T14 Gen 2",
      "Catégorie": "Portables Lenovo",
      "Configuration": "Intel Core i5-1135G7, 16 Go RAM, 512 Go SSD",
      "Condition": "Très bon",
      "Nombre comparables": 15,
      "Prix minimum (CAD)": 380,
      "Prix médian (CAD)": 450,
      "Prix moyen (CAD)": 455,
      "Prix maximum (CAD)": 520,
      "Valeur recommandée (CAD)": 450,
      "Niveau confiance": "Élevé",
      "Source principale": "eBay / Back Market",
      "URLs principales": "https://www.ebay.ca | https://www.backmarket.ca",
      "Commentaires": "Exemple de ligne à personnaliser"
    },
    {
      "Date analyse": new Date().toLocaleDateString("fr-CA"),
      "Marque": "Dell",
      "Modèle": "OptiPlex 7070 Micro",
      "Catégorie": "Desktop Dell",
      "Configuration": "Intel Core i7-9700T, 16 Go RAM, 256 Go SSD",
      "Condition": "Très bon",
      "Nombre comparables": 12,
      "Prix minimum (CAD)": 280,
      "Prix médian (CAD)": 340,
      "Prix moyen (CAD)": 335,
      "Prix maximum (CAD)": 390,
      "Valeur recommandée (CAD)": 340,
      "Niveau confiance": "Élevé",
      "Source principale": "eBay",
      "URLs principales": "https://www.ebay.ca",
      "Commentaires": "Exemple de poste bureautique"
    }
  ];
  XLSX.utils.book_append_sheet(templateWb, XLSX.utils.json_to_sheet(sampleRows), "Inventaire Global");
  return XLSX.write(templateWb, { type: "buffer", bookType: "xlsx" });
}

export function processImportPreview(workbook: XLSX.WorkBook) {
  const sheetNames = workbook.SheetNames;
  const modelsFound = new Set<string>();
  let totalRows = 0;
  let hasComparables = false;
  let hasHistory = false;
  let hasAudit = false;
  let hasCustom = false;
  const sampleModels: { model: string; category: string; price: number }[] = [];

  sheetNames.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return;
    const rows = XLSX.utils.sheet_to_json(sheet) as any[];
    totalRows += rows.length;

    const lower = sheetName.toLowerCase();
    if (lower.includes("comparable") || lower.includes("listing")) hasComparables = true;
    if (lower.includes("historique") || lower.includes("history")) hasHistory = true;
    if (lower.includes("audit") || lower.includes("journal")) hasAudit = true;
    if (lower.includes("personnalisé") || lower.includes("personnalise") || lower.includes("custom")) hasCustom = true;

    rows.forEach(r => {
      const model = r["Modèle"] || r["Modele"] || r["Model"] || r["Modèle d'équipement"] || r["Modèle informatique"];
      if (model && typeof model === "string" && model.trim()) {
        const cleanModel = model.trim();
        if (!modelsFound.has(cleanModel)) {
          modelsFound.add(cleanModel);
          if (sampleModels.length < 5) {
            sampleModels.push({
              model: cleanModel,
              category: normalizeCategory(r["Catégorie"] || r["Categorie"] || "Portables Lenovo"),
              price: parseCADPrice(r["Prix médian (CAD)"] || r["Prix médian"] || r["Prix"] || 0)
            });
          }
        }
      }
    });
  });

  return {
    success: true,
    sheetNames,
    totalRows,
    modelsCount: modelsFound.size,
    hasComparables,
    hasHistory,
    hasAudit,
    hasCustom,
    sampleModels
  };
}

export async function executeImportExcel(workbook: XLSX.WorkBook) {
  // Sauvegarde de sécurité automatique
  createBackupBeforeImport();

  let resultStats: any = null;

  await withDBLock(async () => {
    const db = readDB();
    if (!db.evaluations) db.evaluations = {};
    if (!db.customModels) db.customModels = [];
    if (!db.historicalLog) db.historicalLog = [];
    if (!db.gcsurplusLots) db.gcsurplusLots = [];

    const importedModelsSet = new Set<string>();
    let importedComparablesCount = 0;
    let importedPricesCount = 0;
    let importedAuditCount = 0;
    let importedCustomCount = 0;
    let importedLotsCount = 0;

    const universalSheetName = workbook.SheetNames.find(s => {
      const l = s.toLowerCase();
      return l === "inventaire global" || l === "tous les modèles" || l === "tous les modeles" || l === "modèles à importer" || l === "modeles a importer";
    });

    const sheetsToProcessForModels = universalSheetName
      ? [universalSheetName]
      : workbook.SheetNames.filter(s => {
          const l = s.toLowerCase();
          return !l.includes("comparable") && !l.includes("historique") && !l.includes("audit") &&
                 !l.includes("écart") && !l.includes("ecart") && !l.includes("métadonnée") &&
                 !l.includes("metadonnee") && !l.includes("gcsurplus") && !l.includes("personnalisé") && !l.includes("personnalise");
        });

    sheetsToProcessForModels.forEach(sheetName => {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) return;

      const rows = XLSX.utils.sheet_to_json(sheet) as any[];
      const rowsByModel: Record<string, any[]> = {};
      rows.forEach(r => {
        const model = r["Modèle"] || r["Modele"] || r["Model"] || r["Modèle d'équipement"] || r["Modèle informatique"] || r["Modèle d'ordinateur"];
        if (model && typeof model === "string" && model.trim()) {
          const cleanModel = model.trim();
          if (!rowsByModel[cleanModel]) rowsByModel[cleanModel] = [];
          rowsByModel[cleanModel].push(r);
        }
      });

      Object.keys(rowsByModel).forEach(modelName => {
        const modelRows = rowsByModel[modelName];
        modelRows.sort((a, b) => {
          const dateA = parseExcelDate(a["Date analyse"] || a["Date"] || a["Date / Heure"]).getTime();
          const dateB = parseExcelDate(b["Date analyse"] || b["Date"] || b["Date / Heure"]).getTime();
          return dateB - dateA;
        });

        const latestRow = modelRows[0];
        const categoryName = normalizeCategory(latestRow["Catégorie"] || latestRow["Categorie"] || "Portables Lenovo");
        const medianPriceNum = parseCADPrice(latestRow["Prix médian (CAD)"] || latestRow["Prix médian"] || latestRow["Prix (CAD)"] || latestRow["Valeur recommandée (CAD)"] || latestRow["Prix"] || 0);

        const existingEval = (db.evaluations[modelName] || {}) as any;
        const listings = existingEval.listings || [];

        const historicalPricesFromRows: { date: string; price: number; confidence?: string }[] = [];
        modelRows.forEach(r => {
          const rawDate = r["Date analyse"] || r["Date"] || r["Date / Heure"];
          const parsedD = parseExcelDate(rawDate);
          const hpDate = parsedD.getTime() > 0 ? parsedD.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
          const p = parseCADPrice(r["Prix médian (CAD)"] || r["Prix médian"] || r["Prix"] || 0);
          if (p > 0) {
            historicalPricesFromRows.push({
              date: hpDate,
              price: p,
              confidence: r["Niveau confiance"] || r["Confiance"] || "Moyen"
            });
          }
        });

        const existingHP = existingEval.historicalPrices || [];
        const hpMap = new Map<string, { date: string; price: number; confidence?: string }>();
        existingHP.forEach((item: any) => hpMap.set(item.date, item));
        historicalPricesFromRows.forEach(item => hpMap.set(item.date, item));
        const mergedHP = Array.from(hpMap.values()).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        const comparablesCountVal = Number(latestRow["Nombre comparables"] || latestRow["Comparables"] || (listings ? listings.length : 0)) || 0;

        db.evaluations[modelName] = {
          modelName,
          category: categoryName,
          medianPrice: medianPriceNum,
          comparablesCount: comparablesCountVal,
          confidence: latestRow["Niveau confiance"] || latestRow["Confiance"] || "Moyen",
          lastScraped: latestRow["Date analyse"] ? parseExcelDate(latestRow["Date analyse"]).toISOString() : new Date().toISOString(),
          configuration: latestRow["Configuration"] || latestRow["Specs"] || "Spécifications d'origine",
          condition: latestRow["Condition"] || latestRow["État"] || "Très bon",
          commentaires: latestRow["Commentaires"] || latestRow["Notes"] || "",
          listings,
          historicalPrices: mergedHP
        };

        const isStandardModel = STANDARD_MODEL_NAMES.has(modelName.toLowerCase().trim());
        if (!isStandardModel) {
          const normCat = normalizeCategory(categoryName);
          const existsInCustom = db.customModels.some((cm: any) => cm.modelName.toLowerCase() === modelName.toLowerCase().trim());
          if (!existsInCustom) {
            db.customModels.push({
              category: normCat,
              modelName: modelName.trim(),
              addedAt: new Date().toISOString(),
              configuration: latestRow["Configuration"] || ""
            });
            importedCustomCount++;
          }
        }

        importedModelsSet.add(modelName.toLowerCase());
      });
    });

    // 2. Restauration des annonces comparables
    workbook.SheetNames.forEach(sheetName => {
      const lowerSheet = sheetName.toLowerCase();
      if (lowerSheet.includes("comparable") || lowerSheet.includes("listing")) {
        const sheet = workbook.Sheets[sheetName];
        if (sheet) {
          const rows = XLSX.utils.sheet_to_json(sheet) as any[];
          const listingsByModel: Record<string, any[]> = {};
          rows.forEach(r => {
            const model = r["Modèle"] || r["Modele"] || r["Model"];
            if (model && typeof model === "string" && model.trim()) {
              const cleanModel = model.trim();
              if (!listingsByModel[cleanModel]) listingsByModel[cleanModel] = [];

              const rawPrice = r["Prix final (CAD)"] || r["Prix (CAD)"] || r["Prix final"] || r["Prix"] || "0";
              const origPriceRaw = r["Prix d'origine (CAD)"] || r["Prix d'origine"] || r["Original Price"];
              const discountAmtRaw = r["Rabais ($)"] || r["Rabais"] || r["Discount"];
              const discountPctRaw = r["Rabais (%)"] || r["Discount %"];

              const price = parseCADPrice(rawPrice);
              const origPrice = origPriceRaw ? parseCADPrice(origPriceRaw) : undefined;
              const discountAmt = discountAmtRaw ? parseCADPrice(discountAmtRaw) : undefined;
              const discountPct = discountPctRaw ? parseFloat(String(discountPctRaw).replace("%", "").trim()) : undefined;

              const source = r["Source"] || "eBay";
              const title = r["Titre de l'annonce"] || r["Titre"] || `${cleanModel} - Offre marché`;
              const rawDate = r["Date relevée"] || r["Date"] || r["Date analyse"];
              const dateStr = rawDate ? (parseExcelDate(rawDate).getTime() > 0 ? parseExcelDate(rawDate).toISOString().slice(0, 10) : String(rawDate).slice(0, 10)) : new Date().toISOString().slice(0, 10);
              const url = r["URL de l'offre"] || r["URL"] || r["Url"] || "";
              const includedStr = String(r["Inclus (Calcul Médiane)"] || r["Inclus"] || "Oui").toLowerCase();
              const outlierStr = String(r["Anomalie (Outlier)"] || r["Anomalie"] || "Non").toLowerCase();
              const saleType = r["Type de vente"] || "Achat immédiat";
              const currency = r["Devise source"] || r["Devise d'origine"] || "CAD";
              const exchangeRate = r["Taux de change"] ? parseFloat(String(r["Taux de change"])) : 1.0;

              listingsByModel[cleanModel].push({
                id: `${cleanModel.toLowerCase().replace(/\s+/g, "-")}-cmp-${listingsByModel[cleanModel].length + 1}`,
                title,
                price,
                originalPrice: origPrice,
                discountAmount: discountAmt,
                discountPercent: discountPct,
                currency,
                exchangeRate,
                source,
                saleType,
                date: dateStr,
                url: url || getFunctionalUrl(source, title, cleanModel),
                included: includedStr !== "non" && includedStr !== "false" && includedStr !== "0",
                isOutlier: outlierStr === "oui" || outlierStr === "true" || outlierStr === "1",
                specs: r["Spécifications"] ? { cpu: String(r["Spécifications"]) } : undefined
              });
              importedComparablesCount++;
            }
          });

          const modelKeys = Object.keys(db.evaluations);
          Object.keys(listingsByModel).forEach(model => {
            const matchedKey = modelKeys.find(k => k.toLowerCase() === model.toLowerCase()) || model;
            if (db.evaluations[matchedKey] && listingsByModel[model].length > 0) {
              db.evaluations[matchedKey].listings = listingsByModel[model];
              db.evaluations[matchedKey].comparablesCount = listingsByModel[model].filter((l: any) => l.included && !l.isOutlier).length;
            }
          });
        }
      }
    });

    // 3. Restauration de l'historique complet des prix
    workbook.SheetNames.forEach(sheetName => {
      const lowerSheet = sheetName.toLowerCase();
      if (lowerSheet.includes("historique des prix") || lowerSheet.includes("historique_prix") || lowerSheet.includes("price history")) {
        const sheet = workbook.Sheets[sheetName];
        if (sheet) {
          const rows = XLSX.utils.sheet_to_json(sheet) as any[];
          const modelKeys = Object.keys(db.evaluations);
          rows.forEach(r => {
            const model = r["Modèle"] || r["Modele"] || r["Model"];
            if (model && typeof model === "string" && model.trim()) {
              const cleanModel = model.trim();
              const matchedKey = modelKeys.find(k => k.toLowerCase() === cleanModel.toLowerCase()) || cleanModel;
              if (db.evaluations[matchedKey]) {
                const rawDate = r["Date"] || r["Date / Heure"];
                const parsedD = parseExcelDate(rawDate);
                const hpDate = parsedD.getTime() > 0 ? parsedD.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
                const hpPrice = parseCADPrice(r["Prix Médian (CAD)"] || r["Prix Médian"] || r["Prix"]) || 0;
                const hpConf = r["Niveau Confiance"] || r["Confiance"] || "Moyen";
                if (!db.evaluations[matchedKey].historicalPrices) db.evaluations[matchedKey].historicalPrices = [];
                const exists = db.evaluations[matchedKey].historicalPrices.some((existing: any) => existing.date === hpDate);
                if (!exists && hpPrice > 0) {
                  db.evaluations[matchedKey].historicalPrices.push({ date: hpDate, price: hpPrice, confidence: hpConf });
                  importedPricesCount++;
                }
              }
            }
          });

          Object.keys(db.evaluations).forEach(k => {
            if (db.evaluations[k].historicalPrices) {
              db.evaluations[k].historicalPrices.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
            }
          });
        }
      }
    });

    // 4. Restauration des modèles personnalisés
    workbook.SheetNames.forEach(sheetName => {
      const lowerSheet = sheetName.toLowerCase();
      if (lowerSheet.includes("personnalisé") || lowerSheet.includes("personnalise") || lowerSheet.includes("custom")) {
        const sheet = workbook.Sheets[sheetName];
        if (sheet) {
          const rows = XLSX.utils.sheet_to_json(sheet) as any[];
          rows.forEach(r => {
            const model = r["Modèle"] || r["Modele"] || r["Model"];
            const rawCategory = r["Catégorie"] || r["Categorie"] || "Portables Lenovo";
            const category = normalizeCategory(rawCategory);
            const addedAt = r["Date d'ajout"] || r["Date"] || new Date().toISOString();
            const configuration = r["Configuration"] || r["Specs"] || "";

            if (model && typeof model === "string" && model.trim()) {
              const cleanModel = model.trim();
              const exists = db.customModels.some((cm: any) => cm.modelName.toLowerCase() === cleanModel.toLowerCase());
              if (!exists) {
                db.customModels.push({
                  category,
                  modelName: cleanModel,
                  addedAt,
                  configuration
                });
                importedCustomCount++;
              }

              if (!db.evaluations[cleanModel]) {
                db.evaluations[cleanModel] = {
                  modelName: cleanModel,
                  category,
                  medianPrice: 0,
                  confidence: "Aucun",
                  comparablesCount: 0,
                  lastScraped: "",
                  listings: [],
                  configuration: configuration || "Spécifications d'origine",
                  condition: "Très bon",
                  commentaires: "Modèle personnalisé restauré depuis l'import Excel.",
                  historicalPrices: []
                };
              } else {
                db.evaluations[cleanModel].category = category;
                if (configuration) db.evaluations[cleanModel].configuration = configuration;
              }
            }
          });
        }
      }
    });

    // 5. Restauration du journal d'audit
    workbook.SheetNames.forEach(sheetName => {
      const lowerSheet = sheetName.toLowerCase();
      if (lowerSheet.includes("journal") || lowerSheet.includes("audit") || lowerSheet.includes("historique") && !lowerSheet.includes("prix")) {
        const sheet = workbook.Sheets[sheetName];
        if (sheet) {
          const rows = XLSX.utils.sheet_to_json(sheet) as any[];
          rows.forEach((r, idx) => {
            const rawDate = r["Date / Heure"] || r["Date"] || new Date().toISOString();
            const dateStr = parseExcelDate(rawDate).toISOString();
            const model = r["Modèle informatique"] || r["Modèle"] || r["Modele"] || "Inconnu";
            const action = r["Type d'Action"] || r["Action"] || "Import Excel";
            const prevPrice = parseCADPrice(r["Ancien Prix Médian (CAD)"] || r["Ancien Prix"] || 0);
            const currPrice = parseCADPrice(r["Nouveau Prix Médian (CAD)"] || r["Nouveau Prix"] || 0);
            const operator = r["Opérateur d'Étude"] || r["Opérateur"] || "Système";

            const exists = db.historicalLog.some((l: any) => l.date === dateStr && l.model === model && l.action === action);
            if (!exists) {
              db.historicalLog.push({
                id: `audit-import-${Date.now()}-${idx}`,
                date: dateStr,
                model,
                action,
                previousPrice: prevPrice,
                currentPrice: currPrice,
                operator
              });
              importedAuditCount++;
            }
          });
          db.historicalLog.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
        }
      }
    });

    // 6. Restauration des lots GCSurplus
    workbook.SheetNames.forEach(sheetName => {
      const lowerSheet = sheetName.toLowerCase();
      if (lowerSheet.includes("gcsurplus") || lowerSheet.includes("lots")) {
        const sheet = workbook.Sheets[sheetName];
        if (sheet) {
          const rows = XLSX.utils.sheet_to_json(sheet) as any[];
          rows.forEach(r => {
            const lotNumber = r["Numéro de lot"] || r["Lot Number"] || r["Lot"];
            if (lotNumber) {
              const exists = db.gcsurplusLots.some((l: any) => l.lotNumber === lotNumber);
              if (!exists) {
                db.gcsurplusLots.push({
                  id: `gcsurplus-${lotNumber}`,
                  lotNumber,
                  title: r["Titre"] || r["Title"] || "",
                  closingDate: r["Date de clôture"] || r["Closing Date"] || "",
                  currentBid: parseCADPrice(r["Mise actuelle (CAD)"] || r["Current Bid"] || 0),
                  quantity: parseInt(r["Quantité"] || r["Quantity"] || "1", 10) || 1,
                  unitPrice: parseCADPrice(r["Prix unitaire (CAD)"] || r["Unit Price"] || 0),
                  status: r["Statut"] || r["Status"] || "Fermé",
                  location: r["Emplacement"] || r["Location"] || "",
                  url: r["URL"] || "",
                  authorized: true,
                  comments: r["Commentaires"] || r["Comments"] || ""
                });
                importedLotsCount++;
              }
            }
          });
        }
      }
    });

    writeDB(db);

    resultStats = {
      importedModelsCount: importedModelsSet.size,
      importedComparablesCount,
      importedPricesCount,
      importedAuditCount,
      importedCustomCount,
      importedLotsCount,
      totalModelsInDb: Object.keys(db.evaluations).length
    };
  });

  return resultStats;
}
