## Phase 5 Tasks for feature/encrypt-photos (Iteration 2)

1. /home/pulsta/vscode/repo/maori-fishing-calendar-react
2. .tasks/long_running_tooling.md
3. Implement Firebase configuration loading for the inventory/migration tooling (support env vars or config file, fail with clear guidance if missing).
4. Extend `scripts/inventory-legacy-photos.js` to paginate `fishCaught` documents, detect legacy photo markers, and output actionable counts plus sample IDs/paths.
5. Add dry-run and structured report options (JSON/CSV) so operators can review before acting.
6. Scaffold the migration runner script (download, encrypt via `photoEncryptionService`, upload, update Firestore) with retry tracking and resumable state.
7. Document operational steps in tooling script comments and ensure logging is operator-friendly.
8. Run targeted tests or linting for new scripts and verify they execute in a dry-run against test data.
9. Create `.tasks/feature/encrypt-photos-phase5.files2.md` summarizing modified files in short form.
