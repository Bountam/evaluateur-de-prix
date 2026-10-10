import { Router } from "express";
import { sqliteDb } from "../database/connection.ts";
import { readDB, writeDB } from "../database/repository.ts";
import { getCredentials, saveCredentials } from "../../scrapers/credentials.ts";
import { checkApplicationUpdate, performApplicationUpdate, UpdateValidationError } from "../services/update.service.ts";
import { checkSelectorsHealth, healSelectors } from "../services/healing.service.ts";
import { APP_VERSION } from "../config/version.ts";

const router = Router();
const GITHUB_REPO = process.env.GITHUB_REPO || "Bountam/evaluateur-de-prix";

// État de santé du serveur et utilisation mémoire
router.get("/api/health", (_req, res) => {
  const memory = process.memoryUsage();
  res.json({
    success: true,
    status: "UP",
    timestamp: new Date().toISOString(),
    memory: {
      rss: Math.round(memory.rss / 1024 / 1024) + " MB",
      heapTotal: Math.round(memory.heapTotal / 1024 / 1024) + " MB",
      heapUsed: Math.round(memory.heapUsed / 1024 / 1024) + " MB"
    },
    dbStatus: sqliteDb ? "Connected" : "Disconnected"
  });
});

// Version applicative
router.get("/api/version", (_req, res) => {
  res.json({
    success: true,
    version: APP_VERSION,
    channel: "Stable",
    releaseDate: "2026-10-10",
    name: "Évaluateur de Prix Insertech"
  });
});

// Vérification de mise à jour sur GitHub
router.get("/api/check-update", async (_req, res) => {
  const result = await checkApplicationUpdate(APP_VERSION, GITHUB_REPO);
  res.json(result);
});

// Exécution de mise à jour automatique
router.post("/api/perform-update", async (req, res) => {
  const { downloadUrl, sha256 } = req.body || {};
  if (!downloadUrl) {
    res.status(400).json({ success: false, error: "URL de téléchargement requise." });
    return;
  }

  try {
    const result = await performApplicationUpdate(downloadUrl, {
      repo: GITHUB_REPO,
      expectedSha256: typeof sha256 === "string" ? sha256 : undefined
    });
    res.json(result);
  } catch (err: any) {
    if (err instanceof UpdateValidationError) {
      res.status(400).json({
        success: false,
        error: err.message
      });
      return;
    }
    console.error("❌ Erreur lors de l'application de la mise à jour:", err);
    res.status(500).json({
      success: false,
      error: `Erreur d'installation de la mise à jour: ${err.message}`
    });
  }
});

// Obtenir les identifiants / clés d'API configurés
router.get("/api/credentials", (_req, res) => {
  const creds = getCredentials();
  res.json({ success: true, credentials: creds });
});

// Sauvegarder les identifiants / clés d'API
router.post("/api/credentials", (req, res) => {
  const creds = saveCredentials(req.body.credentials || {});
  res.json({ success: true, credentials: creds });
});

// Sauvegarder les sélecteurs CSS
router.post("/api/selectors", (req, res) => {
  const db = readDB();
  db.selectors = req.body.selectors;
  writeDB(db);
  res.json({ success: true, selectors: db.selectors });
});

// Diagnostic de santé des sélecteurs CSS
router.post("/api/selectors/health-check", async (req, res) => {
  const site = req.body.site as "eBay" | "backMarket";
  const status = checkSelectorsHealth(site);
  res.json({ success: true, status });
});

// Auto-réparation des sélecteurs CSS
router.post("/api/selectors/heal", async (req, res) => {
  const site = req.body.site as "eBay" | "backMarket";
  const result = healSelectors(site);
  res.json({ success: true, ...result });
});

export default router;
