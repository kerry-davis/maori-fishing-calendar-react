# Phase 2 Tasks for feature/encrypt-photos

1. /home/pulsta/vscode/repo/maori-fishing-calendar-react
2. .tasks/long_running_tooling.md
3. Review outstanding test/integration gaps noted in `src/test/encryptedPhotoIntegration.test.ts` and finalize Vitest migration (replace remaining placeholders with working mocks where needed).
4. Design the Phase 2 migration strategy for existing photos: determine batching, progress tracking, and failure recovery requirements.
5. Implement background migration service covering detection, encryption, upload, and metadata persistence for legacy photos.
6. Update UI/UX to surface migration status and handle in-progress/backfilled photos gracefully.
7. Expand automated test coverage (unit + integration) for migration flows, including failure and retry scenarios.
8. Run full test suite (`npm test` / `npm run test:run`) and ensure all diagnostics pass.
9. Create `.tasks/feature/encrypt-photos-phase2.files1.md` summarizing the modified files in short form.
