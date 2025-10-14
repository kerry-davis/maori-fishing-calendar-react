# Phase 2 Tasks for feature/encrypt-photos (Iteration 3)

1. /home/pulsta/vscode/repo/maori-fishing-calendar-react
2. .tasks/long_running_tooling.md
3. Update `photoMigrationService.startMigration()` (and its background runner) so fatal initialization errors (e.g. from `detectUnencryptedPhotos`) propagate back to callers instead of being swallowed by the async fire-and-forget wrapper.
4. Correct progress tracking: ensure `processedPhotos` only increments for successful migrations (or otherwise expose separate success/failure counters) so the UI stays accurate when batches contain failures.
5. Add/adjust unit tests in `photoMigrationService.test.ts` (and related integration tests if needed) to cover error propagation and accurate progress accounting.
6. Run targeted tests (`npx vitest run src/test/photoMigrationService.test.ts`) followed by the full suite via `npm test` / `npm run test:run`, resolving any failures.
7. Create `.tasks/feature/encrypt-photos-phase2.files3.md` listing the modified files in short form.
