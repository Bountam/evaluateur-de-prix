import express from "express";
import path from "path";
import fs from "fs";
import os from "os";
import { exec } from "child_process";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import { PORT, HOST, EXPORTS_DIR, PID_FILE, PORT_FILE, logger } from "./config/index.ts";
import { apiLimiter } from "./middlewares/rateLimiters.ts";
import { errorHandler } from "./middlewares/errorHandler.ts";
import { setupGracefulShutdown, getIsShuttingDown } from "./services/lifecycle.service.ts";
import { cleanupObsoleteArtifacts } from "./services/update.service.ts";
import apiRouter from "./routes/index.ts";

export async function createApp() {
  // Nettoyage automatique des vieux artefacts obsolètes de mises à jour antérieures
  try {
    const cleaned = cleanupObsoleteArtifacts();
    if (cleaned.removedAssets.length > 0 || cleaned.removedOldExecutables.length > 0 || cleaned.removedTempFiles.length > 0) {
      logger.info(`[Cleanup] Nettoyage au démarrage : ${cleaned.removedAssets.length} actif(s) JS/CSS obsolète(s), ${cleaned.removedOldExecutables.length} ancien(s) .exe, ${cleaned.removedTempFiles.length} fichier(s) temporaire(s).`);
    }
  } catch (err: any) {
    logger.warn(`[Cleanup] Avertissement lors du nettoyage : ${err?.message || err}`);
  }

  const app = express();

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(compression());

  app.use(morgan("combined", { stream: { write: (message) => logger.info(message.trim()) } }));

  // Rejeter les requêtes entrantes avec 503 si l'arrêt gracieux est enclenché
  app.use((_req, res, next) => {
    if (getIsShuttingDown()) {
      res.setHeader("Connection", "close");
      res.status(503).send("Serveur en cours d'arrêt.");
      return;
    }
    next();
  });

  app.use("/api/", apiLimiter);

  app.use(express.json({ limit: "20mb" }));
  app.use(express.urlencoded({ limit: "20mb", extended: true }));

  // Support CORS sécurisé (mode développement & file:// local)
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (!origin || origin === "null" || origin.startsWith("file://") || origin.includes("localhost") || origin.includes("127.0.0.1")) {
      res.setHeader("Access-Control-Allow-Origin", origin || "*");
    } else {
      res.setHeader("Access-Control-Allow-Origin", origin);
    }
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });

  // Intercepter les requêtes de polices/assets manquants pour retourner un 404 propre au lieu d'index.html
  app.use((req, res, next) => {
    if (req.path.match(/\.(woff2?|ttf|otf|eot|ico|map)$/i)) {
      res.status(404).send("Font/Asset Not Found");
      return;
    }
    next();
  });

  // Désactivation stricte de tout cache navigateur pour garantir un affichage 100% à jour (Zéro Ctrl+F5)
  app.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Surrogate-Control", "no-store");
    next();
  });

  // Monter les routes API
  app.use(apiRouter);

  // Servir les exports générés
  app.use("/exports", express.static(EXPORTS_DIR));

  // Mode Dev (Vite middleware) vs Mode Production (fichiers statiques dist/)
  if (process.env.NODE_ENV !== "production") {
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: {
          middlewareMode: true,
          watch: {
            ignored: [
              '**/data/**',
              '**/data/database.sqlite**',
              '**/db.json**',
              '**/logs/**',
              '**/exports/**'
            ]
          }
        },
        appType: "spa"
      });
      app.use(vite.middlewares);
    } catch {
      // Si vite ne peut pas démarrer en middleware, continuer
    }
  } else {
    const distClientPath = path.join(process.cwd(), "dist");
    const publicPath = path.join(process.cwd(), "public");
    if (fs.existsSync(publicPath)) {
      app.use(express.static(publicPath, { etag: false, lastModified: false, maxAge: 0 }));
    }
    if (fs.existsSync(distClientPath)) {
      app.use(express.static(distClientPath, { etag: false, lastModified: false, maxAge: 0 }));
      app.get("*", (_req, res) => {
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
        res.sendFile(path.join(distClientPath, "index.html"));
      });
    }
  }

  // Capturer les erreurs globales Express et renvoyer du JSON
  app.use(errorHandler);

  return app;
}

export function listenOnAvailablePort(app: express.Express, port: number, host = HOST) {
  // En mode production / portable, verrouiller strictement sur 127.0.0.1 (Loopback exclusif)
  // pour garantir ZÉRO invite du pare-feu Windows et un fonctionnement 100% sans privilèges administrateur
  const effectiveHost = (process.env.NODE_ENV === "production" || !host || host === "0.0.0.0")
    ? "127.0.0.1"
    : host;

  const server = app.listen(port, effectiveHost, () => {
    console.log(`\n=============================================================`);
    console.log(`🚀 SERVEUR ÉVALUATEUR DE PRIX DÉMARRÉ AVEC SUCCÈS !`);
    console.log(`=============================================================`);
    console.log(`💻 Accès Ordinateur Local (Desktop) : http://127.0.0.1:${port}`);
    console.log(`🛡️ Sécurité : Interface de bouclage locale stricte ${effectiveHost} (Zéro Pare-feu)`);
    console.log(`=============================================================\n`);

    if (process.env.AUTO_OPEN === "true") {
      const openCmd = process.platform === "win32" ? `start http://127.0.0.1:${port}` :
        process.platform === "darwin" ? `open http://127.0.0.1:${port}` : `xdg-open http://127.0.0.1:${port}`;
      exec(openCmd, () => {});
    }

    // Enregistrer le PID et le Port effectif pour le lanceur autonome et l'arrêt propre
    try {
      fs.writeFileSync(PID_FILE, process.pid.toString(), "utf-8");
      fs.writeFileSync(PORT_FILE, port.toString(), "utf-8");
    } catch (e: any) {
      logger.warn(`[Lifecycle] Impossible d'écrire PID_FILE/PORT_FILE: ${e?.message || e}`);
    }

    // Configurer le gestionnaire d'arrêt gracieux
    setupGracefulShutdown(server);
  });

  server.on("error", (err: any) => {
    if (err.code === "EADDRINUSE") {
      console.log(`⚠️ Le port ${port} est déjà occupé. Basculement automatique sur le port ${port + 1}...`);
      listenOnAvailablePort(app, port + 1, host);
    } else {
      console.error("❌ Erreur au démarrage du serveur :", err);
    }
  });

  return server;
}

export async function startServer() {
  const app = await createApp();
  return listenOnAvailablePort(app, PORT, HOST);
}
