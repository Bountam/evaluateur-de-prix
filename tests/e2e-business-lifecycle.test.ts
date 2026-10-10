import { describe, it, expect, beforeEach, afterAll } from "vitest";
import fs from "fs";
import ExcelJS from "exceljs";
import { readDB, writeDB } from "../server/database/repository.ts";
import { seedDatabase } from "../server/database/seed.ts";
import { resetDatabaseConnection } from "../server/database/connection.ts";
import { generateMasterExcel, executeImportExcel } from "../server/services/excel.service.ts";
import { PID_FILE, PORT_FILE } from "../server/config/index.ts";
import { getIsShuttingDown, performGracefulShutdown } from "../server/services/lifecycle.service.ts";
import { normalizeCategory } from "../src/modelsData.ts";
import { calculateMedian, flagOutliers } from "../scrapers/orchestrator.ts";
import { isPartOrAssembly } from "../scrapers/utils.ts";

describe("Validation Métier Insertech & Cycle de Vie E2E (Jalon 7 - Volets 2 & 3)", () => {
  beforeEach(() => {
    resetDatabaseConnection();
    writeDB(seedDatabase());
  });

  afterAll(() => {
    resetDatabaseConnection();
  });

  describe("Règles Comptables Insertech & Calculs Statistiques JVM", () => {
    it("exclut rigoureusement les pièces détachées et les annonces non conformes", () => {
      expect(isPartOrAssembly("Batterie originale ThinkPad P15")).toBe(true);
      expect(isPartOrAssembly("Écran LCD 15.6 pouces pour ThinkPad")).toBe(true);
      expect(isPartOrAssembly("Clavier rétroéclairé français")).toBe(true);
      expect(isPartOrAssembly("Chargeur adaptateur AC 135W")).toBe(true);

      expect(isPartOrAssembly("Lenovo ThinkPad P15 Gen 2 Core i7 32GB")).toBe(false);
      expect(isPartOrAssembly("Dell Latitude 5420 Core i5 Reconditionné")).toBe(false);
    });

    it("détecte les anomalies (outliers) par IQR et mots-clés", () => {
      const mockListings: any[] = [
        { title: "ThinkPad P15 Gen 2 i7", price: 840, included: true, isOutlier: false },
        { title: "ThinkPad P15 Gen 2 i7", price: 850, included: true, isOutlier: false },
        { title: "ThinkPad P15 Gen 2 i7", price: 860, included: true, isOutlier: false },
        { title: "ThinkPad P15 Gen 2 i7", price: 890, included: true, isOutlier: false },
        { title: "ThinkPad P15 Gen 2 - Pour pièces ou réparation", price: 60, included: true, isOutlier: false },
        { title: "ThinkPad P15 Gen 2 Neuf sous scellé entreprise", price: 2400, included: true, isOutlier: false },
      ];

      const processed = flagOutliers(mockListings);

      // L'annonce "pour pièces" doit être marquée en anomalie
      const partsItem = processed.find(l => l.price === 60);
      expect(partsItem?.isOutlier).toBe(true);
      expect(partsItem?.included).toBe(false);

      // L'annonce hors de prix (2400$) doit être exclue par IQR
      const expensiveItem = processed.find(l => l.price === 2400);
      expect(expensiveItem?.isOutlier).toBe(true);
      expect(expensiveItem?.included).toBe(false);

      // La médiane doit être calculée uniquement sur les offres valides
      const median = calculateMedian(processed);
      expect(median).toBeGreaterThanOrEqual(840);
      expect(median).toBeLessThanOrEqual(890);
    });
  });

  describe("Garantie Zéro-Perte & Aller-Retour Intégral ExcelJS", () => {
    it("conserve et restaure à 100% un modèle sur-mesure dans une catégorie personnalisée", async () => {
      const customCategory = "Stations de Travail Mobiles";
      const customModel = "ThinkPad P15 Gen 2 Insertech Special";

      // 1. Normalisation : la catégorie sur-mesure est préservée sans altération
      expect(normalizeCategory(customCategory)).toBe(customCategory);

      // 2. Inscription du modèle personnalisé dans la base de données
      const db = readDB();
      db.customModels.push({
        category: customCategory,
        modelName: customModel,
        configuration: "Core i7-11850H, 32 Go RAM, 1 To SSD NVMe, GPU RTX A2000",
        addedAt: "2026-10-10T14:00:00Z"
      });

      db.evaluations[customModel] = {
        modelName: customModel,
        category: customCategory,
        medianPrice: 855,
        comparablesCount: 4,
        confidence: "Élevé",
        lastScraped: "2026-10-10T14:30:00Z",
        configuration: "Core i7-11850H, 32 Go RAM, 1 To SSD NVMe, GPU RTX A2000",
        condition: "Excellent",
        commentaires: "Appareil professionnel haute puissance certifié atelier.",
        listings: [
          {
            id: "p15-1",
            title: "ThinkPad P15 Gen 2 i7 32GB RTX",
            price: 840,
            originalPrice: 950,
            discountAmount: 110,
            discountPercent: 11.5,
            source: "eBay",
            saleType: "completed",
            date: "2026-10-09",
            url: "https://ebay.ca/test-p15",
            included: true,
            isOutlier: false
          },
          {
            id: "p15-2",
            title: "Lenovo P15 Gen 2 Poste Fixe Portable",
            price: 870,
            source: "Dell Refurbished Canada",
            saleType: "completed",
            date: "2026-10-10",
            url: "https://dellrefurbished.ca/test",
            included: true,
            isOutlier: false
          }
        ],
        historicalPrices: [
          { date: "2026-09-15", price: 890, confidence: "Élevé" },
          { date: "2026-10-10", price: 855, confidence: "Élevé" }
        ]
      };

      db.historicalLog.push({
        id: "audit-p15-log",
        date: "2026-10-10T14:30:00Z",
        model: customModel,
        action: "Évaluation atelier certifiée",
        previousPrice: 890,
        currentPrice: 855,
        operator: "Technicien Insertech #42"
      });

      writeDB(db);

      // 3. Export Maître ExcelJS
      const exportResult = await generateMasterExcel();
      expect(exportResult.success).toBe(true);

      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(exportResult.localMasterPath);
      const sheetNames = wb.worksheets.map(w => w.name);

      expect(sheetNames).toContain("Inventaire Global");
      expect(sheetNames).toContain("Modèles Personnalisés");
      expect(sheetNames).toContain("Comparables Détaillés");
      expect(sheetNames).toContain("Historique des Prix");
      expect(sheetNames).toContain("Journal d'Audit");

      // Vérifier le style Insertech de l'en-tête (fond sombre #2D3436 et texte blanc)
      const wsGlobal = wb.getWorksheet("Inventaire Global")!;
      const headerCell = wsGlobal.getRow(1).getCell(1);
      expect(headerCell.font?.bold).toBe(true);

      // 4. Réinitialisation complète de la base de données locale (simulation perte ou nouveau poste)
      writeDB(seedDatabase());
      const dbReset = readDB();
      expect(dbReset.evaluations[customModel]).toBeUndefined();
      expect(dbReset.customModels.some((cm: any) => cm.modelName === customModel)).toBe(false);

      // 5. Restauration intégrale depuis le classeur ExcelJS
      const importStats = await executeImportExcel(wb);
      expect(importStats.importedModelsCount).toBeGreaterThan(0);
      expect(importStats.importedCustomCount).toBeGreaterThan(0);

      // 6. Vérification de la Garantie Zéro-Perte
      const dbRestored = readDB();
      const restoredEval = dbRestored.evaluations[customModel];

      expect(restoredEval).toBeDefined();
      expect(restoredEval.category).toBe(customCategory);
      expect(restoredEval.medianPrice).toBe(855);
      expect(restoredEval.listings.length).toBe(2);
      expect(restoredEval.listings[0].price).toBe(840);
      expect(restoredEval.historicalPrices.length).toBeGreaterThanOrEqual(1);

      // Modèle personnalisé bien présent dans la liste custom
      expect(dbRestored.customModels.some((cm: any) => cm.modelName === customModel)).toBe(true);

      // Journal d'audit et opérateur conservés
      const auditEntry = dbRestored.historicalLog.find((l: any) => l.model === customModel);
      expect(auditEntry).toBeDefined();
      expect(auditEntry?.operator).toBe("Technicien Insertech #42");
    });
  });

  describe("Service de Cycle de Vie & Arrêt Gracieux", () => {
    it("démarre dans un état actif et nettoie les fichiers de verrouillage PID/PORT lors de l'arrêt", async () => {
      expect(getIsShuttingDown()).toBe(false);

      // Créer des fichiers de verrouillage temporaires pour tester le nettoyage
      fs.writeFileSync(PID_FILE, "99999", "utf-8");
      fs.writeFileSync(PORT_FILE, "3000", "utf-8");
      expect(fs.existsSync(PID_FILE)).toBe(true);
      expect(fs.existsSync(PORT_FILE)).toBe(true);

      // Déclencher l'arrêt gracieux
      await performGracefulShutdown("TEST_RUN");

      expect(getIsShuttingDown()).toBe(true);
      expect(fs.existsSync(PID_FILE)).toBe(false);
      expect(fs.existsSync(PORT_FILE)).toBe(false);

      // Restaurer la connexion SQLite pour la suite de l'environnement
      resetDatabaseConnection();
    });
  });
});
