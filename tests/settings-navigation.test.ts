import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { HELP_CONTENT } from "../src/constants/helpContent";

describe("Refonte de la Navigation & Onglet Paramètres (Jalon v1.7.1)", () => {
  it("vérifie que l'ancien fichier GcsurplusTab.tsx a été complètement supprimé", () => {
    const gcsurplusTabPath = path.join(process.cwd(), "src", "components", "GcsurplusTab.tsx");
    expect(fs.existsSync(gcsurplusTabPath)).toBe(false);
  });

  it("vérifie que SettingsTab.tsx existe et contient les contrôles de CPU et de Thème", () => {
    const settingsTabPath = path.join(process.cwd(), "src", "components", "SettingsTab.tsx");
    expect(fs.existsSync(settingsTabPath)).toBe(true);

    const content = fs.readFileSync(settingsTabPath, "utf-8");
    // Contrôles de thème
    expect(content).toContain("Thème Visuel de l'Interface");
    expect(content).toContain("onToggleTheme");
    expect(content).toContain("Mode Clair");
    expect(content).toContain("Mode Sombre");

    // Contrôles de concurrence CPU
    expect(content).toContain("Puissance CPU & Parallélisme");
    expect(content).toContain("onSaveConcurrency");
    expect(content).toContain('type="range"');
    expect(content).toContain("min={1}");
    expect(content).toContain("max={16}");

    // Marque blanche & Sources
    expect(content).toContain("Organisation & Image de Marque (Marque Blanche)");
    expect(content).toContain("Architecture d'Acquisition Locale");
  });

  it("vérifie que SourcesTab.tsx est un alias rétrocompatible vers SettingsTab", () => {
    const sourcesTabPath = path.join(process.cwd(), "src", "components", "SourcesTab.tsx");
    expect(fs.existsSync(sourcesTabPath)).toBe(true);

    const content = fs.readFileSync(sourcesTabPath, "utf-8");
    expect(content).toContain("import SettingsTab");
    expect(content).toContain("export default SettingsTab");
  });

  it("vérifie que l'en-tête de App.tsx a retiré la configuration CPU et Thème", () => {
    const appPath = path.join(process.cwd(), "src", "App.tsx");
    const content = fs.readFileSync(appPath, "utf-8");

    // L'en-tête status-indicators ne doit plus avoir ces boutons
    expect(content).not.toContain('id="btn-concurrency-modal"');
    expect(content).not.toContain('id="btn-theme-toggle"');

    // L'en-tête conserve l'usager, l'horodatage, la version et l'export
    expect(content).toContain('id="btn-user-switch"');
    expect(content).toContain('id="btn-version-update"');
    expect(content).toContain('id="btn-header-export"');
  });

  it("vérifie que la navigation principale a supprimé gcsurplus et ajouté l'onglet PARAMÈTRES", () => {
    const appPath = path.join(process.cwd(), "src", "App.tsx");
    const content = fs.readFileSync(appPath, "utf-8");

    // Aucune trace du bouton nav gcsurplus
    expect(content).not.toContain('id="nav-btn-gcsurplus"');

    // Présence du bouton PARAMÈTRES
    expect(content).toContain('id="nav-btn-settings"');
    expect(content).toContain("PARAMÈTRES");

    // Rendu de SettingsTab
    expect(content).toContain("<SettingsTab");
    expect(content).not.toContain("<GcsurplusTab");
  });

  it("vérifie que HELP_CONTENT contient la documentation de l'onglet navSettings", () => {
    expect(HELP_CONTENT).toHaveProperty("navSettings");
    const help = HELP_CONTENT.navSettings;
    expect(help.title).toContain("Paramètres");
    expect(help.description).toContain("CPU");
    expect(help.description).toContain("thème");
  });
});
