# Runbook: Migrate Legacy Photos

Purpose
- Safely migrate legacy inline and unencrypted storage photos to the encrypted storage layout used by the app.

Prerequisites
- Operator must have Firebase Admin credentials (service account JSON) and the environment variable `FIREBASE_STORAGE_BUCKET` set, or provide via `configure-firebase` defaults.
- Decide key handling strategy:
  - Preferred: do not centrally manage user keys. Instead, have users run client-side migration.
  - If operator-side migration is necessary, provide an `--encrypt-key` for testing OR ensure `users` docs contain `encSalt` (base64) and `email` and set `KEY_PEPPER` to derive per-user keys.

Safety steps (always run these first)
1. Inventory only (dry-run):
   SERVICE_ACCOUNT_PATH=./service-account.json node scripts/inventory-legacy-photos.js --dry-run --out inventory.json
2. Review `inventory.json` for scope and sample document IDs.
3. Run sample migration (dry-run) against a small selection:
   SERVICE_ACCOUNT_PATH=./service-account.json node scripts/migrate-legacy-photos.js --dry-run --filter-user <USER_ID> --limit 10 --progress-file sample-progress.json
4. Validate sample with `validate-migration-sample.js`:
   SERVICE_ACCOUNT_PATH=./service-account.json node scripts/validate-migration-sample.js --progress sample-progress.json --sample 5 --encrypt-key <base64-key>

Running a real migration
1. Obtain approvals and backups for Firestore and Storage. Export Firestore collections you will change.
2. Run with `--progress-file migration-progress.json` and monitor the generated JSON.
   SERVICE_ACCOUNT_PATH=./service-account.json node scripts/migrate-legacy-photos.js --progress-file migration-progress.json --batch-size 50 --encrypt-key <base64-key>
3. After a successful dry-run and validation, re-run without `--dry-run` to perform changes. Optionally add `--delete-legacy` to remove legacy storage objects after verifying uploads.

Post-migration validations
- Run `validate-migration-sample.js` without `--dry-run` to save `migration-validation-report.json`.
- Spot-check user galleries in the app and confirm images are visible and integrity checks pass.

Rollback
- Use the saved progress JSON to identify updated documents and restore Firestore from backups if necessary.

Notes and caveats
- Server-side per-user derivation uses PBKDF2 with the user's email and a shared pepper. This is a sensitive operation — discuss with security team before using.
- Prefer client-side migration when possible for user privacy.
