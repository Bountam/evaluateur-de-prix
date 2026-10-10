import { Router } from "express";
import fs from "fs";
import path from "path";
import ExcelJS from "exceljs";
import { EXPORTS_DIR, MASTER_FILE_NAME } from "../config/index.ts";
import { intensiveLimiter } from "../middlewares/rateLimiters.ts";
import {
  generateMasterExcel,
  generateTemplateExcel,
  processImportPreview,
  executeImportExcel,
  worksheetToJson
} from "../services/excel.service.ts";

const router = Router();

// Déclencher la génération du classeur Excel complet
router.post("/api/export-excel", async (_req, res) => {
  try {
    const result = await generateMasterExcel();
    res.json(result);
  } catch (err: any) {
    console.error("Error generating Excel export:", err);
    res.status(500).json({ success: false, message: `Erreur lors de la génération : ${err.message}` });
  }
});

// Téléchargement direct du fichier Excel maître généré
router.get("/api/download-excel", async (_req, res) => {
  try {
    const excelPath = path.join(EXPORTS_DIR, MASTER_FILE_NAME);

    if (!fs.existsSync(excelPath)) {
      await generateMasterExcel();
    }

    res.download(excelPath, MASTER_FILE_NAME, (err) => {
      if (err && !res.headersSent) {
        res.status(500).send("Erreur lors du téléchargement.");
      }
    });
  } catch (err: any) {
    console.error("Error downloading master Excel file:", err);
    if (!res.headersSent) {
      res.status(500).send("Erreur serveur lors du téléchargement.");
    }
  }
});

// Téléchargement d'un gabarit vierge conforme pour l'import
router.get("/api/download-template", async (_req, res) => {
  try {
    const buffer = await generateTemplateExcel();
    res.setHeader("Content-Disposition", 'attachment; filename="Import_Manuel_Gabarit.xlsx"');
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buffer);
  } catch (err: any) {
    console.error("Error generating import template:", err);
    res.status(500).send("Erreur lors de la génération du gabarit.");
  }
});

// Prévisualisation des données avant confirmation d'importation
router.post("/api/import-preview", async (req, res) => {
  try {
    const { fileData } = req.body;
    const workbook = new ExcelJS.Workbook();

    if (fileData) {
      const cleanBase64 = fileData.replace(/^data:.*;base64,/, "");
      const buffer = Buffer.from(cleanBase64, "base64");

      if (buffer.length < 4 || buffer.readUInt32BE(0) !== 0x504B0304) {
        res.status(400).json({ success: false, message: "Format de fichier invalide. Veuillez fournir un fichier Excel (.xlsx) valide." });
        return;
      }

      await workbook.xlsx.load(buffer);
    } else {
      const masterPath = path.join(EXPORTS_DIR, MASTER_FILE_NAME);
      if (fs.existsSync(masterPath)) {
        await workbook.xlsx.readFile(masterPath);
      } else {
        res.status(400).json({ success: false, message: `Aucun fichier maître ${MASTER_FILE_NAME} trouvé sur le serveur.` });
        return;
      }
    }

    const preview = processImportPreview(workbook);
    res.json(preview);
  } catch (err: any) {
    console.error("Error generating import preview:", err);
    res.status(500).json({ success: false, message: `Erreur lors de la lecture du fichier : ${err.message}` });
  }
});

// Exécution de l'importation Excel complète
router.post("/api/import-excel", intensiveLimiter, async (req, res) => {
  try {
    const { fileData } = req.body;
    const workbook = new ExcelJS.Workbook();

    if (fileData) {
      const cleanBase64 = fileData.replace(/^data:.*;base64,/, "");
      const buffer = Buffer.from(cleanBase64, "base64");

      if (buffer.length > 20 * 1024 * 1024) {
        res.status(400).json({ success: false, message: "Le fichier dépasse la taille maximale autorisée (20 Mo)." });
        return;
      }

      if (buffer.length < 4 || buffer.readUInt32BE(0) !== 0x504B0304) {
        res.status(400).json({ success: false, message: "Format de fichier invalide. Veuillez fournir un fichier Excel (.xlsx) valide." });
        return;
      }

      try {
        await workbook.xlsx.load(buffer);
      } catch {
        res.status(400).json({ success: false, message: "Impossible de lire le contenu Excel. Le fichier est probablement corrompu." });
        return;
      }
    } else {
      const masterPath = path.join(EXPORTS_DIR, MASTER_FILE_NAME);
      if (fs.existsSync(masterPath)) {
        try {
          await workbook.xlsx.readFile(masterPath);
        } catch {
          res.status(400).json({ success: false, message: `Impossible de lire le fichier maître ${MASTER_FILE_NAME}.` });
          return;
        }
      } else {
        res.status(400).json({ success: false, message: `Aucun fichier maître ${MASTER_FILE_NAME} trouvé sur le serveur.` });
        return;
      }
    }

    let hasValidModelColumn = false;
    for (const worksheet of workbook.worksheets) {
      const rows = worksheetToJson(worksheet);
      if (rows.some(r => r["Modèle"] || r["Modele"] || r["Model"] || r["Modèle d'équipement"] || r["Modèle informatique"] || r["Modèle d'ordinateur"])) {
        hasValidModelColumn = true;
        break;
      }
    }

    if (!hasValidModelColumn) {
      res.status(400).json({
        success: false,
        message: "Le fichier Excel ne contient aucune colonne de modèle valide (Modèle, Modele, Model)."
      });
      return;
    }

    const stats = await executeImportExcel(workbook);

    res.json({
      success: true,
      message: `Importation réussie : ${stats.importedModelsCount} modèles, ${stats.importedComparablesCount} comparables, ${stats.importedCustomCount} modèles personnalisés restaurés.`,
      stats
    });
  } catch (err: any) {
    console.error("Error executing Excel import:", err);
    res.status(500).json({ success: false, message: `Erreur lors de l'importation : ${err.message}` });
  }
});

export default router;
