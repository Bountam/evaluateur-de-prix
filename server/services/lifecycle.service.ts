import type { Server } from "http";
import fs from "fs";
import { closeSharedBrowser } from "../../scrapers/browser-emulator.ts";
import { sqliteDb } from "../database/connection.ts";
import { PID_FILE, PORT_FILE, logger } from "../config/index.ts";

let isShuttingDown = false;
let registeredServer: Server | null = null;

export function getIsShuttingDown(): boolean {
  return isShuttingDown;
}

/**
 * Exécute la séquence d'arrêt ordonné de l'application Insertech :
 * 1. Arrêt des réceptions HTTP
 * 2. Fermeture propre du navigateur Chromium et des processus enfants Windows
 * 3. Checkpoint WAL SQLite et fermeture de la base
 * 4. Nettoyage des fichiers d'état (.server.pid, .server.port)
 */
export async function performGracefulShutdown(signal = "MANUAL"): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info(`[Lifecycle] 🛑 Signal ${signal} reçu. Initialisation de l'arrêt gracieux du serveur...`);

  // 1. Fermer le serveur HTTP Express
  if (registeredServer) {
    try {
      await new Promise<void>((resolve) => {
        registeredServer!.close((err) => {
          if (err) {
            logger.warn(`[Lifecycle] Erreur lors de la fermeture HTTP : ${err.message}`);
          } else {
            logger.info("[Lifecycle] Serveur HTTP fermé avec succès (plus de nouvelles connexions).");
          }
          resolve();
        });
      });
    } catch (e: any) {
      logger.warn(`[Lifecycle] Exception fermeture HTTP : ${e?.message || e}`);
    }
  }

  // 2. Fermer Chromium et nettoyer les processus enfants Playwright
  try {
    logger.info("[Lifecycle] Fermeture de l'émulateur Playwright Chromium...");
    await Promise.race([
      closeSharedBrowser(),
      new Promise<void>((resolve) => setTimeout(resolve, 4000))
    ]);
    logger.info("[Lifecycle] Navigateur Chromium et processus associés libérés.");
  } catch (err: any) {
    logger.warn(`[Lifecycle] Avertissement fermeture Chromium : ${err?.message || err}`);
  }

  // 3. Finaliser le journal SQLite WAL et fermer la base de données
  try {
    if (sqliteDb) {
      logger.info("[Lifecycle] Exécution du checkpoint SQLite WAL et fermeture...");
      try {
        sqliteDb.exec("PRAGMA wal_checkpoint(TRUNCATE);");
      } catch {
        // En mode :memory: ou si la base est verrouillée
      }
      sqliteDb.close();
      logger.info("[Lifecycle] Base de données SQLite fermée proprement.");
    }
  } catch (dbErr: any) {
    logger.warn(`[Lifecycle] Avertissement fermeture SQLite : ${dbErr?.message || dbErr}`);
  }

  // 4. Nettoyer les fichiers de verrouillage PID et Port
  [PID_FILE, PORT_FILE].forEach((filePath) => {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch {
      // Ignorer si déjà supprimé
    }
  });

  logger.info("[Lifecycle] ✔️ Arrêt gracieux complété avec succès. Tous les processus sont libérés.");
}

/**
 * Configure les écouteurs de signaux système pour l'arrêt automatique
 */
export function setupGracefulShutdown(server: Server): void {
  registeredServer = server;

  const handleSignal = (sig: string) => {
    performGracefulShutdown(sig).then(() => {
      process.exit(0);
    }).catch((err) => {
      logger.error(`[Lifecycle] Échec critique pendant l'arrêt gracieux : ${err?.message || err}`);
      process.exit(1);
    });
  };

  process.once("SIGINT", () => handleSignal("SIGINT"));
  process.once("SIGTERM", () => handleSignal("SIGTERM"));

  // Sur Windows, si SIGHUP est émis lors de la fermeture de console
  if (process.platform === "win32") {
    process.once("SIGHUP", () => handleSignal("SIGHUP"));
  }
}
