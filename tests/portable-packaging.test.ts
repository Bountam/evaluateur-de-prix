import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { PID_FILE, PORT_FILE, HOST } from "../server/config/index.ts";

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

    // Vérifier la compilation C# du lanceur natif avec icône intégrée et manifeste
    expect(scriptContent).toContain("csc.exe");
    expect(scriptContent).toContain("Évaluateur Insertech.exe");
    expect(scriptContent).toContain("/win32icon");
    expect(scriptContent).toContain("/win32manifest");

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

  it("garantit l'absence totale de demande de permissions administrateur (UAC asInvoker)", () => {
    const manifestPath = path.join(process.cwd(), "launcher", "app.manifest");
    expect(fs.existsSync(manifestPath)).toBe(true);

    const manifestContent = fs.readFileSync(manifestPath, "utf-8");
    expect(manifestContent).toContain('requestedExecutionLevel level="asInvoker" uiAccess="false"');
    expect(manifestContent).not.toContain('level="requireAdministrator"');
    expect(manifestContent).not.toContain('level="highestAvailable"');
  });

  it("garantit l'absence totale d'alerte de pare-feu Windows (bouclage strict 127.0.0.1 et isolation Chromium)", () => {
    // 1. HOST par défaut est strictement 127.0.0.1
    expect(HOST).toBe("127.0.0.1");

    // 2. server/index.ts verrouille effectiveHost sur 127.0.0.1
    const serverIndexPath = path.join(process.cwd(), "server", "index.ts");
    const serverContent = fs.readFileSync(serverIndexPath, "utf-8");
    expect(serverContent).toContain('"127.0.0.1"');
    expect(serverContent).not.toContain('if (host === "0.0.0.0")');

    // 3. Chromium browser-emulator est isolé de toute découverte réseau LAN / mDNS
    const browserEmulatorPath = path.join(process.cwd(), "scrapers", "browser-emulator.ts");
    const emulatorContent = fs.readFileSync(browserEmulatorPath, "utf-8");
    expect(emulatorContent).toContain("--disable-background-networking");
    expect(emulatorContent).toContain("--webrtc-ip-handling-policy=disable_non_proxied_udp");
    expect(emulatorContent).toContain("MediaRouter");
  });
});
