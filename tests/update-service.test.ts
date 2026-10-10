import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import AdmZip from "adm-zip";
import {
  isNewerVersion,
  isValidRepoSlug,
  isValidUpdateUrl,
  selectPortableAsset,
  assertSafeZipEntries,
  validatePortablePackage,
  stripProtectedEntries,
  copyUpdateFiles,
  buildWindowsUpdaterScript,
  buildRelaunchVbsScript,
  PORTABLE_ASSET_NAME,
  PROTECTED_ROOT_ENTRIES,
  UpdateValidationError
} from "../server/services/update.service.ts";

describe("Système de Mise à Jour Sécurisé (Audit & Durcissement)", () => {
  const TEST_REPO = "Bountam/evaluateur-de-prix";
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "insertech-update-test-"));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe("1. Comparaison de Versions Sémantiques (isNewerVersion)", () => {
    it("compare correctement les versions standard sans préfixe", () => {
      expect(isNewerVersion("1.5.0", "1.4.1")).toBe(true);
      expect(isNewerVersion("2.0.0", "1.9.9")).toBe(true);
      expect(isNewerVersion("1.4.2", "1.4.1")).toBe(true);
      expect(isNewerVersion("1.4.1", "1.4.1")).toBe(false);
      expect(isNewerVersion("1.4.0", "1.4.1")).toBe(false);
      expect(isNewerVersion("0.9.0", "1.0.0")).toBe(false);
    });

    it("gère de manière robuste le préfixe 'v' des tags GitHub (insensible à la casse)", () => {
      expect(isNewerVersion("v1.5.0", "1.4.1")).toBe(true);
      expect(isNewerVersion("1.5.0", "v1.4.1")).toBe(true);
      expect(isNewerVersion("V2.0.0", "v1.4.1")).toBe(true);
      expect(isNewerVersion("v1.4.1", "v1.4.1")).toBe(false);
      expect(isNewerVersion("v1.4.0", "1.4.1")).toBe(false);
    });

    it("gère les pré-versions (ex. -beta, -rc.1) et reconnaît la supériorité d'une version stable", () => {
      // Une version stable finale est plus récente que sa pré-version
      expect(isNewerVersion("1.5.0", "1.5.0-rc.1")).toBe(true);
      // Entre pré-versions de même base
      expect(isNewerVersion("1.5.0-rc.2", "1.5.0-rc.1")).toBe(true);
      expect(isNewerVersion("1.5.0-rc.1", "1.5.0-rc.2")).toBe(false);
      // Une pré-version d'une version supérieure est plus récente qu'une ancienne version stable
      expect(isNewerVersion("1.5.0-alpha.1", "1.4.1")).toBe(true);
    });

    it("ignore les métadonnées de build (+build.123)", () => {
      expect(isNewerVersion("1.5.0+20261010", "1.4.1")).toBe(true);
      expect(isNewerVersion("1.4.1+build.1", "1.4.1")).toBe(false);
    });

    it("retourne false en toute sécurité sur entrées invalides sans lever d'exception", () => {
      expect(isNewerVersion("", "1.4.1")).toBe(false);
      expect(isNewerVersion("invalide", "1.4.1")).toBe(false);
      expect(isNewerVersion("1.5.0", "")).toBe(false);
      expect(isNewerVersion("1.5.0", "xyz")).toBe(false);
      expect(isNewerVersion(null as any, "1.4.1")).toBe(false);
      expect(isNewerVersion("1.5.0", undefined as any)).toBe(false);
    });
  });

  describe("2. Validation de Repo & Protection Anti-SSRF (isValidRepoSlug & isValidUpdateUrl)", () => {
    it("valide les formats de slugs GitHub autorisés", () => {
      expect(isValidRepoSlug("Bountam/evaluateur-de-prix")).toBe(true);
      expect(isValidRepoSlug("octocat/hello-world_1")).toBe(true);
      expect(isValidRepoSlug("insertech/app.portable")).toBe(true);

      // Invalides
      expect(isValidRepoSlug("../../../evil")).toBe(false);
      expect(isValidRepoSlug("Bountam")).toBe(false);
      expect(isValidRepoSlug("a/b/c")).toBe(false);
      expect(isValidRepoSlug("")).toBe(false);
      expect(isValidRepoSlug("evil/repo;rm -rf /")).toBe(false);
    });

    it("accepte les URLs officielles de release GitHub du dépôt configuré", () => {
      const releaseUrl = `https://github.com/${TEST_REPO}/releases/download/v1.5.0/${PORTABLE_ASSET_NAME}`;
      expect(isValidUpdateUrl(releaseUrl, TEST_REPO)).toBe(true);

      const archiveUrl = `https://github.com/${TEST_REPO}/archive/refs/tags/v1.5.0.zip`;
      expect(isValidUpdateUrl(archiveUrl, TEST_REPO)).toBe(true);

      const zipballUrl = `https://api.github.com/repos/${TEST_REPO}/zipball/v1.5.0`;
      expect(isValidUpdateUrl(zipballUrl, TEST_REPO)).toBe(true);

      const codeloadUrl = `https://codeload.github.com/${TEST_REPO}/zip/refs/tags/v1.5.0`;
      expect(isValidUpdateUrl(codeloadUrl, TEST_REPO)).toBe(true);
    });

    it("refuse catégoriquement les domaines tiers malveillants (anti-SSRF)", () => {
      const evilDomain = `https://malicious-site.com/${TEST_REPO}/releases/download/v1.5.0/${PORTABLE_ASSET_NAME}`;
      expect(isValidUpdateUrl(evilDomain, TEST_REPO)).toBe(false);

      const typoSquat = `https://github.com.evil.com/${TEST_REPO}/releases/download/v1.5.0/${PORTABLE_ASSET_NAME}`;
      expect(isValidUpdateUrl(typoSquat, TEST_REPO)).toBe(false);
    });

    it("refuse les dépôts GitHub différents du dépôt officiel", () => {
      const otherRepo = `https://github.com/Attacker/autre-projet/releases/download/v1.5.0/${PORTABLE_ASSET_NAME}`;
      expect(isValidUpdateUrl(otherRepo, TEST_REPO)).toBe(false);

      const otherApi = `https://api.github.com/repos/Attacker/autre-projet/zipball/v1.5.0`;
      expect(isValidUpdateUrl(otherApi, TEST_REPO)).toBe(false);
    });

    it("refuse les protocoles non sécurisés, ports anormaux et identifiants dans l'URL", () => {
      expect(isValidUpdateUrl(`http://github.com/${TEST_REPO}/releases/download/v1.5.0/app.zip`, TEST_REPO)).toBe(false);
      expect(isValidUpdateUrl(`https://github.com:8080/${TEST_REPO}/releases/download/v1.5.0/app.zip`, TEST_REPO)).toBe(false);
      expect(isValidUpdateUrl(`https://user:pass@github.com/${TEST_REPO}/releases/download/v1.5.0/app.zip`, TEST_REPO)).toBe(false);
    });

    it("refuse l'accès direct aux CDN sans passer par la redirection officielle", () => {
      // Les URLs objects.githubusercontent.com ne sont autorisées que comme cibles de redirection signées par GitHub
      const cdnDirect = "https://objects.githubusercontent.com/github-production-release-asset-2e65be/arbitrary-file.zip";
      expect(isValidUpdateUrl(cdnDirect, TEST_REPO)).toBe(false);
    });
  });

  describe("3. Sélection Sécurisée d'Assets Portables (selectPortableAsset)", () => {
    it("détecte le package officiel evaluateur-insertech-portable.zip", () => {
      const assets = [
        { name: "sources.tar.gz", browser_download_url: "https://github.com/.../sources.tar.gz" },
        {
          name: PORTABLE_ASSET_NAME,
          browser_download_url: `https://github.com/${TEST_REPO}/releases/download/v1.5.0/${PORTABLE_ASSET_NAME}`,
          size: 150_000_000,
          digest: "sha256:11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff"
        }
      ];

      const selected = selectPortableAsset(assets);
      expect(selected).not.toBeNull();
      expect(selected?.name).toBe(PORTABLE_ASSET_NAME);
      expect(selected?.url).toContain(PORTABLE_ASSET_NAME);
      expect(selected?.sha256).toBe("11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff");
    });

    it("retourne null si aucun asset compilé n'est présent dans la release", () => {
      const assets = [
        { name: "README.md", browser_download_url: "https://github.com/.../README.md" },
        { name: "source-code.zip", browser_download_url: "https://github.com/.../source-code.zip" }
      ];
      expect(selectPortableAsset(assets)).toBeNull();
      expect(selectPortableAsset([])).toBeNull();
      expect(selectPortableAsset(null as any)).toBeNull();
    });
  });

  describe("4. Sécurité de Décompression ZIP (assertSafeZipEntries - Anti Zip-Slip & Bombs)", () => {
    it("valide les archives contenant des chemins relatifs sains", () => {
      const zip = new AdmZip();
      zip.addFile("dist/server.js", Buffer.from("console.log('ok');"));
      zip.addFile("dist/index.html", Buffer.from("<html></html>"));
      zip.addFile("README.md", Buffer.from("documentation"));

      expect(() => assertSafeZipEntries(zip)).not.toThrow();
    });

    it("rejette les archives contenant des remontées de chemin (Zip-Slip ../)", () => {
      const zip = new AdmZip();
      zip.addFile("test.txt", Buffer.from("format c:"));
      zip.getEntries()[0].entryName = "../evil.bat";

      expect(() => assertSafeZipEntries(zip)).toThrow(UpdateValidationError);
      expect(() => assertSafeZipEntries(zip)).toThrow(/chemin dangereux/i);
    });

    it("rejette les archives contenant des chemins absolus Unix ou Windows", () => {
      const zipUnix = new AdmZip();
      zipUnix.addFile("test.txt", Buffer.from("secret"));
      zipUnix.getEntries()[0].entryName = "/etc/shadow";
      expect(() => assertSafeZipEntries(zipUnix)).toThrow(UpdateValidationError);

      const zipWin = new AdmZip();
      zipWin.addFile("test.txt", Buffer.from("malware"));
      zipWin.getEntries()[0].entryName = "C:/Windows/System32/calc.exe";
      expect(() => assertSafeZipEntries(zipWin)).toThrow(UpdateValidationError);
    });

    it("rejette les archives anormalement volumineuses une fois décompressées (Zip-Bomb)", () => {
      const zipBomb = new AdmZip();
      zipBomb.addFile("bomb.txt", Buffer.from("x"));
      // Simule une entrée avec taille non compressée de 3.5 Go (> 3 Go et < 4 Go limite uint32 zip)
      zipBomb.getEntries()[0].header.size = Math.floor(3.5 * 1024 * 1024 * 1024);
      expect(() => assertSafeZipEntries(zipBomb)).toThrow(UpdateValidationError);
      expect(() => assertSafeZipEntries(zipBomb)).toThrow(/taille décompressée excessive/i);
    });
  });

  describe("5. Sanctuarisation des Données & Zéro-Perte (stripProtectedEntries & copyUpdateFiles)", () => {
    it("supprime rigoureusement les répertoires et fichiers protégés de l'archive extraite", () => {
      // Simule un dossier extrait contenant du code et des données
      const extractedDir = path.join(tempDir, "extracted");
      fs.mkdirSync(path.join(extractedDir, "dist"), { recursive: true });
      fs.writeFileSync(path.join(extractedDir, "dist", "server.js"), "console.log('new');");
      fs.writeFileSync(path.join(extractedDir, "package.json"), "{}");

      // Tentative d'écrasement de données protégées
      fs.mkdirSync(path.join(extractedDir, "data", "backups"), { recursive: true });
      fs.writeFileSync(path.join(extractedDir, "data", "database.sqlite"), "malicious database");
      fs.writeFileSync(path.join(extractedDir, "db.json"), "malicious db.json");
      fs.writeFileSync(path.join(extractedDir, ".env"), "ATTACKER=1");
      fs.writeFileSync(path.join(extractedDir, ".env.production"), "ATTACKER=2");
      fs.mkdirSync(path.join(extractedDir, "logs"), { recursive: true });
      fs.writeFileSync(path.join(extractedDir, "logs", "server.log"), "log");

      const removed = stripProtectedEntries(extractedDir);

      expect(removed).toContain("data");
      expect(removed).toContain("db.json");
      expect(removed).toContain(".env");
      expect(removed).toContain(".env.production");
      expect(removed).toContain("logs");

      // Vérifie que les fichiers de données n'existent plus dans le dossier extrait
      expect(fs.existsSync(path.join(extractedDir, "data"))).toBe(false);
      expect(fs.existsSync(path.join(extractedDir, "db.json"))).toBe(false);
      expect(fs.existsSync(path.join(extractedDir, ".env"))).toBe(false);
      expect(fs.existsSync(path.join(extractedDir, ".env.production"))).toBe(false);
      expect(fs.existsSync(path.join(extractedDir, "logs"))).toBe(false);

      // Vérifie que le code légitime est bien conservé
      expect(fs.existsSync(path.join(extractedDir, "dist", "server.js"))).toBe(true);
      expect(fs.existsSync(path.join(extractedDir, "package.json"))).toBe(true);
    });

    it("valide la conformité du package portable compilé (validatePortablePackage)", () => {
      const validDir = path.join(tempDir, "valid-pkg");
      fs.mkdirSync(path.join(validDir, "dist"), { recursive: true });
      fs.writeFileSync(path.join(validDir, "dist", "server.js"), "app");
      fs.writeFileSync(path.join(validDir, "dist", "index.html"), "<html></html>");

      expect(() => validatePortablePackage(validDir)).not.toThrow();

      const invalidDir = path.join(tempDir, "invalid-pkg");
      fs.mkdirSync(invalidDir, { recursive: true });
      fs.writeFileSync(path.join(invalidDir, "index.ts"), "source only");

      expect(() => validatePortablePackage(invalidDir)).toThrow(UpdateValidationError);
      expect(() => validatePortablePackage(invalidDir)).toThrow(/fichiers manquants/i);
    });

    it("copieUpdateFiles refuse d'écraser les entrées protégées à la racine", () => {
      const srcDir = path.join(tempDir, "src");
      const destDir = path.join(tempDir, "dest");
      fs.mkdirSync(path.join(srcDir, "dist"), { recursive: true });
      fs.writeFileSync(path.join(srcDir, "dist", "server.js"), "new-content");
      // Si une archive contenait accidentellement db.json
      fs.writeFileSync(path.join(srcDir, "db.json"), "overwrite-attempt");

      fs.mkdirSync(path.join(destDir, "dist"), { recursive: true });
      fs.writeFileSync(path.join(destDir, "db.json"), "original-data");

      copyUpdateFiles(srcDir, destDir);

      expect(fs.readFileSync(path.join(destDir, "dist", "server.js"), "utf-8")).toBe("new-content");
      // La base originale n'a pas été écrasée
      expect(fs.readFileSync(path.join(destDir, "db.json"), "utf-8")).toBe("original-data");
    });
  });

  describe("6. Génération des Scripts de Déploiement Windows (buildWindowsUpdaterScript & VBS)", () => {
    it("génère un script batch ciblant rigoureusement le PID du serveur sans taskkill aveugle", () => {
      const script = buildWindowsUpdaterScript({
        pid: 7788,
        relativeSourceDir: "update_extracted_temp",
        port: 3000
      });

      // Vérifie l'encodage et la configuration
      expect(script).toContain("chcp 65001");
      expect(script).toContain("setlocal EnableExtensions");

      // Cible de PID spécifique
      expect(script).toContain('tasklist /FI "PID eq 7788"');
      expect(script).toContain("taskkill /F /T /PID 7788");

      // AUCUN taskkill aveugle par nom d'image
      expect(script).not.toContain("taskkill /im node.exe");
      expect(script).not.toContain("taskkill /f /im node.exe");
      expect(script).not.toContain("taskkill /IM node.exe");

      // Robocopy avec exclusion stricte des données et secrets
      expect(script).toContain("robocopy");
      expect(script).toContain('/XD "%SRC_DIR%\\data" "%SRC_DIR%\\logs" "%SRC_DIR%\\exports" "%SRC_DIR%\\scraper-cache"');
      expect(script).toContain('/XF "%SRC_DIR%\\.env" "%SRC_DIR%\\db.json" "%SRC_DIR%\\.server.pid" "%SRC_DIR%\\.server.port"');

      // Port fixé et relance via VBScript invisible
      expect(script).toContain('set "PORT=3000"');
      expect(script).toContain("relaunch_server.vbs");
    });

    it("rejette les PID invalides ou non entiers", () => {
      expect(() => buildWindowsUpdaterScript({ pid: 0, relativeSourceDir: "temp" })).toThrow(/PID invalide/);
      expect(() => buildWindowsUpdaterScript({ pid: -5, relativeSourceDir: "temp" })).toThrow(/PID invalide/);
      expect(() => buildWindowsUpdaterScript({ pid: NaN, relativeSourceDir: "temp" })).toThrow(/PID invalide/);
    });

    it("génère un lanceur VBScript propre et sans console pour le redémarrage", () => {
      const vbs = buildRelaunchVbsScript();
      expect(vbs).toContain('CreateObject("WScript.Shell")');
      expect(vbs).toContain('dist\\server.js');
      expect(vbs).toContain('nodeCmd = """" & appDir & "\\node.exe"""');
      // Auto-suppression du script temporaire
      expect(vbs).toContain("fso.DeleteFile WScript.ScriptFullName, True");
    });
  });
});
