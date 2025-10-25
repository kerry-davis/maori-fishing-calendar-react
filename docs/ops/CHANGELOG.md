# Changelog

## Latest Updates

- Firestore rules: owner-guarded get/update/delete; explicit list permissions for trips, weatherLogs, fishCaught, tackleItems, gearTypes; allow userSettings delete by owner (covers legacy docs without userId); helper functions for standardized checks.
- Import/Export: include encrypted photos in exports; improved import progress; fetch catches by trip; robust guest→cloud merge via upsert; complete delete-all wipe (enc_photos + tackle/gear/userSettings).
- PWA/Offline UX: new `SyncToast` and refreshed `OfflineIndicator`; shared sync status across UI; safer logout waiting for pending sync.
- Services/Utilities: updated `firebaseDataService`, `dataExportService`, `browserZipImportService`; added `imageCompression`; improved photo preview utilities.
- Docs: updated Firebase Storage CORS guide; expanded migration guide for browser-based zip import; troubleshooting notes for distinguishing Storage 403 vs CORS.

- Introduced a shared sync status context that keeps connectivity, queue length, and last-sync timestamps in sync across the UI for clearer offline workflows.
- Added a guarded logout flow that waits for pending sync activity (with retry and override options) before signing users out.
- Hardened modal handling around PWA authentication redirects to prevent unintended settings screens from opening post-login.

## History (Lite)

| Date   | Change |
|--------|--------|
| 2025-10 | NIWA integration with LAT datum, enhanced error handling, production logging optimization |
| 2025-10 | Deterministic encryption reintroduced + background migration UI pill |
| 2025-10 | Legacy passphrase encryption removed, tests cleaned |
| 2025-09 | Import/export & performance smoke test added |
| 2025-08 | Initial PWA, lunar calendar, trip logging foundation |
