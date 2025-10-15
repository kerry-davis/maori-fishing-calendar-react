## Phase 6 Tasks for feature/encrypt-photos (Iteration 1)

1. /home/pulsta/vscode/repo/maori-fishing-calendar-react
2. .tasks/long_running_tooling.md
3. Remove newly added Firebase Admin migration tooling (`scripts/migrate-legacy-photos.js`, `scripts/inventory-legacy-photos.js`, validation script, runbook entries) introduced in Phase 5 iterations that exceed catch-encryption scope.
4. Confirm `FishCatchModal` upload flow stays aligned with the desired catch encryption path; revert only if regression is detected.
5. Re-run photo encryption tests (e.g., `vitest src/test/encryptedPhotoIntegration.test.ts`) to verify new uploads encrypt correctly.
6. Update `.tasks/feature/encrypt-photos-phase5.files6.md` or related summaries to reflect the scoped roll-back.
7. Create `.tasks/feature/encrypt-photos-phase6.files1.md` summarizing modified files in short form.
