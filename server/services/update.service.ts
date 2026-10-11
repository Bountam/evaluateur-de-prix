import fs from "fs";
import path from "path";
import crypto from "crypto";
import { spawn } from "child_process";
import { Readable, Transform } from "stream";
import { pipeline } from "stream/promises";
import AdmZip from "adm-zip";
import { PORT_FILE } from "../config/index.ts";
import { performGracefulShutdown } from "./lifecycle.service.ts";

// ─── Constantes ──────────────────────────────────────────────────────────────

/** Nom officiel de l'archive portable compilée publiée sur GitHub Releases. */
export const PORTABLE_ASSET_NAME = "evaluateur-de-prix-portable.zip";
export const LEGACY_PORTABLE_ASSET_NAME = "evaluateur-insertech-portable.zip";

/** Taille maximale acceptée pour l'archive téléchargée (protection disque / mémoire). */
const MAX_DOWNLOAD_BYTES = 1024 * 1024 * 1024; // 1 Go
/** Taille décompressée maximale (protection contre les « zip bombs »). */
const MAX_UNCOMPRESSED_BYTES = 3 * 1024 * 1024 * 1024; // 3 Go
const MAX_REDIRECTS = 5;
const CHECK_TIMEOUT_MS = 15_000;
const DOWNLOAD_TIMEOUT_MS = 15 * 60_000;

const TEMP_ZIP_NAME = "update_temp.zip";
const TEMP_EXTRACT_DIR_NAME = "update_extracted_temp";
const UPDATER_BAT_NAME = "apply_update.bat";
const RELAUNCH_VBS_NAME = "relaunch_server.vbs";

/** Hôtes vers lesquels GitHub redirige légitimement les téléchargements d'assets. */
const ALLOWED_REDIRECT_HOSTS = new Set([
  "github.com",
  "api.github.com",
  "codeload.github.com",
  "objects.githubusercontent.com",
  "release-assets.githubusercontent.com"
]);

/**
 * Entrées racine qui ne doivent JAMAIS être écrasées par une mise à jour
 * (Garantie Zéro-Perte : base SQLite, sauvegardes, exports, secrets, état d'exécution).
 */
export const PROTECTED_ROOT_ENTRIES = [
  "data",
  "logs",
  "exports",
  "scraper-cache",
  "scraper-cache.json",
  "db.json",
  "db.json.bak",
  ".env",
  ".server.pid",
  ".server.port",
  TEMP_ZIP_NAME,
  TEMP_EXTRACT_DIR_NAME,
  UPDATER_BAT_NAME,
  RELAUNCH_VBS_NAME
];

const GITHUB_HEADERS = {
  "User-Agent": "Evaluateur-De-Prix-App",
  "Accept": "application/vnd.github+json"
};

/** Erreur de validation (URL refusée, archive non conforme…) → HTTP 400 côté route. */
export class UpdateValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UpdateValidationError";
  }
}

// ─── Versions sémantiques ────────────────────────────────────────────────────

interface ParsedVersion {
  core: number[];
  prerelease: string | null;
}

function parseVersion(raw: string): ParsedVersion | null {
  const cleaned = String(raw || "").trim().replace(/^v/i, "");
  if (!cleaned) return null;
  const withoutBuild = cleaned.split("+")[0];
  const dashIndex = withoutBuild.indexOf("-");
  const corePart = dashIndex >= 0 ? withoutBuild.slice(0, dashIndex) : withoutBuild;
  const prerelease = dashIndex >= 0 ? withoutBuild.slice(dashIndex + 1) || null : null;
  const core = corePart.split(".").map(p => Number(p));
  if (core.length === 0 || core.some(n => !Number.isFinite(n) || n < 0)) return null;
  return { core, prerelease };
}

/**
 * Indique si `latest` est strictement plus récente que `current`.
 * Tolère le préfixe « v » (tags GitHub) et les suffixes de pré-version (-beta, -rc.1…).
 * Une version stable est considérée plus récente que sa pré-version (1.5.0 > 1.5.0-rc.1).
 */
export function isNewerVersion(latest: string, current: string): boolean {
  const l = parseVersion(latest);
  const c = parseVersion(current);
  if (!l || !c) return false;

  for (let i = 0; i < Math.max(l.core.length, c.core.length); i++) {
    const a = l.core[i] || 0;
    const b = c.core[i] || 0;
    if (a > b) return true;
    if (a < b) return false;
  }

  if (c.prerelease && !l.prerelease) return true;
  if (!c.prerelease || !l.prerelease) return false;
  return l.prerelease.localeCompare(c.prerelease, undefined, { numeric: true }) > 0;
}

// ─── Sécurité des URLs (anti-SSRF / anti-substitution) ───────────────────────

export function isValidRepoSlug(repo: string): boolean {
  return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo);
}

