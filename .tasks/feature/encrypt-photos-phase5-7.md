## Phase 5 Tasks for feature/encrypt-photos (Iteration 7)

1. /home/pulsta/vscode/repo/maori-fishing-calendar-react
2. .tasks/long_running_tooling.md
3. Update `migrate-legacy-photos.js` to skip or clearly fail when no encryption key can be derived/provided (never upload plaintext to `enc_photos`), and include `userId` plus failure reasons in the progress log.
4. Adjust `validate-migration-sample.js` to consume the enriched progress data and emit clear messages for skipped or keyless entries.
5. Refresh `RUNBOOKS/MIGRATE_LEGACY_PHOTOS.md` with troubleshooting for missing salts/emails, validation outcome interpretation, and staging verification checklist.
6. Ensure `scripts/inventory-legacy-photos.js` outputs the same legacy criteria referenced by migration/validation, updating documentation if thresholds changed.
7. Run a dry-run migration + validation cycle on test data and capture results for the summary.
8. Create `.tasks/feature/encrypt-photos-phase5.files7.md` summarizing modified files in short form.
