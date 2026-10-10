import { Router } from "express";
import { readDB, writeDB } from "../database/repository.ts";
import { getModelMeta } from "../config/index.ts";
import { intensiveLimiter } from "../middlewares/rateLimiters.ts";
import { runBackgroundScraping, getActiveJob } from "../services/scraper.service.ts";
import { clearCacheForModel, clearCacheForSource } from "../../scrapers/cache.ts";
import { calculateMedian, determineConfidence } from "../../scrapers/orchestrator.ts";

const router = Router();

// Démarrer une collecte multi-sources en arrière-plan
router.post("/api/scrape", intensiveLimiter, (req, res) => {
  const { model, category, simulateFailure, operator, concurrency } = req.body;

  const db = readDB();
  // Purger l'évaluation du modèle en cours de rafraîchissement
  if (db.evaluations && db.evaluations[model]) {
    const _meta = getModelMeta(model);
    db.evaluations[model] = {
      ...db.evaluations[model],
      medianPrice: 0,
      confidence: "Aucun",
      comparablesCount: 0,
      lastScraped: "",
      listings: []
    };
  }

  writeDB(db);

  runBackgroundScraping(
    model,
    category || "Autre",
    !!simulateFailure,
    operator || "Automatisé",
    concurrency ? Number(concurrency) : undefined
  );

  res.json({
    success: true,
    message: "Scraping job started successfully. Model data purged for refreshing.",
    model
  });
});

// État en direct de la collecte pour un modèle
router.get("/api/scrape/status", (req, res) => {
  const model = req.query.model as string;
  if (!model) {
    res.status(400).json({ success: false, message: "Model parameter is required" });
    return;
  }

  const job = getActiveJob(model);
  const db = readDB();
  const evaluation = db.evaluations ? db.evaluations[model] : null;

  if (!job) {
    if (evaluation) {
      res.json({
        success: true,
        progress: 100,
        status: "completed",
        logs: [`[${new Date().toLocaleTimeString('fr-CA')}] ✔️ Chargement des données historiques de l'évaluation locale.`],
        listings: evaluation.listings,
        evaluation
      });
      return;
    }
    res.status(404).json({ success: false, message: "No active or saved job found for this model" });
    return;
  }

  res.json({
    success: true,
    progress: job.progress,
    status: job.status,
    logs: job.logs,
    listings: job.listings,
    error: job.error,
    evaluation: job.status === "completed" ? evaluation : null
  });
});

// Mise à jour manuelle d'une annonce (inclusion/exclusion ou ajustement de prix)
router.post("/api/evaluations/update-listing", (req, res) => {
  const { modelName, listingId, included, price, operator } = req.body;
  const db = readDB();

  if (db.evaluations && db.evaluations[modelName]) {
    const evaluation = db.evaluations[modelName];
    const previousPrice = evaluation.medianPrice;
    const listing = evaluation.listings.find((l: any) => l.id === listingId);

    if (listing) {
      if (included !== undefined) listing.included = included;
      if (price !== undefined) listing.price = Number(price);

      // Recalcul en temps réel de la médiane et de l'indice de confiance
      const median = calculateMedian(evaluation.listings as any);
      evaluation.medianPrice = median;
      evaluation.comparablesCount = evaluation.listings.filter((l: any) => l.included && !l.isOutlier).length;
      const activeSourcesCount = new Set(
        evaluation.listings.filter((l: any) => l.included && !l.isOutlier).map((l: any) => l.sourceKey || l.source)
      ).size;
      evaluation.confidence = determineConfidence(evaluation.listings as any, Math.max(2, activeSourcesCount));

      if (previousPrice !== median) {
        if (!db.historicalLog) db.historicalLog = [];
        db.historicalLog.unshift({
          id: `log-manual-${Date.now()}`,
          date: new Date().toISOString(),
          model: modelName,
          action: "Ajustement manuel comparables",
          previousPrice,
          currentPrice: median,
          operator: operator || "Inconnu"
        });

        const historicalPrices = evaluation.historicalPrices || [];
        const lastHist = historicalPrices[historicalPrices.length - 1];
        if (!lastHist || lastHist.price !== previousPrice) {
          historicalPrices.push({
            date: evaluation.lastScraped || new Date().toISOString(),
            price: previousPrice
          });
        }
        evaluation.historicalPrices = historicalPrices;
      }

      writeDB(db);
      res.json({ success: true, evaluation });
      return;
    }
  }

  res.status(404).json({ success: false, message: "Modèle ou comparable introuvable." });
});

// Mise à jour des métadonnées d'une évaluation (configuration, condition, commentaires)
router.post("/api/evaluations/update-meta", (req, res) => {
  const { modelName, configuration, condition, commentaires, operator } = req.body;
  const db = readDB();

  if (db.evaluations && db.evaluations[modelName]) {
    const evaluation = db.evaluations[modelName];
    if (configuration !== undefined) evaluation.configuration = configuration;
    if (condition !== undefined) evaluation.condition = condition;
    if (commentaires !== undefined) evaluation.commentaires = commentaires;

    if (!db.historicalLog) db.historicalLog = [];
    db.historicalLog.unshift({
      id: `log-meta-${Date.now()}`,
      date: new Date().toISOString(),
      model: modelName,
      action: "Mise à jour spécifications",
      previousPrice: evaluation.medianPrice,
      currentPrice: evaluation.medianPrice,
      operator: operator || "Inconnu"
    });

    writeDB(db);
    res.json({ success: true, evaluation });
    return;
  }

  res.status(404).json({ success: false, message: "Modèle introuvable." });
});

// Purger le cache d'un modèle spécifique
router.post("/api/cache/purge-model", (req, res) => {
  const { model } = req.body;
  if (!model) {
    res.status(400).json({ success: false, message: "Nom de modèle requis." });
    return;
  }
  clearCacheForModel(model);
  res.json({ success: true, message: `Cache purgé pour le modèle "${model}".` });
});

// Purger le cache d'une source spécifique
router.post("/api/cache/purge-source", (req, res) => {
  const { sourceKey } = req.body;
  if (!sourceKey) {
    res.status(400).json({ success: false, message: "Clé de source requise." });
    return;
  }
  clearCacheForSource(sourceKey);
  res.json({ success: true, message: `Cache purgé pour la source "${sourceKey}".` });
});

export default router;
