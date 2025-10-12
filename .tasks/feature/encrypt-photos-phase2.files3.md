Files changed in this iteration (phase2-3):

1. src/services/photoMigrationService.ts - Initialization errors propagate: `startMigration` now runs `detectUnencryptedPhotos` synchronously and passes the detected photos into the background runner; `processedPhotos` now increments only for successful migrations; `retryFailedPhotos` increments processed counter on successful retries.
2. src/test/photoMigrationService.test.ts - Added unit tests:
   - `startMigration should surface initialization errors` to ensure initialization errors propagate to callers.
   - `processedPhotos should only count successful migrations` to ensure accurate progress accounting.

Notes:
- Run targeted tests: `npx vitest run src/test/photoMigrationService.test.ts`.
- After these changes the targeted tests should pass. Run the full suite with `npm test` to check integration/other tests.
