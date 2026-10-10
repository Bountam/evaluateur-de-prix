import { describe, it, expect, beforeEach } from "vitest";
import ExcelJS from "exceljs";
import {
  generateMasterExcel,
  generateTemplateExcel,
  processImportPreview,
  executeImportExcel,
  parseCADPrice,
  parseExcelDate,
  worksheetToJson
} from "../server/services/excel.service.ts";
import { readDB, writeDB } from "../server/database/repository.ts";
import { seedDatabase } from "../server/database/seed.ts";

describe("Service Excel avec ExcelJS (Jalon 6)", () => {
  beforeEach(() => {
    writeDB(seedDatabase());
  });

  describe("Parsers de prix et dates", () => {
    it("parseCADPrice extrait les prix correctement dans tous les formats", () => {
      expect(parseCADPrice(350)).toBe(350);
      expect(parseCADPrice("350.50")).toBe(350.50);
      expect(parseCADPrice("350,50 $")).toBe(350.50);
      expect(parseCADPrice("$ 420.00 CAD")).toBe(420);
      expect(parseCADPrice("1 250,00 $")).toBe(1250);
      expect(parseCADPrice(null)).toBe(0);
      expect(parseCADPrice(undefined)).toBe(0);
      expect(parseCADPrice("N/A")).toBe(0);
    });

    it("parseExcelDate convertit correctement les formats français, ISO et numéros de série Excel", () => {
      const d1 = parseExcelDate("15/10/2026");
      expect(d1.getFullYear()).toBe(2026);
      expect(d1.getMonth()).toBe(9); // Octobre = 9
      expect(d1.getDate()).toBe(15);

      const d2 = parseExcelDate("2026-10-15T14:30:00Z");
      expect(d2.getFullYear()).toBe(2026);

      // Numéro de série Excel (45945 correspond à octobre 2025)
      const d3 = parseExcelDate(45945);
      expect(d3.getFullYear()).toBe(2025);

      expect(parseExcelDate(null).getTime()).toBe(0);
      expect(parseExcelDate("invalide").getTime()).toBe(0);
    });
  });

  describe("Génération du gabarit vierge", () => {
    it("produit un buffer Excel valide avec la feuille Inventaire Global et ses styles Insertech", async () => {
      const buffer = await generateTemplateExcel();
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(1000);

      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer);
      expect(wb.worksheets.map(w => w.name)).toContain("Inventaire Global");

      const ws = wb.getWorksheet("Inventaire Global")!;
      const rows = worksheetToJson(ws);
      expect(rows.length).toBe(2);
      expect(rows[0]["Marque"]).toBe("Lenovo");
      expect(rows[0]["Modèle"]).toBe("ThinkPad T14 Gen 2");
      expect(rows[1]["Marque"]).toBe("Dell");
    });
  });

  describe("Génération et Export Maître ExcelJS", () => {
    it("génère le classeur maître avec mise en forme professionnelle et métadonnées", async () => {
      // Ajouter des données simulées dans la base
      const db = readDB();
      db.evaluations["ThinkPad T480"] = {
        modelName: "ThinkPad T480",
        category: "Portables Lenovo",
        medianPrice: 280,
        comparablesCount: 3,
        confidence: "Élevé",
        lastScraped: "2026-10-10T12:00:00Z",
        configuration: "Core i5-8250U, 16 Go, 256 Go SSD",
        condition: "Très bon",
        commentaires: "Valeur stable",
        listings: [
          {
            id: "t480-1",
            title: "ThinkPad T480 Core i5",
            price: 270,
            originalPrice: 320,
            discountAmount: 50,
            discountPercent: 15.6,
            source: "eBay",
            saleType: "completed",
            date: "2026-10-09",
            url: "https://ebay.ca/1",
            included: true,
            isOutlier: false
          }
        ],
        historicalPrices: [
          { date: "2026-09-01", price: 290, confidence: "Élevé" },
          { date: "2026-10-01", price: 280, confidence: "Élevé" }
        ]
      };
      db.customModels.push({
        category: "Portables Sur Mesure",
        modelName: "Custom Precision 5570",
        addedAt: "2026-10-10T10:00:00Z",
        configuration: "Core i7, 32 Go, 1 To SSD"
      });
      writeDB(db);

      const result = await generateMasterExcel();
      expect(result.success).toBe(true);
      expect(result.fileName).toBe("Export_Donnees_Brutes.xlsx");

      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(result.localMasterPath);
      const sheetNames = wb.worksheets.map(w => w.name);

      expect(sheetNames).toContain("Inventaire Global");
      expect(sheetNames).toContain("Comparables Détaillés");
      expect(sheetNames).toContain("Historique des Prix");
      expect(sheetNames).toContain("Modèles Personnalisés");
      expect(sheetNames).toContain("Métadonnées");

      // Vérifier le style de l'en-tête (fond sombre officiel Insertech #2D3436, police blanche)
      const wsGlobal = wb.getWorksheet("Inventaire Global")!;
      const headerCell = wsGlobal.getRow(1).getCell(1);
      expect(headerCell.font?.bold).toBe(true);
      expect(headerCell.font?.color?.argb).toBe("FFFFFFFF");
    });
  });

  describe("Prévisualisation et Importation (Aller-Retour 100% Fidèle)", () => {
    it("prévisualise fidèlement la structure du classeur", async () => {
      const templateBuffer = await generateTemplateExcel();
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(templateBuffer);

      const preview = processImportPreview(wb);
      expect(preview.success).toBe(true);
      expect(preview.sheetNames).toContain("Inventaire Global");
      expect(preview.modelsCount).toBe(2);
      expect(preview.sampleModels.length).toBe(2);
      expect(preview.sampleModels[0].model).toBe("ThinkPad T14 Gen 2");
    });

    it("restaure l'intégralité des modèles, comparables et modèles personnalisés sans aucune perte", async () => {
      // 1. Préparer une base avec des données personnalisées
      const db = readDB();
      db.evaluations["Latitude 5420 Special"] = {
        modelName: "Latitude 5420 Special",
        category: "Portables Dell",
        medianPrice: 420,
        comparablesCount: 1,
        confidence: "Élevé",
        lastScraped: "2026-10-10",
        configuration: "Core i7, 16 Go, 512 Go SSD",
        condition: "Excellent",
        commentaires: "Modèle certifié",
        listings: [
          {
            id: "lat-1",
            title: "Dell Latitude 5420 Special Edition",
            price: 420,
            originalPrice: 480,
            discountAmount: 60,
            discountPercent: 12.5,
            source: "Dell Refurbished Canada",
            saleType: "completed",
            date: "2026-10-10",
            url: "https://dellrefurbished.ca/item",
            included: true,
            isOutlier: false
          }
        ],
        historicalPrices: [{ date: "2026-10-10", price: 420, confidence: "Élevé" }]
      };
      db.customModels.push({
        category: "Portables Dell",
        modelName: "Latitude 5420 Special",
        addedAt: "2026-10-10",
        configuration: "Core i7, 16 Go, 512 Go SSD"
      });
      writeDB(db);

      // 2. Exporter en classeur maître via ExcelJS
      const exportRes = await generateMasterExcel();
      expect(exportRes.success).toBe(true);

      // 3. Simuler une réinitialisation de la base de données
      writeDB(seedDatabase());
      const dbReset = readDB();
      expect(dbReset.evaluations["Latitude 5420 Special"]).toBeUndefined();

      // 4. Charger et importer le classeur exporté
      const wbToImport = new ExcelJS.Workbook();
      await wbToImport.xlsx.readFile(exportRes.localMasterPath);

      const importStats = await executeImportExcel(wbToImport);
      expect(importStats.importedModelsCount).toBeGreaterThan(0);
      expect(importStats.importedComparablesCount).toBeGreaterThan(0);

      // 5. Vérifier la restauration 100% fidèle dans la base
      const dbRestored = readDB();
      expect(dbRestored.evaluations["Latitude 5420 Special"]).toBeDefined();
      expect(dbRestored.evaluations["Latitude 5420 Special"].medianPrice).toBe(420);
      expect(dbRestored.evaluations["Latitude 5420 Special"].category).toBe("Portables Dell");
      expect(dbRestored.evaluations["Latitude 5420 Special"].listings.length).toBe(1);
      expect(dbRestored.evaluations["Latitude 5420 Special"].listings[0].price).toBe(420);
      expect(dbRestored.evaluations["Latitude 5420 Special"].listings[0].originalPrice).toBe(480);
      expect(dbRestored.customModels.some((cm: any) => cm.modelName === "Latitude 5420 Special")).toBe(true);
    });
  });
});
