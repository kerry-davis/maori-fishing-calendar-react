## Phase 4 Tasks for feature/encrypt-photos (Iteration 1)

1. /home/pulsta/vscode/repo/maori-fishing-calendar-react
2. .tasks/long_running_tooling.md
3. Refactor `FishCatchModal` authenticated photo upload to read files as base64 data URLs and pass them unchanged to the data service so encryption can run.
4. Adjust new/edit flows to preserve or clear `photoPath`, `photoUrl`, and `encryptedMetadata` correctly when replacing or removing photos.
5. Review `firebaseDataService` photo-handling logic to ensure new uploads receive encrypted storage paths and metadata, and that offline/guest fallbacks still function.
6. Update or add unit/integration tests covering new encrypted upload behaviour and modal flows.
7. Run targeted photo-encryption suites and the broader test command used by the project; resolve any failures.
8. Create `.tasks/feature/encrypt-photos-phase4.files1.md` summarizing modified files in short form.
