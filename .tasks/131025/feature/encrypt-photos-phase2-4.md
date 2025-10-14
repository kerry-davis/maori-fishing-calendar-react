# Phase 2 Tasks for feature/encrypt-photos (Iteration 4)

1. /home/pulsta/vscode/repo/maori-fishing-calendar-react
2. .tasks/long_running_tooling.md
3. Preserve detected totals in `photoMigrationService.startMigration`: avoid resetting `progress.totalPhotos` (and related fields) when reinitializing after detection.
4. Complete the Firebase Storage mock in `photoMigrationService.test.ts` (and any shared test setup) with `getMetadata`, `getBlob`, etc., so Vitest never hits the real SDK.
5. Add/adjust tests verifying `totalPhotos` remains accurate after `startMigration`, and that storage mocks cover decryption paths.
6. Run targeted tests (`npx vitest run src/test/photoMigrationService.test.ts`) then the full suite (`npm test` / `npm run test:run`), fixing any failures.
7. Create `.tasks/feature/encrypt-photos-phase2.files4.md` summarizing the modified files in short form.
