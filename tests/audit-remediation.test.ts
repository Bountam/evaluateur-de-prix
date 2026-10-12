import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import { createApp } from "../server/index.ts";
import { readDB, withDBLock } from "../server/database/repository.ts";
import { flagOutliers } from "../scrapers/orchestrator.ts";
import type { ScrapedListing } from "../scrapers/types.ts";

describe("Validation des Remédiations d'Audit (Tribunal de l'Audit)", () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = await createApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => {
        const addr = server.address() as { port: number };
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  describe("Inquisiteur : Sécurité CORS & Contrôle des Origines", () => {
    it("autorise et reflète les origines locales légitimes (localhost)", async () => {
      const res = await fetch(`${baseUrl}/api/version`, {
        headers: { Origin: "http://localhost:5173" }
      });
      expect(res.status).toBe(200);
      expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
    });

    it("autorise et reflète les origines locales 127.0.0.1", async () => {
      const res = await fetch(`${baseUrl}/api/version`, {
        headers: { Origin: "http://127.0.0.1:8080" }
      });
      expect(res.status).toBe(200);
      expect(res.headers.get("access-control-allow-origin")).toBe("http://127.0.0.1:8080");
    });

    it("rejette les pré-vols OPTIONS émanant d'origines tierces non approuvées avec HTTP 403", async () => {
      const res = await fetch(`${baseUrl}/api/version`, {
        method: "OPTIONS",
        headers: { Origin: "https://malicious-external-site.com" }
      });
      expect(res.status).toBe(403);
      expect(res.headers.get("access-control-allow-origin")).toBeNull();
    });

    it("ne transmet aucun en-tête Access-Control-Allow-Origin pour les origines non autorisées", async () => {
      const res = await fetch(`${baseUrl}/api/version`, {
        headers: { Origin: "https://attacker-domain.org" }
      });
      expect(res.headers.get("access-control-allow-origin")).toBeNull();
    });
  });

  describe("Inquisiteur : Protection Prototype Pollution (/api/models/add)", () => {
    it("bloque la tentative d'injection avec la clé __proto__", async () => {
      const res = await fetch(`${baseUrl}/api/models/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: "Portables Lenovo",
          modelName: "__proto__",
          configuration: "i5 / 16GB"
        })
      });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.message).toBe("Nom de modèle non autorisé.");
    });

    it("bloque la tentative d'injection avec la clé constructor", async () => {
      const res = await fetch(`${baseUrl}/api/models/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: "Portables Dell",
          modelName: "constructor"
        })
      });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.message).toBe("Nom de modèle non autorisé.");
    });
  });

  describe("Inquisiteur : Protection OOM / DoS (/api/import-preview)", () => {
    it("rejette les charges utiles dépassant la limite maximale de 20 Mo", async () => {
      // Simuler une charge utile base64 dépassant 20 Mo (en-tête ZIP valide + padding)
      const fakeLargeBase64 = Buffer.from("PK\x03\x04" + "A".repeat(21 * 1024 * 1024)).toString("base64");
      const res = await fetch(`${baseUrl}/api/import-preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileData: `data:application/vnd.ms-excel;base64,${fakeLargeBase64}` })
      });
      expect([400, 413]).toContain(res.status);
    });
  });

  describe("Architecte : Cohérence CQS & Concurrence SQLite", () => {
    it("readDB() retourne l'état sans effet de bord d'écriture immédiat", () => {
      const db1 = readDB();
      expect(db1).toBeDefined();
      expect(db1.evaluations).toBeDefined();
      const db2 = readDB();
      expect(db2).toBeDefined();
    });

    it("withDBLock sérialise les accès asynchrones concurrents", async () => {
      const sequence: number[] = [];
      const p1 = withDBLock(async () => {
        await new Promise((r) => setTimeout(r, 20));
        sequence.push(1);
      });
      const p2 = withDBLock(async () => {
        sequence.push(2);
      });
      await Promise.all([p1, p2]);
      expect(sequence).toEqual([1, 2]);
    });
  });

  describe("Le Chirurgien : Optimisation IQR flagOutliers", () => {
    it("identifie les mots-clés d'anomalie et isole les valeurs extrêmes par IQR en passe optimisée", () => {
      const dummyListings = [
        { id: "1", title: "ThinkPad T480 i5 16GB", price: 300, source: "eBay", sourceKey: "ebay", date: "2026-10-11", isOutlier: false, isSimulated: false, url: "https://ebay.ca", included: true },
        { id: "2", title: "ThinkPad T480 i5 16GB", price: 310, source: "eBay", sourceKey: "ebay", date: "2026-10-11", isOutlier: false, isSimulated: false, url: "https://ebay.ca", included: true },
        { id: "3", title: "ThinkPad T480 i5 16GB", price: 320, source: "eBay", sourceKey: "ebay", date: "2026-10-11", isOutlier: false, isSimulated: false, url: "https://ebay.ca", included: true },
        { id: "4", title: "ThinkPad T480 i5 16GB", price: 330, source: "eBay", sourceKey: "ebay", date: "2026-10-11", isOutlier: false, isSimulated: false, url: "https://ebay.ca", included: true },
        { id: "5", title: "ThinkPad T480 NO RAM NO SSD", price: 50, source: "eBay", sourceKey: "ebay", date: "2026-10-11", isOutlier: false, isSimulated: false, url: "https://ebay.ca", included: true },
        { id: "6", title: "ThinkPad T480 Extreme Special Edition", price: 2500, source: "eBay", sourceKey: "ebay", date: "2026-10-11", isOutlier: false, isSimulated: false, url: "https://ebay.ca", included: true },
      ] as ScrapedListing[];

      const processed = flagOutliers(dummyListings);

      // L'annonce 'NO RAM' doit être marquée comme outlier par mot-clé
      const noRam = processed.find(l => l.id === "5");
      expect(noRam?.isOutlier).toBe(true);
      expect(noRam?.included).toBe(false);

      // L'annonce à 2500$ doit être marquée comme outlier par la méthode IQR
      const expensive = processed.find(l => l.id === "6");
      expect(expensive?.isOutlier).toBe(true);
      expect(expensive?.included).toBe(false);

      // Les annonces régulières entre 300$ et 330$ restent incluses
      const normal = processed.filter(l => ["1", "2", "3", "4"].includes(l.id));
      expect(normal.every(l => !l.isOutlier && l.included !== false)).toBe(true);
    });
  });
});
