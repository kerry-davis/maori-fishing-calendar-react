#!/usr/bin/env node
/**
 * Validate migrated photos by sampling a small set of migrated documents,
 * downloading the encrypted blob, and attempting to decrypt it using a
 * provided test key or per-user derived key (if available).
 *
 * Usage examples:
 *  SERVICE_ACCOUNT_PATH=./service-account.json node scripts/validate-migration-sample.js --progress migration-progress.json --limit 10 --dry-run
 *  SERVICE_ACCOUNT_PATH=./service-account.json node scripts/validate-migration-sample.js --sample 5 --encrypt-key <base64-key>
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const argv = yargs(hideBin(process.argv))
  .option('progress', { type: 'string', description: 'Progress JSON produced by migrate-legacy-photos.js' })
  .option('sample', { type: 'number', description: 'Number of samples to validate (default 5)', default: 5 })
  .option('limit', { type: 'number', description: 'Limit processed documents to scan if no progress file', default: 100 })
  .option('encrypt-key', { type: 'string', description: 'Base64 AES-256 key to test decryption (optional)' })
  .option('dry-run', { type: 'boolean', default: true })
  .help()
  .argv;

const { initAdmin } = require('./configure-firebase');

function deserializeMetadata(serialized) {
  try {
    const parsed = JSON.parse(Buffer.from(serialized, 'base64').toString('utf8'));
    if (parsed.iv) parsed.iv = Buffer.from(parsed.iv);
    return parsed;
  } catch (e) {
    // try legacy btoa/atob path
    try {
      const parsed2 = JSON.parse(Buffer.from(serialized, 'base64').toString('utf8'));
      if (parsed2.iv) parsed2.iv = Buffer.from(parsed2.iv);
      return parsed2;
    } catch (err) {
      throw new Error('Invalid metadata format');
    }
  }
}

async function tryDecrypt(buffer, key, metadata) {
  // Node crypto: ciphertext + auth tag appended
  const iv = Buffer.from(metadata.iv);
  const tagLength = 16;
  if (buffer.length < tagLength) throw new Error('Buffer too small');
  const tag = buffer.slice(buffer.length - tagLength);
  const ciphertext = buffer.slice(0, buffer.length - tagLength);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  try {
    const out = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    // verify hash if available
    if (metadata.hash) {
      const h = crypto.createHash('sha256').update(out).digest('hex');
      if (h !== metadata.hash) throw new Error('Hash mismatch after decrypt');
    }
    return { ok: true, data: out };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

async function run() {
  const adminInit = initAdmin();
  const firestore = adminInit.firestore;
  const storage = adminInit.storage;
  const bucket = storage.bucket(process.env.FIREBASE_STORAGE_BUCKET || '');

  const sampleCount = argv.sample;
  const limit = argv.limit;
  const progressPath = argv.progress ? path.resolve(argv.progress) : null;
  const encryptKeyB64 = argv['encrypt-key'];
  const encryptKey = encryptKeyB64 ? Buffer.from(encryptKeyB64, 'base64') : null;

  const candidates = [];
  if (progressPath && fs.existsSync(progressPath)) {
    const progress = JSON.parse(fs.readFileSync(progressPath, 'utf8'));
    for (const [docId, info] of Object.entries(progress.processed || {})) {
      if (info && info.status === 'success' && info.photoPath) {
        candidates.push({ docId, photoPath: info.photoPath, encryptedMetadata: info.encryptedMetadata });
      }
    }
  } else {
    // scan collection up to limit
    const col = firestore.collection('fishCaught').limit(limit);
    const snap = await col.get();
    snap.forEach(doc => {
      const d = doc.data();
      if (d.photoPath && d.photoPath.includes('/enc_photos/')) {
        candidates.push({ docId: doc.id, photoPath: d.photoPath, encryptedMetadata: d.encryptedMetadata });
      }
    });
  }

  if (!candidates.length) {
    console.log('No migrated candidates found to validate');
    return;
  }

  const samples = candidates.slice(0, sampleCount);
  const results = [];
  for (const s of samples) {
    const file = bucket.file(s.photoPath);
    if (!(await file.exists())[0]) {
      results.push({ docId: s.docId, ok: false, error: 'Storage object not found' });
      continue;
    }
    const [buf] = await file.download();
    if (!s.encryptedMetadata && !encryptKey) {
      results.push({ docId: s.docId, ok: false, error: 'No metadata and no test key' });
      continue;
    }
    const metadata = s.encryptedMetadata ? deserializeMetadata(s.encryptedMetadata) : null;
    const keyToTry = encryptKey || null;
    if (!keyToTry) {
      results.push({ docId: s.docId, ok: false, error: 'No key available to test decryption' });
      continue;
    }
    const outcome = await tryDecrypt(buf, keyToTry, metadata);
    results.push({ docId: s.docId, ok: outcome.ok, error: outcome.ok ? null : outcome.error });
  }

  console.log('Validation results:', JSON.stringify(results, null, 2));
  if (!argv['dry-run']) {
    // Save a report
    fs.writeFileSync('migration-validation-report.json', JSON.stringify({ timestamp: Date.now(), results }, null, 2));
    console.log('Saved migration-validation-report.json');
  }
}

run().catch(err => {
  console.error('Validation failed:', err);
  process.exit(1);
});
