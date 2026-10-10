import { describe, it, expect } from "vitest";
import { readDB, writeDB, withDBLock } from "../server/database/repository.ts";
import { seedDatabase } from "../server/database/seed.ts";
import { generateMasterExcel, generateTemplateExcel, parseCADPrice, parseExcelDate } from "../server/services/excel.service.ts";
import { getEstimatedBasePrice, getBrand, getFunctionalUrl, getModelMeta } from "../server/config/index.ts";
import { isNewerVersion } from "../server/services/update.service.ts";
import ExcelJS from "exceljs";

describe("Architecture Modulaire du Serveur (Jalon 5.1)", () => {
  describe("Configuration & Utilitaires", () => {
    it("détecte correctement les marques", () => {
      expect(getBrand("ThinkPad T480", "Portables Lenovo")).toBe("Lenovo");
      expect(getBrand("Dell Latitude 5420", "Portables Dell")).toBe("Dell");
      expect(getBrand("HP EliteBook 840 G7", "Portables HP")).toBe("HP");
      expect(getBrand("MacBook Air M1", "Apple")).toBe("Apple");
      expect(getBrand("Modèle Inconnu XYZ", "Autre")).toBe("Autre");
    });

    it("génère des URLs de recherche fonctionnelles et sécurisées", () => {
      const urlEbay = getFunctionalUrl("eBay (Annonces actives)", "T480", "ThinkPad T480");
      expect(urlEbay).toContain("ebay.ca");
      expect(urlEbay).toContain(encodeURIComponent("ThinkPad T480"));

      const urlDell = getFunctionalUrl("Dell Refurbished Canada", "5420", "Latitude 5420");
      expect(urlDell).toContain("dellrefurbished.ca");
      expect(urlDell).toContain("page=seek");

      const urlWalmart = getFunctionalUrl("Walmart Canada", "T480", "ThinkPad T480");
      expect(urlWalmart).toContain("walmart.ca");
    });

    it("calcule les prix de base estimés avec précision", () => {
      expect(getEstimatedBasePrice("ThinkPad T480")).toBe(280);
      expect(getEstimatedBasePrice("Dell Latitude 5420")).toBe(440);
      expect(getEstimatedBasePrice("MacBook Air M1")).toBe(580);
      expect(getEstimatedBasePrice("Appareil Inexistant")).toBe(250);
    });

    it("détermine la supériorité de version sémantique", () => {
      expect(isNewerVersion("1.4.2", "1.4.1")).toBe(true);
      expect(isNewerVersion("2.0.0", "1.4.1")).toBe(true);
      expect(isNewerVersion("1.4.1", "1.4.1")).toBe(false);
      expect(isNewerVersion("1.4.0", "1.4.1")).toBe(false);
    });
  });

  describe("Base de Données & Persistance SQLite", () => {
    it("initialise le seed avec les 16 sources configurées", () => {
      const seed = seedDatabase();
      expect(seed.sources.length).toBe(16);
      expect(seed.sources.map(s => s.sourceKey)).toContain("dell");
      expect(seed.sources.map(s => s.sourceKey)).toContain("gcsurplus");
      expect(seed.sources.map(s => s.sourceKey)).toContain("seao");
      expect(seed.sources.map(s => s.sourceKey)).toContain("walmart");
    });

    it("permet l'écriture et la lecture sous verrou withDBLock", async () => {
      await withDBLock(async () => {
        const db = readDB();
        db.evaluations["Test Model Modular"] = {
          modelName: "Test Model Modular",
          category: "Portables Lenovo",
          medianPrice: 420,
          confidence: "Élevé",
          comparablesCount: 5,
          lastScraped: new Date().toISOString(),
          listings: []
        };
        writeDB(db);
      });

      const updated = readDB();
      expect(updated.evaluations["Test Model Modular"]).toBeDefined();
      expect(updated.evaluations["Test Model Modular"].medianPrice).toBe(420);

      // Nettoyage
      await withDBLock(async () => {
        const db = readDB();
        delete db.evaluations["Test Model Modular"];
        writeDB(db);
      });
    });
  });

  describe("Service Excel", () => {
    it("parse fidèlement les dates et prix CAD", () => {
      expect(parseCADPrice("450.50$ CAD")).toBe(450.50);
      expect(parseCADPrice("1 250,99 $")).toBe(1250.99);
      expect(parseCADPrice(399)).toBe(399);

      const d = parseExcelDate("2026-10-10");
      expect(d.getFullYear()).toBe(2026);
    });

    it("génère un gabarit vierge avec la feuille Inventaire Global", async () => {
      const buffer = await generateTemplateExcel();
      expect(buffer).toBeDefined();
      expect(buffer.length).toBeGreaterThan(1000);

      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer);
      const sheetNames = wb.worksheets.map(w => w.name);
      expect(sheetNames).toContain("Inventaire Global");
    });

    it("génère le classeur maître complet avec la feuille Modèles Personnalisés", async () => {
      const result = await generateMasterExcel();
      expect(result.success).toBe(true);
      expect(result.fileName).toBe("Export_Donnees_Brutes.xlsx");

      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(result.localMasterPath);
      const sheetNames = wb.worksheets.map(w => w.name);
      expect(sheetNames).toContain("Inventaire Global");
      expect(sheetNames).toContain("Métadonnées");
    });
  });
});
