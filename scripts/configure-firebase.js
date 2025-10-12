/**
 * configure-firebase.js
 *
 * Loads Firebase Admin SDK configuration from environment variables or a config file.
 * Exported helper returns initialized admin.firestore() and admin.storage() clients.
 *
 * Usage (Node):
 *   const { initAdmin } = require('./configure-firebase');
 *   const { admin, firestore, storage } = initAdmin();
 *
 * Required env vars (one of the two approaches):
 *  - SERVICE_ACCOUNT_PATH: path to a service account JSON file
 *  OR
 *  - FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY (base64 or literal)
 *
 * The script will throw with clear guidance if configuration is missing.
 */

const fs = require('fs');
const path = require('path');

function loadServiceAccountFromPath(p) {
  const full = path.resolve(p);
  if (!fs.existsSync(full)) throw new Error(`Service account file not found at ${full}`);
  const content = fs.readFileSync(full, 'utf8');
  return JSON.parse(content);
}

function initAdmin() {
  // Lazy require to avoid forcing the dependency in browser contexts
  let admin;
  try {
    admin = require('firebase-admin');
  } catch (e) {
    throw new Error('firebase-admin is required to run inventory/migration scripts. Install with `npm i firebase-admin`');
  }

  const { SERVICE_ACCOUNT_PATH, FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;

  let credentialConfig = null;
  if (SERVICE_ACCOUNT_PATH) {
    credentialConfig = loadServiceAccountFromPath(SERVICE_ACCOUNT_PATH);
  } else if (FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY) {
    credentialConfig = {
      projectId: FIREBASE_PROJECT_ID,
      clientEmail: FIREBASE_CLIENT_EMAIL,
      privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    };
  }

  if (!credentialConfig) {
    throw new Error('Firebase admin credentials not configured. Set SERVICE_ACCOUNT_PATH or FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY in environment.');
  }

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(credentialConfig),
      // Optionally you can set storageBucket via env like FIREBASE_STORAGE_BUCKET
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || undefined,
    });
  }

  const firestore = admin.firestore();
  const storage = admin.storage();

  return { admin, firestore, storage };
}

module.exports = { initAdmin };