/**
 * URL initiale de téléchargement acceptée UNIQUEMENT si elle pointe vers le dépôt GitHub officiel.
 * Les CDN GitHub (objects/release-assets.githubusercontent.com) ne sont acceptés qu'en tant que
 * cibles de redirection : en accès direct, ils servent les fichiers de n'importe quel dépôt.
 */
export function isValidUpdateUrl(urlStr: string, repo: string): boolean {
  if (!urlStr || !isValidRepoSlug(repo)) return false;

  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch {
    return false;
  }

  if (parsed.protocol !== "https:") return false;
  if (parsed.username || parsed.password) return false;
  if (parsed.port && parsed.port !== "443") return false;

  const host = parsed.hostname.toLowerCase();
  // Le parseur WHATWG a déjà résolu les segments « .. » (y compris encodés %2e%2e).
  const pathname = parsed.pathname.toLowerCase();
  const repoLower = repo.toLowerCase();

  if (host === "github.com") {
    return pathname.startsWith(`/${repoLower}/releases/download/`) ||
           pathname.startsWith(`/${repoLower}/archive/`);
  }
  if (host === "api.github.com") {
    return pathname.startsWith(`/repos/${repoLower}/zipball/`);
  }
  if (host === "codeload.github.com") {
    return pathname.startsWith(`/${repoLower}/`);
  }
  return false;
}

/** Une URL est une archive portable compilée (asset de release) et non un zipball de sources. */
export function isReleaseAssetUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    return parsed.hostname.toLowerCase() === "github.com" &&
           parsed.pathname.toLowerCase().includes("/releases/download/");
  } catch {
    return false;
  }
}

export function isAllowedRedirectHost(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== "https:") return false;
    if (parsed.username || parsed.password) return false;
    return ALLOWED_REDIRECT_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

// ─── Détection de l'environnement & sélection des assets ─────────────────────

/** L'application tourne-t-elle depuis le dossier portable autonome (et non un dépôt de dev) ? */
export function isPortableInstall(appDir: string = process.cwd()): boolean {
  return [
    "node.exe",
    "Évaluateur de Prix.exe",
    "Évaluateur Insertech.exe",
    path.join("..", "Évaluateur de Prix.exe"),
    path.join("..", "Évaluateur Insertech.exe"),
    path.join("app", "node.exe"),
    "Lancer-GUI.vbs",
    "Lancer-Insertech-GUI.vbs",
    "Lancer-Insertech.sh"
  ].some(f => fs.existsSync(path.join(appDir, f)));
}

export interface SelectedAsset {
  name: string;
  url: string;
  size?: number;
  sha256?: string;
}

/** Sélectionne l'archive portable compilée parmi les assets d'une release GitHub. */
export function selectPortableAsset(assets: any[]): SelectedAsset | null {
  if (!Array.isArray(assets)) return null;
  const asset =
    assets.find(a => a?.name === PORTABLE_ASSET_NAME) ||
    assets.find(a => a?.name === LEGACY_PORTABLE_ASSET_NAME) ||
    assets.find(a => typeof a?.name === "string" && /portable.*\.zip$/i.test(a.name));
  if (!asset || !asset.browser_download_url) return null;

  const digest = typeof asset.digest === "string" ? asset.digest : "";
  const sha256 = digest.toLowerCase().startsWith("sha256:") ? digest.slice(7).toLowerCase() : undefined;

  return {
    name: asset.name,
    url: asset.browser_download_url,
    size: typeof asset.size === "number" ? asset.size : undefined,
    sha256
  };
}

// ─── Vérification de mise à jour ─────────────────────────────────────────────

export type UpdatePackageType = "portable" | "source" | "none";

export interface UpdateCheckResult {
  success: boolean;
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseNotes: string;
  downloadUrl?: string;
  sha256?: string;
  packageType: UpdatePackageType;
  canAutoInstall: boolean;
  autoInstallBlockedReason?: string;
  publishedAt?: string;
  githubUrl?: string;
  rateLimited?: boolean;
  lastChecked: string;
}

function describeRateLimit(res: Response): string | null {
  if (res.status !== 403 && res.status !== 429) return null;
  const remaining = res.headers.get("x-ratelimit-remaining");
  if (res.status === 403 && remaining !== "0") return null;
  const reset = Number(res.headers.get("x-ratelimit-reset"));
  if (Number.isFinite(reset) && reset > 0) {
    const minutes = Math.max(1, Math.ceil((reset * 1000 - Date.now()) / 60_000));
    return `Quota de l'API GitHub temporairement atteint. Réessayez dans environ ${minutes} minute(s).`;
  }
  return "Quota de l'API GitHub temporairement atteint. Réessayez un peu plus tard.";
}

