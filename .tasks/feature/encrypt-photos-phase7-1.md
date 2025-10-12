## Phase 7 Tasks for feature/encrypt-photos (Iteration 1)

1. /home/pulsta/vscode/repo/maori-fishing-calendar-react
2. .tasks/long_running_tooling.md
3. Update gallery and edit flows to detect encrypted photos (`encryptedMetadata`/`enc_photos` paths) and asynchronously call `firebaseDataService.getDecryptedPhoto` before rendering.
4. Add loading/placeholder handling and revoke object URLs on cleanup in affected components (GalleryModal, FishCatchModal, etc.).
5. Manually verify decrypted previews in gallery and edit modals; re-run `vitest src/test/encryptedPhotoIntegration.test.ts` (and related suites) to confirm.
6. Update any task summaries to reflect the UI decryption fix.
7. Create `.tasks/feature/encrypt-photos-phase7.files1.md` summarizing modified files in short form.
