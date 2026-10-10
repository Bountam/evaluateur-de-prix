import type { ModelEvaluation } from "../../src/types.ts";
import { orchestrateScraping } from "../../scrapers/orchestrator.ts";
import { readDB, writeDB, withDBLock } from "../database/repository.ts";
import { getModelMeta } from "../config/index.ts";

export interface ScrapingJob {
  model: string;
  category: string;
  progress: number;
  status: "running" | "completed" | "failed";
  logs: string[];
  listings: any[];
  error?: string;
  completedAt?: number;
}

export const activeJobs: Record<string, ScrapingJob> = {};

// Routine de nettoyage des jobs de scraping expirés (après 30 minutes)
setInterval(() => {
  const now = Date.now();
  const EXPIRATION_MS = 30 * 60 * 1000;
  for (const [key, job] of Object.entries(activeJobs)) {
    if (job.completedAt && (now - job.completedAt > EXPIRATION_MS)) {
      delete activeJobs[key];
    }
  }
}, 5 * 60 * 1000);

export function getActiveJob(model: string): ScrapingJob | undefined {
  return activeJobs[model];
}

export function runBackgroundScraping(
  model: string,
  category: string,
  _simulateFailure: boolean,
  operator: string,
  concurrency?: number
) {
  const jobKey = model;
  activeJobs[jobKey] = {
    model,
    category,
    progress: 0,
    status: "running",
    logs: [],
    listings: []
  };

  const job = activeJobs[jobKey];
  const log = (msg: string) => {
    const timestamp = `[${new Date().toLocaleTimeString('fr-CA')}]`;
    job.logs.push(`${timestamp} ${msg}`);
  };

  log(`🚀 Ingestion multi-sources démarrée en arrière-plan pour le modèle : "${model}" (${category})`);

  (async () => {
    try {
      job.progress = 10;
      log("🌐 Initialisation du moteur d'orchestration multi-sources...");

      const result = await orchestrateScraping(
        model,
        category || "Autre",
        log,
        (_res, completedCount, totalSources) => {
          job.progress = Math.min(90, 10 + Math.round((completedCount / totalSources) * 80));
        },
        concurrency
      );

      job.progress = 90;
      job.listings = result.allListings;
      log(`📊 Synthèse de collecte : ${result.totalListings} annonces valides extraites depuis ${result.successfulSources}/${result.totalSources} sources.`);

      job.progress = 95;

      await withDBLock(async () => {
        const db = readDB();
        if (!db.evaluations) db.evaluations = {};

        const existing = (db.evaluations[model] || {}) as Partial<ModelEvaluation>;
        const previousPrice = existing.medianPrice || 0;
        const historicalPrices = existing.historicalPrices || [];

        if (previousPrice > 0 && previousPrice !== result.medianPrice) {
          const lastHist = historicalPrices[historicalPrices.length - 1];
          if (!lastHist || lastHist.price !== previousPrice) {
            historicalPrices.push({
              date: existing.lastScraped || new Date().toISOString(),
              price: previousPrice
            });
          }
        }

        const meta = getModelMeta(model);

        db.evaluations[model] = {
          modelName: model,
          category: category || existing.category || "Autre",
          medianPrice: result.medianPrice,
          confidence: result.confidence,
          comparablesCount: result.totalListings,
          lastScraped: result.timestamp,
          listings: result.allListings,
          configuration: existing.configuration || meta.configuration,
          condition: existing.condition || meta.condition,
          commentaires: existing.commentaires || "Évaluation multi-sources consolidée (Résilience Zéro-Échec).",
          historicalPrices
        };

        // Mettre à jour les compteurs des sources et leur statut dans la base
        if (db.sources && Array.isArray(db.sources)) {
          result.sourceResults.forEach(sr => {
            const srcObj = db.sources.find((s: any) => s.sourceKey === sr.sourceKey || s.name === sr.source);
            if (srcObj) {
              srcObj.lastScraped = result.timestamp;
              srcObj.listingsCount = sr.count;
              srcObj.scrapeMethod = (sr.method === 'json-embedded' ? 'api' : sr.method) as any;
            }
          });
        }

        if (!db.historicalLog) db.historicalLog = [];
        db.historicalLog.unshift({
          id: `log-scraped-${Date.now()}`,
          date: new Date().toISOString(),
          model,
          action: "Collecte multi-sources",
          previousPrice: previousPrice || result.medianPrice,
          currentPrice: result.medianPrice,
          operator: operator
        });

        writeDB(db);
      });

      job.progress = 100;
      job.status = "completed";
      job.completedAt = Date.now();
      log("✔️ Traitement d'évaluation multi-sources complété avec succès. Grand livre local à jour.");

    } catch (err: any) {
      console.error("Scraping background error:", err);
      job.status = "failed";
      job.completedAt = Date.now();
      job.error = err.message || "Erreur interne de collecte";
      log(`❌ Échec de la collecte : ${job.error}`);
    }
  })();
}
