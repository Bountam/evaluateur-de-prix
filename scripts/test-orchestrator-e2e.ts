import { orchestrateScraping } from '../scrapers/orchestrator.ts';
import { closeSharedBrowser } from '../scrapers/browser-emulator.ts';

async function testE2E() {
  const model = 'ThinkPad T480';
  console.log(`\n======================================================`);
  console.log(`🚀 TEST E2E ORCHESTRATEUR COMPLET (16 SOURCES) : "${model}"`);
  console.log(`======================================================\n`);

  const t0 = Date.now();
  const result = await orchestrateScraping(
    model,
    'Ordinateurs portables',
    (msg) => console.log(`   [LOG] ${msg}`),
    (res, done, total) => {
      console.log(`   ⚡ Source terminée (${done}/${total}): [${res.sourceKey}] "${res.source}" -> ${res.listings.length} annonces (${res.method})`);
    },
    4 // Concurrency = 4
  );

  await closeSharedBrowser();
  const elapsed = Date.now() - t0;

  console.log(`\n======================================================`);
  console.log(`📊 RÉSULTATS GLOBAUX EN ${elapsed}ms :`);
  console.log(`======================================================`);
  console.log(`  - Sources totales : ${result.totalSources}`);
  console.log(`  - Sources avec succès : ${result.successfulSources}`);
  console.log(`  - Annonces totales retenues : ${result.totalListings}`);
  console.log(`  - Médiane calculée : ${result.medianPrice}$ CAD`);
  console.log(`  - Indice de confiance : ${result.confidence}`);

  console.log(`\n📋 DÉTAIL PAR SOURCE :`);
  console.table(result.sourceResults.map(s => ({
    Source: s.sourceKey,
    Succès: s.success ? 'OUI' : 'NON',
    Listings: s.count,
    Méthode: s.method,
    Erreur: s.error || '-',
  })));

  if (result.allListings.length > 0) {
    console.log(`\n🏷️ TOP 5 ANNONCES RETENUES :`);
    result.allListings.slice(0, 5).forEach((l, i) => {
      console.log(`   #${i + 1}: [${l.price}$ CAD] [${l.sourceKey}] ${l.title} (${l.condition || 'N/A'})`);
    });
  }

  process.exit(0);
}

testE2E().catch((err) => {
  console.error('Fatal E2E error:', err);
  process.exit(1);
});
