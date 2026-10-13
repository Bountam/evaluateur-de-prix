const fs = require('fs');
const path = require('path');
const https = require('https');
const { spawnSync } = require('child_process');

function uploadSingleAsset(filePath, assetName, releaseId, repo, token, headers) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️ Fichier introuvable pour upload : ${filePath}`);
      return resolve(false);
    }
    const fileSize = fs.statSync(filePath).size;
    console.log(`\n📦 Préparation du téléversement de ${assetName} (${(fileSize / 1024 / 1024).toFixed(1)} Mo)...`);

    const uploadUrl = new URL(`https://uploads.github.com/repos/${repo}/releases/${releaseId}/assets?name=${encodeURIComponent(assetName)}`);

    const reqOptions = {
      hostname: uploadUrl.hostname,
      port: 443,
      path: uploadUrl.pathname + uploadUrl.search,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'Evaluateur-De-Prix-App',
        'Content-Type': 'application/zip',
        'Content-Length': fileSize
      }
    };

    const req = https.request(reqOptions, (res) => {
      let responseBody = '';
      res.on('data', chunk => { responseBody += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`\n✅ Téléversement réussi pour ${assetName} (HTTP ${res.statusCode}) !`);
          try {
            const parsed = JSON.parse(responseBody);
            console.log(`🎉 Asset attaché : ${parsed.name} (${(parsed.size / 1024 / 1024).toFixed(1)} Mo)`);
            console.log(`🔗 URL : ${parsed.browser_download_url}`);
          } catch {
            console.log(responseBody);
          }
          resolve(true);
        } else {
          console.error(`\n❌ Échec du téléversement de ${assetName} (HTTP ${res.statusCode}):`, responseBody);
          reject(new Error(`Upload failed with status ${res.statusCode}`));
        }
      });
    });

    req.on('error', (err) => {
      console.error(`\n❌ Erreur réseau pendant le téléversement de ${assetName} :`, err);
      reject(err);
    });

    let uploadedBytes = 0;
    let lastPct = -1;
    const readStream = fs.createReadStream(filePath, { highWaterMark: 2 * 1024 * 1024 });

    readStream.on('data', (chunk) => {
      uploadedBytes += chunk.length;
      const pct = Math.floor((uploadedBytes / fileSize) * 100);
      if (pct !== lastPct) {
        lastPct = pct;
        process.stdout.write(`\r⏳ Envoi [${assetName}] : ${pct}% (${(uploadedBytes / 1024 / 1024).toFixed(1)} / ${(fileSize / 1024 / 1024).toFixed(1)} Mo)...`);
      }
    });

    readStream.on('error', err => req.destroy(err));
    readStream.pipe(req);
  });
}

async function main() {
  const pkg = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf-8'));
  const repo = process.env.GITHUB_REPO || 'Bountam/evaluateur-de-prix';
  const tag = process.argv[2] || `v${pkg.version}`;

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

  const headers = {
    'Authorization': `Bearer ${token}`,
    'User-Agent': 'Evaluateur-De-Prix-App',
    'Accept': 'application/vnd.github+json'
  };

  // 2. Récupération ou création de la release
  console.log(`🔍 Recherche de la release ${tag} sur GitHub (${repo})...`);
  let relRes = await fetch(`https://api.github.com/repos/${repo}/releases/tags/${tag}`, { headers });
  let releaseData;

  const releaseTitle = `Évaluateur de Prix ${tag}`;
  const releaseBody = `### Nouveautés de la version ${tag} :
- **Sécurité & Durcissement** : Validation stricte des origines CORS (\`localhost\`, \`127.0.0.1\`, \`file://\`, blocage 403 sur pré-vols non autorisés), protection anti-OOM/DoS sur \`/api/import-preview\` (plafond 20 Mo et limiteur intensif), blocage des attaques par pollution de prototype (\`__proto__\`, \`constructor\`) sur \`/api/models/add\`, retrait des flags Chromium non sécurisés et assainissement ReDoS des expressions régulières de scraping.
- **Résilience & Gestion SQLite** : Sérialisation universelle des écritures concurrentes via verrou exclusif (\`withDBLock\`), respect strict du principe CQS dans \`readDB()\` sans écriture parasite en lecture, et bornage du repli de port dynamique à 10 tentatives max.
- **Performances & Fluidité UI** : Isolation complète du cycle de rendu de l'horloge via le composant \`ClockHeader\` (élimination du re-render complet de l'interface chaque seconde), optimisation de l'algorithme IQR de détection des prix aberrants et suppression de code mort.
- **Validation & Fiabilité** : 144/144 tests unitaires, d'intégration et de sécurité validés avec succès (100% de réussite).
- **Double archive de mise à jour** : Déploiement simultané pour toutes les versions antérieures (\`evaluateur-de-prix-portable.zip\` et \`evaluateur-insertech-portable.zip\`).`;

  if (relRes.status === 404) {
    console.log(`✨ Release ${tag} inexistante. Création automatique de la release sur GitHub...`);
    const createRes = await fetch(`https://api.github.com/repos/${repo}/releases`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tag_name: tag,
        name: releaseTitle,
        body: releaseBody,
        draft: false,
        prerelease: false
      })
    });
    if (!createRes.ok) {
      console.error(`❌ Échec de la création de la release (HTTP ${createRes.status}):`, await createRes.text());
      process.exit(1);
    }
    releaseData = await createRes.json();
    console.log(`✔️ Release ${tag} créée avec succès (ID: ${releaseData.id})`);
  } else if (!relRes.ok) {
    console.error(`❌ Échec de la récupération de la release (HTTP ${relRes.status}):`, await relRes.text());
    process.exit(1);
  } else {
    releaseData = await relRes.json();
    console.log(`✔️ Release identifiée (ID: ${releaseData.id})`);

    // Mettre à jour titre et description si déjà existant
    await fetch(`https://api.github.com/repos/${repo}/releases/${releaseData.id}`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: releaseTitle,
        body: releaseBody
      })
    });
  }
  const releaseId = releaseData.id;

  // Liste des fichiers à attacher (générique + rétrocompatibilité v1.5.0)
  const filesToUpload = [
    {
      filePath: path.resolve('evaluateur-de-prix-portable.zip'),
      assetName: 'evaluateur-de-prix-portable.zip'
    },
    {
      filePath: path.resolve('evaluateur-insertech-portable.zip'),
      assetName: 'evaluateur-insertech-portable.zip'
    }
  ];

  for (const item of filesToUpload) {
    // Supprimer l'asset existant du même nom si présent
    const existingAsset = (releaseData.assets || []).find(a => a.name === item.assetName);
    if (existingAsset) {
      console.log(`🗑️ Suppression de l'asset existant ${item.assetName} (ID: ${existingAsset.id})...`);
      await fetch(`https://api.github.com/repos/${repo}/releases/assets/${existingAsset.id}`, {
        method: 'DELETE',
        headers
      });
    }

    await uploadSingleAsset(item.filePath, item.assetName, releaseId, repo, token, headers);
  }

  console.log(`\n🎉 Release ${tag} complètement configurée et prête sur GitHub Releases !`);
}

main().catch(err => {
  console.error('❌ Erreur inattendue :', err);
  process.exit(1);
});
