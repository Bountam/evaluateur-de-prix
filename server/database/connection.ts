import fs from "fs";
import { DatabaseSync } from "node:sqlite";
import { SQLITE_PATH, DB_PATH } from "../config/index.ts";

export let sqliteDb: DatabaseSync;

function initDatabase(): DatabaseSync {
  try {
    const db = new DatabaseSync(SQLITE_PATH);

    // Timeout pour attendre la libération des verrous SQLite concurrents (10 secondes)
    db.exec("PRAGMA busy_timeout = 10000;");

    // Optimisation WAL (uniquement pour les bases de données persistantes sur disque)
    if (SQLITE_PATH !== ":memory:") {
      try {
        db.exec(`
          PRAGMA journal_mode = WAL;
          PRAGMA synchronous = NORMAL;
        `);
      } catch (walErr) {
        console.warn("Avertissement: Impossible d'activer le mode WAL, mode par défaut conservé:", walErr);
      }
    }

    db.exec(`
      CREATE TABLE IF NOT EXISTS store (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);

    // Migration automatique de legacy db.json si SQLite est vierge (hors environnement de test)
    if (!process.env.VITEST && fs.existsSync(DB_PATH)) {
      try {
        const row: any = db.prepare('SELECT count(*) as c FROM store').get();
        if (row && row.c === 0) {
          const data = fs.readFileSync(DB_PATH, "utf-8");
          const stmt = db.prepare('INSERT INTO store (key, value) VALUES (?, ?)');
          stmt.run('state', data);
          try {
            fs.renameSync(DB_PATH, DB_PATH + ".bak");
          } catch {}
          console.log("Migration réussie : db.json transféré vers SQLite (data/database.sqlite)");
        }
      } catch (migrErr) {
        console.warn("Avertissement lors de la migration db.json:", migrErr);
      }
    }

    return db;
  } catch (err) {
    console.error("Critical: Failed to initialize SQLite DatabaseSync at " + SQLITE_PATH + ":", err);
    // En environnement de test ou en cas de verrou récalcitrant, repli sur base en mémoire pour ne pas bloquer
    if (process.env.VITEST || process.env.NODE_ENV === "test") {
      console.warn("Repli sur base SQLite en mémoire (:memory:) pour les tests.");
      const memDb = new DatabaseSync(":memory:");
      memDb.exec(`
        CREATE TABLE IF NOT EXISTS store (
          key TEXT PRIMARY KEY,
          value TEXT
        );
      `);
      return memDb;
    }
    throw err;
  }
}

sqliteDb = initDatabase();
