import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { PID_FILE, PORT_FILE } from "../server/config/index.ts";

describe("Packaging Exécutable & Lanceur Unique Autonome (Jalon 7 - Volet 1)", () => {
  it("exporte les chemins de verrouillage PID_FILE et PORT_FILE dans la configuration", () => {
    expect(PID_FILE).toBeDefined();
    expect(PORT_FILE).toBeDefined();
    expect(PID_FILE).toContain(".server.pid");
    expect(PORT_FILE).toContain(".server.port");
  });

  it("vérifie que le script build-executable compile le lanceur natif et isole l'application dans app/", () => {
    const buildScriptPath = path.join(process.cwd(), "scripts", "build-executable.ts");
    expect(fs.existsSync(buildScriptPath)).toBe(true);

    const scriptContent = fs.readFileSync(buildScriptPath, "utf-8");

    // Vérifier l'exclusion des dépendances de dev volumineuses
    expect(scriptContent).toContain("DEV_DEPS_TO_EXCLUDE");
    expect(scriptContent).toContain("typescript");
    expect(scriptContent).toContain("vitest");

    // Vérifier l'encapsulation dans app/
    expect(scriptContent).toContain("const APP_DIR = path.join(PORTABLE_DIR, 'app')");

    // Vérifier la compilation C# du lanceur natif avec icône intégrée
    expect(scriptContent).toContain("csc.exe");
    expect(scriptContent).toContain("Évaluateur Insertech.exe");
    expect(scriptContent).toContain("/win32icon");

    // Vérifier le retrait des lanceurs obsolètes Linux et macOS
    expect(scriptContent).not.toContain("Démarrer-Insertech-macOS.command");
    expect(scriptContent).not.toContain("Lancer-Insertech.sh");
  });

  it("vérifie que le lanceur natif C# gère le mutex, le port dynamique et l'arrêt propre", () => {
    const launcherSourcePath = path.join(process.cwd(), "launcher", "Launcher.cs");
    expect(fs.existsSync(launcherSourcePath)).toBe(true);

    const launcherContent = fs.readFileSync(launcherSourcePath, "utf-8");

    // Mutex pour instance unique et restauration de la fenêtre existante
    expect(launcherContent).toContain("Mutex");
    expect(launcherContent).toContain("EvaluateurInsertechLauncherMutex");

    // Détection dynamique du port et suivi du PID
    expect(launcherContent).toContain(".server.pid");
    expect(launcherContent).toContain(".server.port");

    // Arrêt gracieux via token de sécurité
    expect(launcherContent).toContain("/api/system/shutdown");
    expect(launcherContent).toContain("INSERTECH_SHUTDOWN_TOKEN");
    expect(launcherContent).toContain("X-Shutdown-Token");

    // Aucun kill aveugle de tous les processus node.exe
    expect(launcherContent).not.toContain("taskkill /f /im node.exe");
    expect(launcherContent).not.toContain("taskkill /im node.exe");
  });
});
