import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { PID_FILE, PORT_FILE } from "../server/config/index.ts";

describe("Packaging Exécutable & Lanceurs Autonomes (Jalon 7 - Volet 1)", () => {
  it("exporte les chemins de verrouillage PID_FILE et PORT_FILE dans la configuration", () => {
    expect(PID_FILE).toBeDefined();
    expect(PORT_FILE).toBeDefined();
    expect(PID_FILE).toContain(".server.pid");
    expect(PORT_FILE).toContain(".server.port");
  });

  it("vérifie que le script build-executable contient la gestion de PID ciblé et aucun taskkill aveugle", () => {
    const buildScriptPath = path.join(process.cwd(), "scripts", "build-executable.ts");
    expect(fs.existsSync(buildScriptPath)).toBe(true);

    const scriptContent = fs.readFileSync(buildScriptPath, "utf-8");

    // Vérifier l'exclusion des dépendances de dev volumineuses
    expect(scriptContent).toContain("DEV_DEPS_TO_EXCLUDE");
    expect(scriptContent).toContain("typescript");
    expect(scriptContent).toContain("vitest");

    // Vérifier la présence du ciblage par PID dans le script VBS
    expect(scriptContent).toContain(".server.pid");
    expect(scriptContent).toContain(".server.port");
    expect(scriptContent).toContain("taskkill /f /pid");

    // Vérifier qu'il n'y a plus aucun kill aveugle de tous les processus node.exe
    expect(scriptContent).not.toContain("taskkill /f /im node.exe");
  });

  it("vérifie que le script bash pour macOS/Linux utilise le port dynamique", () => {
    const buildScriptPath = path.join(process.cwd(), "scripts", "build-executable.ts");
    const scriptContent = fs.readFileSync(buildScriptPath, "utf-8");

    expect(scriptContent).toContain(".server.port");
    expect(scriptContent).toContain("SERVER_PID=$!");
  });
});
