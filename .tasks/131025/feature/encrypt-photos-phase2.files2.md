Files changed in this iteration (phase2-2):

1. src/services/photoMigrationService.ts - Updated batch accounting; processBatch and migrateSinglePhoto now return per-photo outcomes; per-batch arrays for processed/failed/successful photos added; callers updated to use per-photo outcomes.
2. src/test/photoMigrationService.test.ts - Added explicit Vitest mock for `firebase/storage` named imports (ref, uploadBytes, getDownloadURL, deleteObject) to avoid real SDK calls during tests.

Notes:
- Run targeted tests: `npx vitest run src/test/photoMigrationService.test.ts` or `npm run test:run` to run full suite.
- Remaining work: If additional tests reference storage APIs via other modules, consider adding the same `vi.mock('firebase/storage',...)` in those tests or a global test setup file.