export async function checkApplicationUpdate(
  currentVersion: string,
  repo: string,
  appDir: string = process.cwd()
): Promise<UpdateCheckResult> {
  const lastChecked = new Date().toISOString();
  const githubUrl = `https://github.com/${repo}`;
  const base: UpdateCheckResult = {
    success: true,
    hasUpdate: false,
    currentVersion,
    latestVersion: currentVersion,
    releaseNotes: `Votre version v${currentVersion} est à jour.`,
    packageType: "none",
    canAutoInstall: false,
    githubUrl,
    lastChecked
  };

  if (!isValidRepoSlug(repo)) {
    return { ...base, releaseNotes: `Dépôt de mise à jour invalide : « ${repo} ».` };
  }

  const portable = isPortableInstall(appDir);

  try {
    let latestTag = "";
    let releaseNotes = "";
    let publishedAt = "Récemment";
    let releaseUrl = githubUrl;
    let downloadUrl: string | undefined;
    let sha256: string | undefined;
    let packageType: UpdatePackageType = "none";

    const relResponse = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
      headers: GITHUB_HEADERS,
      signal: AbortSignal.timeout(CHECK_TIMEOUT_MS)
    });

    const relRateLimit = describeRateLimit(relResponse);
    if (relRateLimit) {
      return { ...base, rateLimited: true, releaseNotes: relRateLimit };
    }

    if (relResponse.ok) {
      const releaseData = await relResponse.json() as any;
      latestTag = String(releaseData.tag_name || "").replace(/^v/i, "");
      releaseNotes = releaseData.body || "Mise à jour de sécurité et de performances.";
      publishedAt = releaseData.published_at
        ? new Date(releaseData.published_at).toLocaleDateString("fr-CA")
        : "Récemment";
      releaseUrl = releaseData.html_url || githubUrl;

      const asset = selectPortableAsset(releaseData.assets || []);
      if (asset) {
        downloadUrl = asset.url;
        sha256 = asset.sha256;
        packageType = "portable";
      } else if (releaseData.zipball_url) {
        downloadUrl = releaseData.zipball_url;
        packageType = "source";
      }
    } else if (relResponse.status === 404) {
      // Aucune release publiée : repli sur le dernier tag (archive de sources uniquement)
      const tagsResponse = await fetch(`https://api.github.com/repos/${repo}/tags`, {
        headers: GITHUB_HEADERS,
        signal: AbortSignal.timeout(CHECK_TIMEOUT_MS)
      });
      const tagsRateLimit = describeRateLimit(tagsResponse);
      if (tagsRateLimit) {
        return { ...base, rateLimited: true, releaseNotes: tagsRateLimit };
      }
      if (tagsResponse.ok) {
        const tagsData = await tagsResponse.json() as any[];
        if (Array.isArray(tagsData) && tagsData.length > 0) {
          latestTag = String(tagsData[0].name || "").replace(/^v/i, "");
          downloadUrl = tagsData[0].zipball_url;
          packageType = downloadUrl ? "source" : "none";
          releaseNotes = `Nouvelle version v${latestTag} disponible sur le dépôt GitHub.`;
        }
      }
    } else {
      return {
        ...base,
        releaseNotes: `Version v${currentVersion} active. (Réponse inattendue de GitHub : HTTP ${relResponse.status})`
      };
    }

    const hasUpdate = isNewerVersion(latestTag, currentVersion);
    let canAutoInstall = false;
    let autoInstallBlockedReason: string | undefined;

    if (hasUpdate) {
      if (!downloadUrl || !isValidUpdateUrl(downloadUrl, repo)) {
        autoInstallBlockedReason = "Aucune archive téléchargeable valide n'est associée à cette version.";
      } else if (portable && packageType !== "portable") {
        autoInstallBlockedReason =
          `La version v${latestTag} est publiée, mais l'archive portable compilée (${PORTABLE_ASSET_NAME}) ` +
          "n'est pas encore disponible sur GitHub. L'installation automatique est suspendue pour ne pas " +
          "remplacer l'application par du code source non compilé.";
      } else {
        canAutoInstall = true;
      }
    }

    return {
      success: true,
      hasUpdate,
      currentVersion,
      latestVersion: latestTag || currentVersion,
      releaseNotes: releaseNotes || (hasUpdate ? `Mise à jour v${latestTag} prête.` : base.releaseNotes),
      downloadUrl: hasUpdate ? downloadUrl : undefined,
      sha256: hasUpdate ? sha256 : undefined,
      packageType,
      canAutoInstall,
      autoInstallBlockedReason,
      publishedAt,
      githubUrl: releaseUrl,
      lastChecked
    };
  } catch (e: any) {
    return {
      ...base,
      releaseNotes: `Version v${currentVersion} active. (Impossible de contacter GitHub : ${e?.message || e})`
    };
  }
}

