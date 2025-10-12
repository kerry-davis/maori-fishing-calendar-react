# Phase 2 Tasks for feature/encrypt-photos (Iteration 2)

1. /home/pulsta/vscode/repo/maori-fishing-calendar-react
2. .tasks/long_running_tooling.md
3. Fix batch accounting in `photoMigrationService`: record successes/failures per photo so only true successes populate `successfulPhotos` and only failed IDs populate `failedPhotos`.
4. Update `processBatch`/`migrateSinglePhoto` to return per-photo outcomes and keep migration status (`processedPhotos`, `failedPhotos`, `status`) accurate when batches contain mixed results.
5. Mock Firebase Storage APIs (`ref`, `uploadBytes`, `getDownloadURL`, etc.) in Vitest for `photoMigrationService.test.ts` (and related tests) to prevent real SDK calls.
6. Run targeted tests (`vitest src/test/photoMigrationService.test.ts`) and then the full suite via `npm test` (or `npm run test:run`), resolving any failures.
7. Create `.tasks/feature/encrypt-photos-phase2.files2.md` listing the modified files in short form.
