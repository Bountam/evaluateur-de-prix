import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { HELP_CONTENT } from "../src/constants/helpContent";

describe("Bulles d'Aide Contextuelles Interactives (Jalon v1.6.0)", () => {
  it("contient toutes les rubriques d'aide requises pour l'ensemble de l'interface", () => {
    const requiredKeys = [
      // Top bar & actions
      "operatorSwitch",
      "systemVersion",
      "cpuConcurrency",
      "excelExport",
      "themeToggle",
      // Navigation
      "navPortables",
      "navDesktops",
      "navIphones",
      "navHistorique",
      "navEcarts",
      "navSettings",
      "navSources",
      // Sidebar
      "modelSearch",
      "addModelBtn",
      // Stats & métriques
      "statMedianPrice",
      "statComparablesCount",
      "statLastScraped",
      "statConfidence",
      "statSparkline",
      // Tableau & filtres
      "colIncluded",
      "colSource",
      "colPrice",
      "colStatus",
      "filterSource",
      "filterHardware",
      "filterKeyword",
      // Sources & marque
      "whiteLabelSettings",
      "localCatalogFiles",
      "purgeCacheBtn",
    ];

    for (const key of requiredKeys) {
      expect(HELP_CONTENT, `Clé d'aide manquante: ${key}`).toHaveProperty(key);
      const topic = (HELP_CONTENT as Record<string, any>)[key];
      expect(typeof topic.title).toBe("string");
      expect(topic.title.trim().length).toBeGreaterThan(0);
      expect(typeof topic.description).toBe("string");
      expect(topic.description.trim().length).toBeGreaterThan(15);
      if (topic.tips) {
        expect(typeof topic.tips).toBe("string");
        expect(topic.tips.trim().length).toBeGreaterThan(5);
      }
    }
  });

  it("vérifie que la version est synchronisée dans package.json, metadata.json et app.manifest", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf-8"));
    const meta = JSON.parse(fs.readFileSync(path.join(process.cwd(), "metadata.json"), "utf-8"));
    const manifest = fs.readFileSync(path.join(process.cwd(), "launcher", "app.manifest"), "utf-8");

    expect(pkg.version).toBe("1.7.0");
    expect(meta.version).toBe("1.7.0");
    expect(manifest).toContain('version="1.7.0.0"');
  });

  it("vérifie que le composant HelpTooltip existe et définit les gestionnaires de clic et d'échappement", () => {
    const componentPath = path.join(process.cwd(), "src", "components", "common", "HelpTooltip.tsx");
    expect(fs.existsSync(componentPath)).toBe(true);

    const content = fs.readFileSync(componentPath, "utf-8");
    // Clic pour basculer
    expect(content).toContain("setIsOpen");
    expect(content).toContain("e.stopPropagation()");
    expect(content).toContain("e.preventDefault()");
    // Fermeture Escape et clic extérieur
    expect(content).toContain("handleClickOutside");
    expect(content).toContain("Escape");
    // Accessibilité
    expect(content).toContain("aria-expanded");
    expect(content).toContain("aria-label");
  });
});
