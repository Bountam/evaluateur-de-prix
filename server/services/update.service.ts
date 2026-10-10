import fs from "fs";
import path from "path";
import { exec } from "child_process";
import AdmZip from "adm-zip";

export function isNewerVersion(latest: string, current: string): boolean {
  if (!latest) return false;
  const lParts = latest.split('.').map(Number);
  const cParts = current.split('.').map(Number);
  for (let i = 0; i < Math.max(lParts.length, cParts.length); i++) {
    const l = lParts[i] || 0;
    const c = cParts[i] || 0;
    if (l > c) return true;
    if (l < c) return false;
  }
  return false;
}

export async function checkApplicationUpdate(currentVersion: string, repo: string) {
  let latestTag = "";
  let releaseNotes = "";
  let downloadUrl = "";
  let publishedAt = "Récemment";
  let githubUrl = `https://github.com/${repo}`;

  try {
    const relResponse = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
      headers: {
        "User-Agent": "Evaluateur-Insertech-App",
        "Accept": "application/vnd.github.v3+json"
      }
    });

    if (relResponse.ok) {
      const releaseData = await relResponse.json() as any;
      latestTag = (releaseData.tag_name || "").replace(/^v/, "");
      releaseNotes = releaseData.body || "Mise à jour de sécurité et de performances Insertech.";
      publishedAt = releaseData.published_at ? new Date(releaseData.published_at).toLocaleDateString("fr-CA") : "Récemment";
      githubUrl = releaseData.html_url || githubUrl;

      const zipAsset = (releaseData.assets || []).find((a: any) => a.name.endsWith(".zip")) || null;
      downloadUrl = zipAsset ? zipAsset.browser_download_url : releaseData.zipball_url;
    } else {
      const tagsResponse = await fetch(`https://api.github.com/repos/${repo}/tags`, {
        headers: {
          "User-Agent": "Evaluateur-Insertech-App",
          "Accept": "application/vnd.github.v3+json"
        }
      });

      if (tagsResponse.ok) {
        const tagsData = await tagsResponse.json() as any[];
        if (Array.isArray(tagsData) && tagsData.length > 0) {
          latestTag = (tagsData[0].name || "").replace(/^v/, "");
          downloadUrl = tagsData[0].zipball_url || `https://github.com/${repo}/archive/refs/tags/${tagsData[0].name}.zip`;
          releaseNotes = `Nouvelle version v${latestTag} disponible sur le dépôt GitHub.`;
        }
      }
    }

    const hasUpdate = isNewerVersion(latestTag, currentVersion);

    return {
      success: true,
      hasUpdate,
      currentVersion,
      latestVersion: latestTag || currentVersion,
      releaseNotes: releaseNotes || (hasUpdate ? `Mise à jour v${latestTag} prête.` : `Votre version v${currentVersion} est à jour.`),
      downloadUrl,
      publishedAt,
      githubUrl,
      lastChecked: new Date().toISOString()
    };
  } catch (e: any) {
    return {
      success: true,
      hasUpdate: false,
      currentVersion,
      latestVersion: currentVersion,
      releaseNotes: `Version v${currentVersion} active. (Impossible de contacter GitHub: ${e.message})`,
      lastChecked: new Date().toISOString()
    };
  }
}

export async function performApplicationUpdate(downloadUrl: string): Promise<{ success: boolean; message: string }> {
  console.log(`📥 Téléchargement de la mise à jour depuis GitHub: ${downloadUrl}`);
  const response = await fetch(downloadUrl, {
    headers: { "User-Agent": "Evaluateur-Insertech-App" }
  });

  if (!response.ok) {
    throw new Error(`Échec du téléchargement HTTP ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const tempZipPath = path.join(process.cwd(), "update_temp.zip");
  const tempExtractDir = path.join(process.cwd(), "update_extracted_temp");

  fs.writeFileSync(tempZipPath, buffer);

  if (fs.existsSync(tempExtractDir)) {
    fs.rmSync(tempExtractDir, { recursive: true, force: true });
  }

  const zip = new AdmZip(tempZipPath);
  zip.extractAllTo(tempExtractDir, true);

  let sourceDir = tempExtractDir;
  const subItems = fs.readdirSync(tempExtractDir);
  if (subItems.length === 1 && fs.statSync(path.join(tempExtractDir, subItems[0])).isDirectory()) {
    sourceDir = path.join(tempExtractDir, subItems[0]);
  } else if (subItems.includes("evaluateur-insertech-portable")) {
    sourceDir = path.join(tempExtractDir, "evaluateur-insertech-portable");
  }

  if (process.platform === "win32") {
    const updaterBat = `@echo off
timeout /t 1 /nobreak > nul
taskkill /f /im node.exe > nul 2>&1
xcopy /e /y /q "${sourceDir}\\*" "%~dp0"
rmdir /s /q "${tempExtractDir}" > nul 2>&1
del /f /q "${tempZipPath}" > nul 2>&1
start "" wscript.exe "%~dp0Lancer-Insertech-GUI.vbs"
del "%~f0"
`;
    const updaterPath = path.join(process.cwd(), "apply_update.bat");
    fs.writeFileSync(updaterPath, updaterBat, "utf-8");

    setTimeout(() => {
      exec(`cmd.exe /c start "" /min "${updaterPath}"`, () => {
        process.exit(0);
      });
    }, 1000);

    return {
      success: true,
      message: "Téléchargement terminé ! L'application va se fermer et se relancer automatiquement avec la nouvelle version dans 3 secondes."
    };
  } else {
    const copyRecursive = (src: string, dest: string) => {
      const entries = fs.readdirSync(src, { withFileTypes: true });
      for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
          if (!fs.existsSync(destPath)) {
            fs.mkdirSync(destPath, { recursive: true });
          }
          copyRecursive(srcPath, destPath);
        } else {
          fs.copyFileSync(srcPath, destPath);
        }
      }
    };

    copyRecursive(sourceDir, process.cwd());
    fs.unlinkSync(tempZipPath);
    fs.rmSync(tempExtractDir, { recursive: true, force: true });

    return {
      success: true,
      message: "Mise à jour téléchargée et installée avec succès ! Veuillez relancer l'application."
    };
  }
}
