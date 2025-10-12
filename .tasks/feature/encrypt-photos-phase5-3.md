## Phase 5 Tasks for feature/encrypt-photos (Iteration 3)

1. /home/pulsta/vscode/repo/maori-fishing-calendar-react
2. .tasks/long_running_tooling.md
3. Wire `migrate-legacy-photos.js` to fetch photo bytes (inline or storage), invoke the existing `photoEncryptionService` logic (port or reimplement AES-GCM steps), and upload encrypted blobs with metadata.
4. Update Firestore documents with new `photoPath`, `photoHash`, `photoUrl`, and serialized `encryptedMetadata`, removing legacy fields safely.
5. Implement progress tracking with resumable state (e.g., progress file) and retry handling for failed items.
6. Add CLI options for batch sizing, resume tokens, and selective processing (single user/date) to support controlled rollouts.
7. Create integration tests or dry-run simulations covering migration success/failure paths.
8. Document operator usage within script headers and verify logging is actionable.
9. Create `.tasks/feature/encrypt-photos-phase5.files3.md` summarizing modified files in short form.
