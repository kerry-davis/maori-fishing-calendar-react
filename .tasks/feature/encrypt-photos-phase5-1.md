## Phase 5 Tasks for feature/encrypt-photos (Iteration 1)

1. /home/pulsta/vscode/repo/maori-fishing-calendar-react
2. .tasks/long_running_tooling.md
3. Inventory all fish records for legacy photos (missing `encryptedMetadata` or still using `photo`/old `photoPath` values) and document counts.
4. Implement or wire up the migration runner that downloads each legacy photo, encrypts it via `photoEncryptionService`, uploads to the secure storage path, and updates Firestore with `photoPath`, `photoHash`, `photoUrl`, and `encryptedMetadata`.
5. Add retry/error tracking so failed photo conversions are queued for reprocessing and surfaced in UI/logs.
6. Verify gallery/trip displays gracefully handle migrated photos and cleanly load decrypted previews (including placeholder fallbacks on failure).
7. Run the migration end-to-end against test data, confirm zero remaining legacy photos, and capture before/after metrics.
8. Execute targeted migration/encryption tests plus the project’s full test suite; resolve any failures.
9. Create `.tasks/feature/encrypt-photos-phase5.files1.md` summarizing modified files in short form.
