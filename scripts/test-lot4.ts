import gcsurplusScraper from '../scrapers/gcsurplus.ts';
import seaoScraper from '../scrapers/seao.ts';
import insertechInternalScraper from '../scrapers/insertech-internal.ts';
import insertechArchivesScraper from '../scrapers/insertech-archives.ts';
import { closeSharedBrowser } from '../scrapers/browser-emulator.ts';

async function testLot4() {
  const model = 'ThinkPad T480';
  console.log(`\n======================================================`);
  console.log(`🚀 DÉMARRAGE AUDIT COMPLET LOT 4 : "${model}"`);
  console.log(`======================================================\n`);

  const scrapers = [
    { scraper: gcsurplusScraper, testModel: model },
    { scraper: seaoScraper, testModel: model },
    { scraper: insertechInternalScraper, testModel: model },
    { scraper: insertechArchivesScraper, testModel: model },
  ];

  const results: any[] = [];
  const globalT0 = Date.now();

  for (const { scraper, testModel } of scrapers) {
    console.log(`\n🔍 Test du scraper : [${scraper.sourceKey}] "${scraper.name}" (Modèle : "${testModel}")...`);
    const t0 = Date.now();
    try {
      const res = await scraper.scrape(testModel, (m) => console.log(`   [LOG] ${m}`));
      const elapsed = Date.now() - t0;
      results.push({
        source: scraper.name,
        sourceKey: scraper.sourceKey,
        testModel,
        success: res.success,
        count: res.listings.length,
        method: res.method,
        elapsedMs: elapsed,
        sampleListings: res.listings.slice(0, 3).map(l => ({ price: l.price, title: l.title })),
      });
      console.log(`   ⏱️ Durée : ${elapsed}ms | Succès : ${res.success} | Annonces : ${res.listings.length} | Méthode : ${res.method}`);
      if (res.listings.length > 0) {
        res.listings.slice(0, 3).forEach((l, i) => {
          console.log(`      #${i+1}: [${l.price}$ CAD] ${l.title.slice(0, 70)}...`);
        });
      }
    } catch (err: any) {
      const elapsed = Date.now() - t0;
      results.push({
        source: scraper.name,
        sourceKey: scraper.sourceKey,
        testModel,
        success: false,
        count: 0,
        method: 'error',
        elapsedMs: elapsed,
        error: err.message,
      });
      console.error(`   ❌ Échec : ${err.message} (${elapsed}ms)`);
    }
  }

  await closeSharedBrowser();
  const totalElapsed = Date.now() - globalT0;

  console.log(`\n======================================================`);
  console.log(`📊 BILAN COMPLET LOT 4 (Temps total : ${totalElapsed}ms) :`);
  console.log(`======================================================`);
  console.table(results.map(r => ({
    Source: r.sourceKey,
    Modèle: r.testModel,
    Succès: r.success ? 'OUI' : 'NON',
    Listings: r.count,
    Méthode: r.method,
    Durée: `${r.elapsedMs}ms`,
  })));

  process.exit(0);
}

testLot4().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