// ─── Téléchargement sécurisé ─────────────────────────────────────────────────

/** Suit les redirections manuellement pour valider CHAQUE saut (et pas seulement l'URL finale). */
async function fetchWithValidatedRedirects(url: string, repo: string, signal: AbortSignal): Promise<Response> {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const allowed = hop === 0 ? isValidUpdateUrl(current, repo) : isAllowedRedirectHost(current);
    if (!allowed) {
      throw new UpdateValidationError(`Source de téléchargement non autorisée : ${current}`);
    }

    const res = await fetch(current, {
      headers: { "User-Agent": GITHUB_HEADERS["User-Agent"], "Accept": "application/octet-stream" },
      redirect: "manual",
      signal
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      try { await res.body?.cancel(); } catch { /* ignorer */ }
      if (!location) throw new Error(`Redirection HTTP ${res.status} sans en-tête Location.`);
      current = new URL(location, current).toString();
      continue;
    }
    return res;
  }
  throw new Error("Trop de redirections lors du téléchargement de la mise à jour.");
}

async function downloadToFile(res: Response, dest: string): Promise<{ bytes: number; sha256: string }> {
  if (!res.body) throw new Error("Réponse de téléchargement vide.");

  const expected = Number(res.headers.get("content-length")) || 0;
  if (expected > MAX_DOWNLOAD_BYTES) {
    throw new UpdateValidationError("Archive de mise à jour anormalement volumineuse : téléchargement refusé.");
  }

  const hash = crypto.createHash("sha256");
  let bytes = 0;
  const meter = new Transform({
    transform(chunk: Buffer, _enc, cb) {
      bytes += chunk.length;
      if (bytes > MAX_DOWNLOAD_BYTES) {
        cb(new UpdateValidationError("Archive de mise à jour dépassant la taille maximale autorisée."));
        return;
      }
      hash.update(chunk);
      cb(null, chunk);
    }
  });

  // Écriture en flux : évite de charger ~260 Mo en mémoire sur les PC d'atelier modestes
  await pipeline(Readable.fromWeb(res.body as any), meter, fs.createWriteStream(dest));

  if (expected && bytes !== expected) {
    throw new Error(`Téléchargement incomplet (${bytes} / ${expected} octets). Réessayez.`);
  }
  return { bytes, sha256: hash.digest("hex") };
}

// ─── Validation & préparation de l'archive ───────────────────────────────────

/** Refuse les archives contenant des chemins absolus ou des remontées « .. » (zip-slip) et les zip bombs. */
export function assertSafeZipEntries(zip: AdmZip): void {
  let totalUncompressed = 0;
  for (const entry of zip.getEntries()) {
    const name = entry.entryName.replace(/\\/g, "/");
    if (name.startsWith("/") || /^[A-Za-z]:/.test(name) || name.split("/").includes("..")) {
      throw new UpdateValidationError(`Archive refusée : chemin dangereux détecté (« ${entry.entryName} »).`);
    }
    totalUncompressed += entry.header.size || 0;
    if (totalUncompressed > MAX_UNCOMPRESSED_BYTES) {
      throw new UpdateValidationError("Archive refusée : taille décompressée excessive.");
    }
  }
}

/** Détermine le dossier racine réel du contenu extrait. */
export function resolveSourceDir(extractDir: string): string {
  const items = fs.readdirSync(extractDir);
  if (items.includes("evaluateur-de-prix-portable") &&
      fs.statSync(path.join(extractDir, "evaluateur-de-prix-portable")).isDirectory()) {
    return path.join(extractDir, "evaluateur-de-prix-portable");
  }
  if (items.includes("evaluateur-insertech-portable") &&
      fs.statSync(path.join(extractDir, "evaluateur-insertech-portable")).isDirectory()) {
    return path.join(extractDir, "evaluateur-insertech-portable");
  }
  if (items.length === 1 && fs.statSync(path.join(extractDir, items[0])).isDirectory()) {
    return path.join(extractDir, items[0]);
  }
  return extractDir;
}

/** Une archive portable doit contenir l'application compilée, sinon on n'arrête pas le serveur. */
export function validatePortablePackage(sourceDir: string): void {
  const hasAppDir = fs.existsSync(path.join(sourceDir, "app", "dist", "server.js"));
  const baseDir = hasAppDir ? path.join(sourceDir, "app") : sourceDir;
  const required = [path.join("dist", "server.js"), path.join("dist", "index.html")];
  const missing = required.filter(rel => !fs.existsSync(path.join(baseDir, rel)));
  if (missing.length > 0) {
    throw new UpdateValidationError(
      `Archive non conforme au package portable (fichiers manquants : ${missing.join(", ")}). ` +
      "Installation annulée, l'application actuelle reste intacte."
    );
  }
}

