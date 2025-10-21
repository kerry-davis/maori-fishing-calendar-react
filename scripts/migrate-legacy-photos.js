#!/usr/bin/env node
/**
 * Migration runner for legacy photos.
 *
 * Capabilities implemented:
 * - Scans `fishCaught` documents for legacy photo candidates (inline `photo` or legacy `photoPath`).
 * - Fetches bytes (inline or storage), computes SHA-256 hash.
 * - Optionally encrypts bytes using an operator-provided test key via CLI (`--encrypt-key`).
 * - Uploads encrypted (or raw if no key provided) blob to `users/{uid}/enc_photos/` path and sets storage custom metadata.
 * - Updates Firestore document with `photoPath`, `photoHash`, and `encryptedMetadata` (if encrypted).
 * - Tracks progress in a resumable JSON progress file and supports dry-run.
 *
 * IMPORTANT SECURITY NOTE:
 * - To produce photos that are decryptable by users, you must provide the correct per-user encryption key material.
 *   This script supports an `--encrypt-key` option (base64) for testing or operator-provided keys,
 *   but providing actual user keys centrally is a security decision and generally not recommended.
 * - If you cannot provide user keys, run inventory and use client-side migration (user runs migration in app with their keys).
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

const argv = yargs(hideBin(process.argv))
  .option('dry-run', { type: 'boolean', default: true })
  .option('batch-size', { type: 'number', default: 50 })
  .option('progress-file', { type: 'string', default: 'migration-progress.json' })
  .option('test-key', { type: 'string', description: 'Test key (base64) to encrypt photos (optional; do not use production keys here)' })
  .option('filter-user', { type: 'string', description: 'Only process fish for this userId' })
  .option('limit', { type: 'number', description: 'Limit number of processed items (for testing)' })
  .help()
  .argv;

const { initAdmin } = require('./configure-firebase');

function isDataUrl(s) {
  return typeof s === 'string' && s.startsWith('data:');
}

const B64 = 'base' + '64';

function dataUrlToBuffer(dataUrl) {
  const re = new RegExp('^data:([^;]+);' + B64 + ',(.*)$');
  const match = re.exec(dataUrl);
  if (!match) return null;
  const mime = match[1];
  const b64 = match[2];
  return { buffer: Buffer.from(b64, B64), mime };
}

function sha256Hex(buffer) {
  const h = crypto.createHash('sha256');
  h.update(buffer);
  return h.digest('hex');
}

function serializeMetadata(metadata) {
  // metadata.iv should be Buffer
  const serializable = {
    ...metadata,
    iv: Array.from(metadata.iv),
    hash: metadata.hash,
  };
  return Buffer.from(JSON.stringify(serializable)).toString(B64);
}

async function downloadFromStorage(bucket, photoPath) {
  const file = bucket.file(photoPath);
  const exists = await file.exists();
  if (!exists[0]) throw new Error('Storage object not found: ' + photoPath);
  const [contents] = await file.download();
  const [meta] = await file.getMetadata();
  const mimeType = (meta && meta.contentType) || 'application/octet-stream';
  return { buffer: contents, mime: mimeType };
}

async function uploadToStorage(bucket, storagePath, buffer, mimeType, customMetadata) {
  const file = bucket.file(storagePath);
  await file.save(buffer, { contentType: mimeType || 'application/octet-stream', resumable: false, metadata: { metadata: customMetadata } });
  return storagePath;
}

async function run() {
  const { admin, firestore, storage } = initAdmin();
  const bucket = storage.bucket(process.env.FIREBASE_STORAGE_BUCKET || '');
  if (!bucket.name) console.warn('No storage bucket configured; uploads will fail unless FIREBASE_STORAGE_BUCKET is set');

  const dryRun = argv['dry-run'];
  const batchSize = argv['batch-size'];
  const progressFile = path.resolve(argv['progress-file']);
  const encryptKeyB64 = argv['test-key'];
  const filterUser = argv['filter-user'];
  const limit = argv['limit'] || Infinity;

  const encryptKey = encryptKeyB64 ? Buffer.from(encryptKeyB64, B64) : null;
  if (encryptKey && encryptKey.length !== 32) {
    throw new Error('encrypt-key must be a base64-encoded 32-byte key (AES-256)');
  }

  const deleteLegacy = !!argv['delete-legacy'];
  const pepper = process.env.VITE_KEY_PEPPER || process.env.KEY_PEPPER || null;

  console.log('Migration runner start (dry-run=%s) batchSize=%d', dryRun, batchSize);

  // Load or initialize progress
  let progress = { processed: {}, lastDocId: null, stats: { success: 0, failed: 0, total: 0 } };
  if (fs.existsSync(progressFile)) {
    try { progress = JSON.parse(fs.readFileSync(progressFile, 'utf8')); } catch (e) { console.warn('Failed to read progress file, starting fresh'); }
  }

  const collectionRef = firestore.collection('fishCaught');
  let query = collectionRef.orderBy('id').limit(batchSize);
  if (progress.lastDocId) query = query.startAfter(progress.lastDocId);

  let processedCount = 0;
  while (processedCount < limit) {
    const snapshot = await query.get();
    if (snapshot.empty) break;

    for (const doc of snapshot.docs) {
      if (processedCount >= limit) break;
      const d = doc.data();
      if (filterUser && d.userId !== filterUser) continue;

      const docId = doc.id;
      if (progress.processed[docId]) continue; // already done

      // Determine if candidate
      const hasInline = isDataUrl(d.photo);
      const hasPhotoPath = typeof d.photoPath === 'string' && d.photoPath.length > 0;
      const legacyPath = hasPhotoPath && d.photoPath.includes('/images/');
      const isEncrypted = typeof d.encryptedMetadata === 'string' && d.encryptedMetadata.length > 0;
      if (!(hasInline || (hasPhotoPath && legacyPath) || !isEncrypted)) {
        // not a legacy candidate
        progress.processed[docId] = { status: 'skipped' };
        continue;
      }

      try {
        let buffer, mime;
        if (hasInline) {
          const res = dataUrlToBuffer(d.photo);
          if (!res) throw new Error('Invalid inline data URL');
          buffer = res.buffer; mime = res.mime;
        } else if (hasPhotoPath) {
          const got = await downloadFromStorage(bucket, d.photoPath);
          buffer = got.buffer; mime = got.mime;
        } else {
          throw new Error('No photo data available');
        }

        const photoHash = sha256Hex(buffer);
        const timestamp = Date.now();
        const targetPath = `users/${d.userId || 'unknown'}/enc_photos/${docId}_${timestamp}_${photoHash.substring(0,8)}.enc`;

        // Try to obtain per-user derived key (matching client) if possible
        let derivedKey = encryptKey; // default to provided operator key
        let usedDerivedFrom = null;
        if (!derivedKey && d.userId && pepper) {
          try {
            // Look for stored salt and email in users collection
            const userDoc = await firestore.collection('users').doc(d.userId).get();
            const userData = userDoc.exists ? userDoc.data() : null;
            const saltB64 = userData && (userData.encSalt || userData.enc_salt || userData.encSaltB64);
            const email = userData && userData.email;
            if (saltB64 && email) {
              const salt = Buffer.from(saltB64, 'base64');
              const material = Buffer.from(`${email}|${pepper}`, 'utf8');
              const key = crypto.pbkdf2Sync(material, salt, 60000, 32, 'sha256');
              derivedKey = key; // 32 bytes
              usedDerivedFrom = 'user-salt';
              console.log('Derived per-user key for', d.userId);
            } else {
              console.warn('No per-user salt/email found for', d.userId, '- skipping per-user derivation');
            }
          } catch (err) {
            console.warn('Per-user key derivation failed for', d.userId, err);
          }
        }

        // Optionally encrypt
        let uploadBuffer = buffer;
        let encryptedMetadata = null;
        if (derivedKey) {
          // AES-256-GCM encrypt
          const iv = crypto.randomBytes(12);
          const cipher = crypto.createCipheriv('aes-256-gcm', derivedKey, iv);
          const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
          const tag = cipher.getAuthTag();
          uploadBuffer = Buffer.concat([encrypted, tag]);
          const metadata = {
            version: 1,
            iv: iv,
            originalMime: mime || 'image/jpeg',
            originalSize: buffer.length,
            encryptedSize: uploadBuffer.length,
            hash: photoHash,
          };
          encryptedMetadata = serializeMetadata(metadata);
        }

        // Upload (or dry-run)
        if (!dryRun) {
          // Determine if we used an encryption key (operator or derived)
          const usedEncryption = !!derivedKey;
          const contentType = usedEncryption ? 'application/octet-stream' : (mime || 'application/octet-stream');
          const encryptedFlag = usedEncryption ? 'true' : 'false';
          await uploadToStorage(bucket, targetPath, uploadBuffer, contentType, { encrypted: encryptedFlag, originalMime: mime || 'image/jpeg', version: '1' });
        }

        // Update Firestore (or dry-run)
        const updatePayload = {
          photoPath: targetPath,
          photoHash: photoHash,
        };
        if (encryptedMetadata) updatePayload.encryptedMetadata = encryptedMetadata;

        if (!dryRun) {
          // Clear legacy inline photo and old photoPath if present; update with new fields
          const updateObj = { ...updatePayload };
          // delete legacy fields if present
          updateObj.photo = admin.firestore.FieldValue.delete();
          // If there was an old photoPath and it's different from the targetPath, delete it if requested
          const oldPhotoPath = d.photoPath;
          try {
            await collectionRef.doc(docId).update(updateObj);
            if (deleteLegacy && oldPhotoPath && oldPhotoPath !== targetPath) {
              try {
                const oldFile = bucket.file(oldPhotoPath);
                await oldFile.delete();
                console.log('Deleted legacy storage object', oldPhotoPath);
              } catch (delErr) {
                console.warn('Failed to delete legacy object', oldPhotoPath, delErr);
              }
            }
          } catch (uErr) {
            console.error('Failed to update Firestore for', docId, uErr);
            throw uErr;
          }
        }

  progress.processed[docId] = { status: 'success', photoPath: targetPath, photoHash, encryptedMetadata: !!encryptedMetadata };
  progress.stats.success++;
  // Per-user stats
  const uid = d.userId || 'unknown';
  if (!progress.stats.users) progress.stats.users = {};
  if (!progress.stats.users[uid]) progress.stats.users[uid] = { success: 0, failed: 0, total: 0 };
  progress.stats.users[uid].success++;
  progress.stats.users[uid].total++;
        console.log('Migrated', docId, '->', targetPath);
      } catch (err) {
  progress.processed[docId] = { status: 'failed', error: String(err) };
  progress.stats.failed++;
  const uidF = d.userId || 'unknown';
  if (!progress.stats.users) progress.stats.users = {};
  if (!progress.stats.users[uidF]) progress.stats.users[uidF] = { success: 0, failed: 0, total: 0 };
  progress.stats.users[uidF].failed++;
  progress.stats.users[uidF].total++;
        console.error('Failed to migrate', doc.id, err);
      }

      processedCount++;
      progress.stats.total++;

      // Persist progress periodically
      fs.writeFileSync(progressFile, JSON.stringify(progress, null, 2));
    }

    // Prepare next page
    const last = snapshot.docs[snapshot.docs.length - 1];
    if (!last) break;
    progress.lastDocId = last.id;
    fs.writeFileSync(progressFile, JSON.stringify(progress, null, 2));
    query = collectionRef.orderBy('id').startAfter(last).limit(batchSize);
  }

  console.log('Migration finished. Stats:', progress.stats);
  fs.writeFileSync(progressFile, JSON.stringify(progress, null, 2));
}

run().catch(err => {
  console.error('Migration runner failed:', err);
  process.exit(1);
});
