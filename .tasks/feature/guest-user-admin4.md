1. /home/pulsta/vscode/repo/maori-fishing-calendar-react
2. .tasks/long_running_tooling.md
3. Reinstate explicit guest-operation tokens in `validateUserContext` so generic `createTrip` calls remain gated when no auth is present.
4. Update guest write call sites to supply the correct guest token (or dedicated helper) instead of relying on implicit bypass rules.
5. Wrap `getFishPhotoPreview` photo-path handling so storage-relative paths become usable URLs or fall back to placeholders; avoid returning raw paths to the UI.
6. Fix `guestModeTripCreation.test.ts` cleanup by awaiting async retention clearing (and ensure mocks/stubs cover IndexedDB).
7. Re-run guest-mode and photo preview tests to confirm deterministic behavior and UI correctness.
8. Create `.tasks/feature/guest-user-admin.files4.md` summarizing modified files in short form.
