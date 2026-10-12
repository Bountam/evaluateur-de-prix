import { Router } from "express";
import { readDB, writeDB, withDBLock, invalidateStateCache } from "../database/repository.ts";
import { seedDatabase } from "../database/seed.ts";
import { normalizeCategory } from "../../src/modelsData.ts";
import { getModelMeta } from "../config/index.ts";
import { clearAllCache } from "../../scrapers/cache.ts";

const router = Router();

// État complet de l'application
router.get("/api/state", (_req, res) => {
  const db = readDB();
  if (!db.customModels) db.customModels = [];
  res.json(db);
});

// Ajout dynamique d'un nouveau modèle avec garantie zéro-perte
router.post("/api/models/add", async (req, res) => {
  const { category, modelName, configuration } = req.body;
  if (!category || !modelName || !modelName.trim()) {
    res.status(400).json({ success: false, message: "La catégorie et le nom du modèle sont obligatoires." });
    return;
  }

  const cleanModel = modelName.trim();
  const lowerModel = cleanModel.toLowerCase();
  if (lowerModel === "__proto__" || lowerModel === "constructor" || lowerModel === "prototype") {
    res.status(400).json({ success: false, message: "Nom de modèle non autorisé." });
    return;
  }
  const normalizedCategory = normalizeCategory(category);
  let dbResult: any = null;

  await withDBLock(async () => {
    const db = readDB();
    if (!db.customModels) db.customModels = [];
    if (!db.evaluations) db.evaluations = {};

    const existingCustom = db.customModels.find((m: any) => m.modelName.toLowerCase() === cleanModel.toLowerCase());
    if (!existingCustom) {
      db.customModels.push({
        category: normalizedCategory,
        modelName: cleanModel,
        configuration: configuration || "",
        addedAt: new Date().toISOString()
      });
    } else {
      existingCustom.category = normalizedCategory;
      if (configuration) existingCustom.configuration = configuration;
    }

    if (!db.evaluations[cleanModel]) {
      db.evaluations[cleanModel] = {
        modelName: cleanModel,
        category: normalizedCategory,
        medianPrice: 0,
        confidence: "Aucun",
        comparablesCount: 0,
        lastScraped: "",
        listings: [],
        configuration: configuration || "Spécifications standard à valider",
        condition: "Très bon",
        commentaires: `Modèle ajouté dynamiquement à la catégorie ${normalizedCategory}. Prêt pour la collecte.`,
        historicalPrices: []
      };
    } else {
      db.evaluations[cleanModel].category = normalizedCategory;
      if (configuration) db.evaluations[cleanModel].configuration = configuration;
    }

    writeDB(db);
    invalidateStateCache();
    dbResult = db;
  });

  res.json({
    success: true,
    customModels: dbResult.customModels,
    evaluations: dbResult.evaluations,
    evaluation: dbResult.evaluations[cleanModel]
  });
});

// Réinitialisation de la base de données
router.post("/api/reset", async (_req, res) => {
  let db: any;
  await withDBLock(async () => {
    db = seedDatabase();
    writeDB(db);
  });
  try {
    clearAllCache();
  } catch (e) {
    console.warn("Could not clear cache folder:", e);
  }
  invalidateStateCache();
  res.json({ success: true, db });
});

// Purge complète de toutes les évaluations et logs
router.post("/api/purge-all", async (_req, res) => {
  let dbResult: any = null;
  await withDBLock(async () => {
    const db = readDB();
    if (db.evaluations) {
      Object.keys(db.evaluations).forEach(key => {
        const meta = getModelMeta(key);
        db.evaluations[key] = {
          modelName: key,
          category: db.evaluations[key].category || "Autre",
          medianPrice: 0,
          confidence: "Aucun",
          comparablesCount: 0,
          lastScraped: "",
          listings: [],
          configuration: db.evaluations[key].configuration || meta.configuration,
          condition: db.evaluations[key].condition || meta.condition,
          commentaires: db.evaluations[key].commentaires || meta.commentaires,
          historicalPrices: []
        };
      });
    }

    db.historicalLog = [];
    writeDB(db);
    invalidateStateCache();
    dbResult = db;
  });

  try {
    clearAllCache();
  } catch (err) {
    console.warn("Could not clear cache folder:", err);
  }

  res.json({
    success: true,
    message: "Toutes les évaluations et l'historique ont été purgés avec succès.",
    evaluations: dbResult.evaluations,
    historicalLog: dbResult.historicalLog
  });
});

export default router;