/** Supprime de l'archive extraite toute entrée qui pourrait écraser des données locales. */
export function stripProtectedEntries(sourceDir: string): string[] {
  const removed: string[] = [];
  for (const name of fs.readdirSync(sourceDir)) {
    const isProtected = PROTECTED_ROOT_ENTRIES.includes(name) || name.toLowerCase().startsWith(".env");
    if (isProtected) {
      fs.rmSync(path.join(sourceDir, name), { recursive: true, force: true });
      removed.push(name);
    }
  }
  return removed;
}

/** Copie récursive qui n'écrase jamais les entrées protégées à la racine de destination. */
export function copyUpdateFiles(src: string, dest: string, isRoot = true): void {
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (isRoot && (PROTECTED_ROOT_ENTRIES.includes(entry.name) || entry.name.toLowerCase().startsWith(".env"))) {
      continue;
    }
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      copyUpdateFiles(srcPath, destPath, false);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function safeDeleteFile(p: string): boolean {
  try {
    if (!fs.existsSync(p)) return false;
    try {
      fs.unlinkSync(p);
    } catch {
      fs.rmSync(p, { force: true });
    }
    return !fs.existsSync(p);
  } catch {
    return false;
  }
}

/**
 * Nettoie les artefacts obsolètes laissés par les mises à jour antérieures :
 * 1. Fichiers JS/CSS compilés résiduels dans `dist/assets` non référencés par le `dist/index.html` actif.
 * 2. Anciens exécutables renommés temporairement (*.exe.old) dans le dossier racine.
 * 3. Fichiers ou répertoires temporaires d'installation abandonnés (update_temp.zip, update_extracted_temp, etc.).
 */
export function cleanupObsoleteArtifacts(appDir: string = process.cwd()): {
  removedAssets: string[];
  removedOldExecutables: string[];
  removedTempFiles: string[];
} {
  const result = {
    removedAssets: [] as string[],
    removedOldExecutables: [] as string[],
    removedTempFiles: [] as string[]
  };

  // 1. Nettoyage des anciens bundles d'actifs JS/CSS dans dist/assets
  const distDir = path.join(appDir, "dist");
  const assetsDir = path.join(distDir, "assets");
  const indexHtmlPath = path.join(distDir, "index.html");

  if (fs.existsSync(assetsDir) && fs.existsSync(indexHtmlPath)) {
    try {
      const indexHtmlContent = fs.readFileSync(indexHtmlPath, "utf-8");
      const files = fs.readdirSync(assetsDir);
      for (const file of files) {
        if (/\.(js|css|map)$/i.test(file)) {
          if (!indexHtmlContent.includes(file)) {
            const filePath = path.join(assetsDir, file);
            if (safeDeleteFile(filePath)) {
              result.removedAssets.push(file);
            }
          }
        }
      }
    } catch (err: any) {
      console.warn("[Cleanup] Erreur lors du nettoyage de dist/assets :", err?.message || err);
    }
  }

  // 2. Nettoyage des anciens exécutables renommés (*.exe.old)
  const candidateDirs = [appDir, path.join(appDir, "..")];
  const oldExeNames = [
    "Évaluateur de Prix.exe.old",
    "Évaluateur Insertech.exe.old"
  ];

  for (const dir of candidateDirs) {
    if (!fs.existsSync(dir)) continue;
    for (const name of oldExeNames) {
      const p = path.join(dir, name);
      if (fs.existsSync(p)) {
        if (safeDeleteFile(p)) {
          result.removedOldExecutables.push(name);
        }
      }
    }
  }

  // 3. Nettoyage des reliquats temporaires d'installation abandonnés
  const tempItems = [
    TEMP_ZIP_NAME,
    TEMP_EXTRACT_DIR_NAME,
    UPDATER_BAT_NAME,
    RELAUNCH_VBS_NAME
  ];

  for (const item of tempItems) {
    const p = path.join(appDir, item);
    if (fs.existsSync(p)) {
      try {
        const stat = fs.statSync(p);
        if (stat.isDirectory()) {
          fs.rmSync(p, { recursive: true, force: true });
        } else {
          safeDeleteFile(p);
        }
        if (!fs.existsSync(p)) {
          result.removedTempFiles.push(item);
        }
      } catch {
        // Ignorer
      }
    }
  }

  return result;
}

// ─── Scripts de déploiement Windows ──────────────────────────────────────────

export interface WindowsUpdaterOptions {
  /** PID du serveur à attendre (et à terminer en dernier recours). */
  pid: number;
  /** Chemin du contenu extrait, relatif au dossier de l'application. */
  relativeSourceDir: string;
  /** Port à réutiliser pour que l'interface ouverte se reconnecte au même endroit. */
  port?: number;
}

/**
 * Génère le script batch d'application de la mise à jour.
 * - Aucun `taskkill /im node.exe` : seul le PID de l'application est ciblé, après un délai d'arrêt gracieux.
 * - Attente de la libération des verrous Windows avant la copie, avec tentatives multiples.
 * - Copie robocopy qui exclut les données (double protection en plus du nettoyage de l'archive).
 * - Relance du serveur seul (la fenêtre de l'application reste ouverte et se reconnecte).
 */
export function buildWindowsUpdaterScript(opts: WindowsUpdaterOptions): string {
  const pid = Math.trunc(opts.pid);
  if (!Number.isInteger(pid) || pid <= 0) throw new Error("PID invalide pour le script de mise à jour.");
  const rel = opts.relativeSourceDir.replace(/\//g, "\\").replace(/["%^&|<>]/g, "");
  const portLine = opts.port && Number.isInteger(opts.port) ? `set "PORT=${opts.port}"` : "rem Port par defaut";

  const lines = [
    "@echo off",
    "chcp 65001 >nul",
    "setlocal EnableExtensions",
    'set "APP_DIR=%~dp0"',
    'set "APP_DIR=%APP_DIR:~0,-1%"',
    `set "SRC_DIR=%APP_DIR%\\${rel}"`,
    'if not exist "%APP_DIR%\\logs" mkdir "%APP_DIR%\\logs"',
    'set "LOG_FILE=%APP_DIR%\\logs\\update.log"',
    'echo [%DATE% %TIME%] Debut de l\'application de la mise a jour >> "%LOG_FILE%"',
    "",
    "rem 1. Attendre l'arret gracieux du serveur (PID cible uniquement)",
    "set /a WAITED=0",
    ":WAIT_SERVER",
    `tasklist /FI "PID eq ${pid}" /NH 2>nul | find " ${pid} " >nul`,
    "if errorlevel 1 goto SERVER_STOPPED",
    "if %WAITED% GEQ 20 goto FORCE_STOP",
    "timeout /t 1 /nobreak >nul",
    "set /a WAITED+=1",
    "goto WAIT_SERVER",
    ":FORCE_STOP",
    'echo [%DATE% %TIME%] Arret force du PID ' + pid + ' >> "%LOG_FILE%"',
    `taskkill /F /T /PID ${pid} >nul 2>&1`,
    ":SERVER_STOPPED",
    "",
    "rem 2. Laisser Windows liberer les verrous (node.exe, DLL Chromium)",
    "timeout /t 3 /nobreak >nul",
    "",
    "rem 3. Copie securisee : donnees, journaux, exports et secrets sont exclus",
    "set /a TRIES=0",
    ":COPY",
    'if exist "%SRC_DIR%\\app" (',
    '  robocopy "%SRC_DIR%\\app" "%APP_DIR%" /E /R:3 /W:2 /NP /NFL /NDL ' +
      '/XD "%SRC_DIR%\\app\\data" "%SRC_DIR%\\app\\logs" "%SRC_DIR%\\app\\exports" "%SRC_DIR%\\app\\scraper-cache" ' +
      '/XF "%SRC_DIR%\\app\\.env" "%SRC_DIR%\\app\\db.json" "%SRC_DIR%\\app\\.server.pid" "%SRC_DIR%\\app\\.server.port" ' +
      '>> "%LOG_FILE%" 2>&1',
    ') else (',
    '  robocopy "%SRC_DIR%" "%APP_DIR%" /E /R:3 /W:2 /NP /NFL /NDL ' +
      '/XD "%SRC_DIR%\\data" "%SRC_DIR%\\logs" "%SRC_DIR%\\exports" "%SRC_DIR%\\scraper-cache" ' +
      '/XF "%SRC_DIR%\\.env" "%SRC_DIR%\\db.json" "%SRC_DIR%\\.server.pid" "%SRC_DIR%\\.server.port" ' +
      '>> "%LOG_FILE%" 2>&1',
    ')',
    'set "RC=%ERRORLEVEL%"',
    "if %RC% LSS 8 goto COPY_OK",
    "set /a TRIES+=1",
    "if %TRIES% GEQ 3 goto COPY_FAILED",
    "timeout /t 3 /nobreak >nul",
    "goto COPY",
    ":COPY_FAILED",
    'echo [%DATE% %TIME%] ECHEC de la copie (robocopy code %RC%). Archive conservee pour diagnostic. >> "%LOG_FILE%"',
    "goto RELAUNCH",
    ":COPY_OK",
    'echo [%DATE% %TIME%] Copie terminee (robocopy code %RC%). >> "%LOG_FILE%"',
    'if exist "%SRC_DIR%\\app\\dist\\assets" (',
    '  robocopy "%SRC_DIR%\\app\\dist\\assets" "%APP_DIR%\\dist\\assets" /PURGE /R:2 /W:1 /NP /NFL /NDL >> "%LOG_FILE%" 2>&1',
    ') else if exist "%SRC_DIR%\\dist\\assets" (',
    '  robocopy "%SRC_DIR%\\dist\\assets" "%APP_DIR%\\dist\\assets" /PURGE /R:2 /W:1 /NP /NFL /NDL >> "%LOG_FILE%" 2>&1',
    ')',
    'if exist "%SRC_DIR%\\Évaluateur de Prix.exe" (',
    '  if exist "%APP_DIR%\\..\\Évaluateur de Prix.exe.old" del /f /q "%APP_DIR%\\..\\Évaluateur de Prix.exe.old" >nul 2>&1',
    '  move /y "%APP_DIR%\\..\\Évaluateur de Prix.exe" "%APP_DIR%\\..\\Évaluateur de Prix.exe.old" >nul 2>&1',
    '  copy /y "%SRC_DIR%\\Évaluateur de Prix.exe" "%APP_DIR%\\..\\Évaluateur de Prix.exe" >> "%LOG_FILE%" 2>&1',
    '  if exist "%APP_DIR%\\..\\Évaluateur de Prix.exe.old" del /f /q "%APP_DIR%\\..\\Évaluateur de Prix.exe.old" >nul 2>&1',
    ')',
    'if exist "%SRC_DIR%\\Évaluateur Insertech.exe" (',
    '  if exist "%APP_DIR%\\..\\Évaluateur Insertech.exe.old" del /f /q "%APP_DIR%\\..\\Évaluateur Insertech.exe.old" >nul 2>&1',
    '  move /y "%APP_DIR%\\..\\Évaluateur Insertech.exe" "%APP_DIR%\\..\\Évaluateur Insertech.exe.old" >nul 2>&1',
    '  copy /y "%SRC_DIR%\\Évaluateur Insertech.exe" "%APP_DIR%\\..\\Évaluateur Insertech.exe" >> "%LOG_FILE%" 2>&1',
    '  if exist "%APP_DIR%\\..\\Évaluateur Insertech.exe.old" del /f /q "%APP_DIR%\\..\\Évaluateur Insertech.exe.old" >nul 2>&1',
    ')',
    `rmdir /s /q "%APP_DIR%\\${TEMP_EXTRACT_DIR_NAME}" >nul 2>&1`,
    `del /f /q "%APP_DIR%\\${TEMP_ZIP_NAME}" >nul 2>&1`,
    "",
    "rem 4. Relancer uniquement le serveur (la fenetre ouverte se reconnecte automatiquement)",
    ":RELAUNCH",
    'set "NODE_ENV=production"',
    'if not defined HOST set "HOST=127.0.0.1"',
    portLine,
    'if exist "%APP_DIR%\\chromium\\chrome.exe" set "CHROMIUM_PATH=%APP_DIR%\\chromium\\chrome.exe"',
    `start "" wscript.exe "%APP_DIR%\\${RELAUNCH_VBS_NAME}"`,
    'echo [%DATE% %TIME%] Serveur relance. >> "%LOG_FILE%"',
    '(goto) 2>nul & del "%~f0"'
  ];
  return lines.join("\r\n") + "\r\n";
}

/** Lanceur VBScript invisible : démarre le serveur sans console, chemins résolus dynamiquement. */
export function buildRelaunchVbsScript(): string {
  return [
    'Set sh = CreateObject("WScript.Shell")',
    'Set fso = CreateObject("Scripting.FileSystemObject")',
    "appDir = fso.GetParentFolderName(WScript.ScriptFullName)",
    "sh.CurrentDirectory = appDir",
    'nodeCmd = "node"',
    'If fso.FileExists(appDir & "\\node.exe") Then nodeCmd = """" & appDir & "\\node.exe"""',
    'sh.Run nodeCmd & " """ & appDir & "\\dist\\server.js""", 0, False',
    "On Error Resume Next",
    "fso.DeleteFile WScript.ScriptFullName, True"
  ].join("\r\n") + "\r\n";
}

function readCurrentPort(): number | undefined {
  try {
    if (fs.existsSync(PORT_FILE)) {
      const port = Number(fs.readFileSync(PORT_FILE, "utf-8").trim());
      if (Number.isInteger(port) && port > 0) return port;
    }
  } catch { /* ignorer */ }
  const envPort = Number(process.env.PORT);
  return Number.isInteger(envPort) && envPort > 0 ? envPort : undefined;
}

// ─── Application de la mise à jour ───────────────────────────────────────────

export interface PerformUpdateOptions {
  repo: string;
  expectedSha256?: string;
  appDir?: string;
}

export interface PerformUpdateResult {
  success: boolean;
  message: string;
  /** true si le serveur va redémarrer automatiquement (l'interface doit se reconnecter). */
  restarting: boolean;
}

let updateInProgress = false;

export function isUpdateInProgress(): boolean {
  return updateInProgress;
}

export async function performApplicationUpdate(
  downloadUrl: string,
  options: PerformUpdateOptions
): Promise<PerformUpdateResult> {
  const { repo } = options;
  const appDir = options.appDir || process.cwd();

  if (updateInProgress) {
    throw new UpdateValidationError("Une mise à jour est déjà en cours d'installation.");
  }
  if (!isValidUpdateUrl(downloadUrl, repo)) {
    throw new UpdateValidationError("URL de mise à jour refusée : seules les publications du dépôt GitHub officiel sont acceptées.");
  }

  const portable = isPortableInstall(appDir);
  if (portable && !isReleaseAssetUrl(downloadUrl)) {
    throw new UpdateValidationError(
      `Installation refusée : le package portable ne peut être mis à jour qu'avec l'archive compilée ${PORTABLE_ASSET_NAME}.`
    );
  }

  updateInProgress = true;
  const tempZipPath = path.join(appDir, TEMP_ZIP_NAME);
  const tempExtractDir = path.join(appDir, TEMP_EXTRACT_DIR_NAME);
  let handedOffToUpdater = false;

  const cleanupTemp = () => {
    try { fs.rmSync(tempZipPath, { force: true }); } catch { /* ignorer */ }
    try { fs.rmSync(tempExtractDir, { recursive: true, force: true }); } catch { /* ignorer */ }
  };

  try {
    cleanupTemp();
    console.log(`📥 Téléchargement de la mise à jour depuis GitHub : ${downloadUrl}`);

    const response = await fetchWithValidatedRedirects(downloadUrl, repo, AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS));
    if (!response.ok) {
      throw new Error(`Échec du téléchargement (HTTP ${response.status}).`);
    }

    const { sha256 } = await downloadToFile(response, tempZipPath);
    const expected = (options.expectedSha256 || "").toLowerCase().replace(/^sha256:/, "").trim();
    if (expected && expected !== sha256) {
      throw new UpdateValidationError("Empreinte SHA-256 invalide : l'archive téléchargée est corrompue ou altérée.");
    }

    const zip = new AdmZip(tempZipPath);
    assertSafeZipEntries(zip);
    zip.extractAllTo(tempExtractDir, true);

    const sourceDir = resolveSourceDir(tempExtractDir);
    if (portable) {
      validatePortablePackage(sourceDir);
    }

    const removed = stripProtectedEntries(sourceDir);
    if (removed.length > 0) {
      console.log(`🛡️ Entrées protégées retirées de l'archive (données locales préservées) : ${removed.join(", ")}`);
    }

    if (portable && process.platform === "win32") {
      const updaterPath = path.join(appDir, UPDATER_BAT_NAME);
      fs.writeFileSync(updaterPath, buildWindowsUpdaterScript({
        pid: process.pid,
        relativeSourceDir: path.relative(appDir, sourceDir),
        port: readCurrentPort()
      }), "utf-8");
      fs.writeFileSync(path.join(appDir, RELAUNCH_VBS_NAME), buildRelaunchVbsScript(), "utf-8");

      // Lancer le script dans une console indépendante, puis s'assurer qu'il a bien démarré
      // AVANT d'arrêter le serveur (sinon l'application resterait éteinte).
      const child = spawn("cmd.exe", ["/c", `start "" /min "${updaterPath}"`], {
        cwd: appDir,
        detached: true,
        stdio: "ignore",
        windowsHide: true,
        windowsVerbatimArguments: true
      });
      await new Promise<void>((resolve, reject) => {
        child.once("spawn", () => resolve());
        child.once("error", reject);
      });
      child.unref();
      handedOffToUpdater = true;

      // Arrêt gracieux (checkpoint SQLite, fermeture Chromium) après l'envoi de la réponse HTTP
      setTimeout(() => {
        performGracefulShutdown("UPDATE").finally(() => process.exit(0));
      }, 1500);

      return {
        success: true,
        restarting: true,
        message: "Téléchargement vérifié ! L'application redémarre avec la nouvelle version. Vos données locales sont préservées."
      };
    }

    // Installation de développement, macOS ou Linux : copie directe, redémarrage manuel
    copyUpdateFiles(sourceDir, appDir);
    cleanupObsoleteArtifacts(appDir);
    cleanupTemp();
    return {
      success: true,
      restarting: false,
      message: "Mise à jour installée avec succès (données locales préservées). Veuillez relancer l'application."
    };
  } catch (err) {
    if (!handedOffToUpdater) cleanupTemp();
    throw err;
  } finally {
    if (!handedOffToUpdater) updateInProgress = false;
  }
}
