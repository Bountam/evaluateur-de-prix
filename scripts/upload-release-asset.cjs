const fs = require('fs');
const path = require('path');
const https = require('https');
const { spawnSync } = require('child_process');

async function main() {
  const filePath = path.resolve('evaluateur-insertech-portable.zip');
  if (!fs.existsSync(filePath)) {
    console.error('❌ Fichier introuvable :', filePath);
    process.exit(1);
  }
  const fileSize = fs.statSync(filePath).size;
  console.log(`📦 Fichier à téléverser : ${filePath} (${(fileSize / 1024 / 1024).toFixed(1)} Mo)`);

  // 1. Récupération dynamique du token GitHub
  const gitCred = spawnSync('git', ['credential', 'fill'], {
    input: 'protocol=https\nhost=github.com\n',
    encoding: 'utf-8'
  });
  const match = gitCred.stdout ? gitCred.stdout.match(/password=(.+)/) : null;
  const token = match ? match[1].trim() : null;

  if (!token) {
    console.error('❌ Impossible de récupérer le token GitHub via git credential manager.');
    process.exit(1);
  }

  const pkg = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf-8'));
  const repo = process.env.GITHUB_REPO || 'Bountam/evaluateur-de-prix';
  const tag = process.argv[2] || `v${pkg.version}`;
  const headers = {
    'Authorization': `Bearer ${token}`,
    'User-Agent': 'Evaluateur-Insertech-App',
    'Accept': 'application/vnd.github+json'
  };

  // 2. Récupération de la release
  console.log(`🔍 Recherche de la release ${tag} sur GitHub...`);
  const relRes = await fetch(`https://api.github.com/repos/${repo}/releases/tags/${tag}`, { headers });
  if (!relRes.ok) {
    console.error(`❌ Échec de la récupération de la release (HTTP ${relRes.status}):`, await relRes.text());
    process.exit(1);
  }
  const releaseData = await relRes.json();
  const releaseId = releaseData.id;
  console.log(`✔️ Release identifiée (ID: ${releaseId})`);

  // Supprimer un asset existant du même nom si présent
  const existingAsset = (releaseData.assets || []).find(a => a.name === 'evaluateur-insertech-portable.zip');
  if (existingAsset) {
    console.log(`🗑️ Suppression de l'asset existant (ID: ${existingAsset.id})...`);
    await fetch(`https://api.github.com/repos/${repo}/releases/assets/${existingAsset.id}`, {
      method: 'DELETE',
      headers
    });
  }

  // 3. Téléversement en flux continu (Streaming)
  console.log(`🚀 Début du téléversement vers uploads.github.com...`);
  const uploadUrl = new URL(`https://uploads.github.com/repos/${repo}/releases/${releaseId}/assets?name=evaluateur-insertech-portable.zip`);

  const reqOptions = {
    hostname: uploadUrl.hostname,
    port: 443,
    path: uploadUrl.pathname + uploadUrl.search,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'User-Agent': 'Evaluateur-Insertech-App',
      'Content-Type': 'application/zip',
      'Content-Length': fileSize
    }
  };

  const req = https.request(reqOptions, (res) => {
    let responseBody = '';
    res.on('data', chunk => { responseBody += chunk; });
    res.on('end', () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        console.log(`\n✅ Téléversement réussi (HTTP ${res.statusCode}) !`);
        try {
          const parsed = JSON.parse(responseBody);
          console.log(`🎉 Asset attaché : ${parsed.name} (${(parsed.size / 1024 / 1024).toFixed(1)} Mo)`);
          console.log(`🔗 URL : ${parsed.browser_download_url}`);
        } catch {
          console.log(responseBody);
        }
      } else {
        console.error(`\n❌ Échec du téléversement (HTTP ${res.statusCode}):`, responseBody);
        process.exit(1);
      }
    });
  });

  req.on('error', (err) => {
    console.error('\n❌ Erreur réseau pendant le téléversement :', err);
    process.exit(1);
  });

  let uploadedBytes = 0;
  let lastPct = -1;
  const readStream = fs.createReadStream(filePath, { highWaterMark: 2 * 1024 * 1024 });

  readStream.on('data', (chunk) => {
    uploadedBytes += chunk.length;
    const pct = Math.floor((uploadedBytes / fileSize) * 100);
    if (pct !== lastPct) {
      lastPct = pct;
      process.stdout.write(`\r⏳ Envoi en cours : ${pct}% (${(uploadedBytes / 1024 / 1024).toFixed(1)} / ${(fileSize / 1024 / 1024).toFixed(1)} Mo)...`);
    }
  });

  readStream.pipe(req);
}

main().catch(err => {
  console.error('❌ Erreur inattendue :', err);
  process.exit(1);
});
