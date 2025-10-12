## Phase 5 Tasks for feature/encrypt-photos (Iteration 4)

1. /home/pulsta/vscode/repo/maori-fishing-calendar-react
2. .tasks/long_running_tooling.md
3. Integrate migration tooling with the project’s `photoEncryptionService` (reuse key-derivation per user) so migrated photos remain decryptable.
4. Adjust storage path/metadata logic to distinguish plaintext vs encrypted uploads and align with existing client expectations.
5. Ensure Firestore updates clear legacy fields (`photo`, old `photoPath`) and optionally delete legacy storage objects to avoid duplicates.
6. Add validation steps post-migration (sample decrypt, gallery load) and extend progress reporting with summary stats per user.
7. Reinforce logging/documentation to guide operators on providing credentials and running safe dry-run/live migrations.
8. Add automated tests or scripted dry-runs that cover encryption alignment and cleanup paths.
9. Create `.tasks/feature/encrypt-photos-phase5.files4.md` summarizing modified files in short form.
