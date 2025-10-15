1. /home/pulsta/vscode/repo/maori-fishing-calendar-react
2. .tasks/long_running_tooling.md
3. Update `validateUserContext` to allow guest-mode local write operations and wire the allowance through guest create/update/delete flows in `firebaseDataService`.
4. Adjust guest trip and fish UI components (e.g., `TripLogModal`, `FishCatchModal`) to suppress placeholder photos when no image data exists.
5. Align gallery/photo preview utilities to skip generating placeholders for empty photo fields and add automated coverage for no-photo scenarios.
6. Run the relevant unit/integration suites covering guest data creation and photo rendering regressions.
7. Create `.tasks/feature/guest-user-admin.files1.md` enumerating updated files in short form.
