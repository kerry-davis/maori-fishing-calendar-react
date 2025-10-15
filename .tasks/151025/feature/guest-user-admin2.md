1. /home/pulsta/vscode/repo/maori-fishing-calendar-react
2. .tasks/long_running_tooling.md
3. Refine `validateUserContext` so guest-mode writes explicitly bypass the authenticated-write guard without re-invoking the validator with a null user ID.
4. Update guest write call sites in `firebaseDataService` to use the revised helper (ensure create/update/delete flows all pass the correct operation tokens).
5. Restore Trip Log fish preview rendering by honoring `photo`, `photoUrl`, and `photoPath` while skipping empty placeholders.
6. Adjust `getFishPhotoPreview` to return `null`/`undefined` when no image exists and remove noisy logging so callers can decide whether to render.
7. Add targeted tests (or update existing ones) covering guest write paths and no-photo UI cases.
8. Execute the relevant test suites for guest data and photo rendering to confirm regressions are resolved.
9. Create `.tasks/feature/guest-user-admin.files2.md` summarizing modified files in short form.
