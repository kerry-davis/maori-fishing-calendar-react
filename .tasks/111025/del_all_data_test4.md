1. /home/pulsta/vscode/repo/maori-fishing-calendar-react
2. Extend `firebaseDataService.clearFirestoreUserData` to report progress milestones via callback
3. Update Settings modal delete-all flow to surface progress with the shared `ProgressBar`
4. Ensure UI state disables actions and resets gracefully after completion or failure
5. Cover new progress behavior with service and UI tests
6. Long-running tooling (tests, docker compose, migrations, etc.) must always be invoked with sensible timeouts or in non-interactive batch mode. Never leave a shell command waiting indefinitely—prefer explicit timeouts, scripted runs, or log polling after the command exits.
7. Create file `.tasks/del_all_data_test4.files.md` listing modified files in short form
