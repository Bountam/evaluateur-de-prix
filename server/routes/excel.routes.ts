import { Router } from "express";
import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";
import { EXPORTS_DIR, MASTER_FILE_NAME } from "../config/index.ts";
import { intensiveLimiter } from "../middlewares/rateLimiters.ts";
import {
  generateMasterExcel,
  generateTemplateExcel,
  processImportPreview,
  executeImportExcel
} from "../services/excel.service.ts";

const router = Router();

// Déclencher la génération du classeur Excel complet
router.post("/api/export-excel", (_req, res) => {
  try {
    const result = generateMasterExcel();
    res.json(result);
  } catch (err: any) {
    console.error("Error generating Excel export:", err);
    res.status(500).json({ success: false, message: `Erreur lors de la génération : ${err.message}` });
  }
});

// Téléchargement direct du fichier Excel maître généré
router.get("/api/download-excel", (_req, res) => {
  try {
    const excelPath = path.join(EXPORTS_DIR, MASTER_FILE_NAME);

    if (!fs.existsSync(excelPath)) {
      generateMasterExcel();
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
router.get("/api/download-template", (_req, res) => {
  try {
    const buffer = generateTemplateExcel();
    res.setHeader("Content-Disposition", 'attachment; filename="Import_Manuel_Gabarit.xlsx"');
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buffer);
  } catch (err: any) {
    console.error("Error generating import template:", err);
    res.status(500).send("Erreur lors de la génération du gabarit.");
  }
});

// Prévisualisation des données avant confirmation d'importation
router.post("/api/import-preview", (req, res) => {
  try {
    const { fileData } = req.body;
    let workbook: XLSX.WorkBook;

    if (fileData) {
      const cleanBase64 = fileData.replace(/^data:.*;base64,/, "");
      const buffer = Buffer.from(cleanBase64, "base64");

      if (buffer.length < 4 || buffer.readUInt32BE(0) !== 0x504B0304) {
        res.status(400).json({ success: false, message: "Format de fichier invalide. Veuillez fournir un fichier Excel (.xlsx) valide." });
        return;
      }

      workbook = XLSX.read(buffer, { type: "buffer" });
    } else {
      const masterPath = path.join(EXPORTS_DIR, MASTER_FILE_NAME);
      if (fs.existsSync(masterPath)) {
        workbook = XLSX.readFile(masterPath);
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
    let workbook: XLSX.WorkBook;

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
        workbook = XLSX.read(buffer, { type: "buffer" });
      } catch {
        res.status(400).json({ success: false, message: "Impossible de lire le contenu Excel. Le fichier est probablement corrompu." });
        return;
      }
    } else {
      const masterPath = path.join(EXPORTS_DIR, MASTER_FILE_NAME);
      if (fs.existsSync(masterPath)) {
        try {
          workbook = XLSX.readFile(masterPath);
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
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;
      const rows = XLSX.utils.sheet_to_json(sheet) as any[];
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
