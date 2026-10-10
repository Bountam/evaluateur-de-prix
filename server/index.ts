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
import apiRouter from "./routes/index.ts";

export async function createApp() {
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
  const server = app.listen(port, host, () => {
    console.log(`\n=============================================================`);
    console.log(`🚀 SERVEUR ÉVALUATEUR INSERTECH DÉMARRÉ AVEC SUCCÈS !`);
    console.log(`=============================================================`);
    console.log(`💻 Accès Ordinateur Local (Desktop) : http://127.0.0.1:${port}`);

    if (host === "0.0.0.0") {
      const interfaces = os.networkInterfaces();
      const localIps: string[] = [];
      for (const name of Object.keys(interfaces)) {
        for (const net of interfaces[name] || []) {
          if (net.family === "IPv4" && !net.internal) {
            localIps.push(net.address);
          }
        }
      }

      if (localIps.length > 0) {
        console.log(`📱 Accès Mobile / Android (Même réseau Wi-Fi) :`);
        localIps.forEach(ip => {
          console.log(`   👉 http://${ip}:${port}`);
        });
      }
    }
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
