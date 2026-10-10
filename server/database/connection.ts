import fs from "fs";
import { DatabaseSync } from "node:sqlite";
import { SQLITE_PATH, DB_PATH } from "../config/index.ts";

export let sqliteDb: DatabaseSync;

try {
  sqliteDb = new DatabaseSync(SQLITE_PATH);

  // Optimisation WAL (Write-Ahead Logging) pour haute concurrence et performance
  sqliteDb.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    CREATE TABLE IF NOT EXISTS store (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  // Migration automatique de legacy db.json si SQLite est vierge
  if (fs.existsSync(DB_PATH)) {
    const row: any = sqliteDb.prepare('SELECT count(*) as c FROM store').get();
    if (row && row.c === 0) {
      const data = fs.readFileSync(DB_PATH, "utf-8");
      const stmt = sqliteDb.prepare('INSERT INTO store (key, value) VALUES (?, ?)');
      stmt.run('state', data);
      fs.renameSync(DB_PATH, DB_PATH + ".bak");
      console.log("Migration réussie : db.json transféré vers SQLite (data/database.sqlite)");
    }
  }
} catch (err) {
  console.error("Critical: Failed to initialize SQLite DatabaseSync:", err);
  process.exit(1);
}
