#!/usr/bin/env node
/* Inventory script for legacy photos */

const fs = require('fs');
const path = require('path');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

const argv = yargs(hideBin(process.argv))
  .option('dry-run', { type: 'boolean', default: true })
  .option('page-size', { type: 'number', default: 500 })
  .option('out', { type: 'string', default: 'inventory-report.json' })
  .option('csv', { type: 'boolean', default: false })
  .help()
  .argv;

const { initAdmin } = require('./configure-firebase');

async function run() {
  const { firestore } = initAdmin();

  const pageSize = argv['page-size'];
  const outPath = path.resolve(argv.out);
  const dryRun = argv['dry-run'];
  const asCsv = argv['csv'];

  console.log('Starting inventory (dry-run=%s) ...', dryRun);

  const collectionRef = firestore.collection('fishCaught');
  let lastDoc = null;
  let totalScanned = 0;
  let totalLegacy = 0;
  const samples = [];
  const rows = [];

  while (true) {
    let query = collectionRef.orderBy('id').limit(pageSize);
    if (lastDoc) query = query.startAfter(lastDoc);
    const snapshot = await query.get();
    if (snapshot.empty) break;

    for (const doc of snapshot.docs) {
      totalScanned++;
      const d = doc.data();
      const hasInlinePhoto = typeof d.photo === 'string' && d.photo.startsWith('data:');
      const hasPhotoPath = typeof d.photoPath === 'string' && d.photoPath.length > 0;
      const isEncrypted = typeof d.encryptedMetadata === 'string' && d.encryptedMetadata.length > 0;
      const legacyPhotoPath = hasPhotoPath && d.photoPath.includes('/images/');

      if (hasInlinePhoto || (hasPhotoPath && legacyPhotoPath) || !isEncrypted) {
        totalLegacy++;
        if (samples.length < 200) {
          samples.push({ id: doc.id, data: { photo: !!d.photo, photoPath: d.photoPath || null, encryptedMetadata: !!d.encryptedMetadata } });
        }
        rows.push({ id: doc.id, photo: !!d.photo, photoPath: d.photoPath || '', encryptedMetadata: !!d.encryptedMetadata });
      }
    }

    lastDoc = snapshot.docs[snapshot.docs.length - 1];
    if (snapshot.size < pageSize) break;
  }

  const report = {
    scanned: totalScanned,
    legacyCount: totalLegacy,
    sampleCount: samples.length,
    samples
  };

  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log('Inventory written to', outPath);
  console.log('Scanned %d documents; %d legacy photo candidates found', totalScanned, totalLegacy);
  if (asCsv) {
    const csvPath = outPath.replace(/\.json$/i, '.csv');
    const header = 'id,photo,photoPath,encryptedMetadata\n';
    const csv = rows.map(r => `${r.id},${r.photo},"${(r.photoPath||'').replace(/"/g,'""')}",${r.encryptedMetadata}`).join('\n');
    fs.writeFileSync(csvPath, header + csv);
    console.log('CSV summary written to', csvPath);
  }

  if (dryRun) console.log('Dry-run mode: no changes were made.');
}

run().catch(err => {
  console.error('Inventory failed:', err);
  process.exit(1);
});
