1. /home/pulsta/vscode/repo/maori-fishing-calendar-react
2. .tasks/long_running_tooling.md
3. Resolve eslint errors flagged in guest-user-admin14 (react-refresh warnings, lingering `any` types in AuthContext/SyncStatus).
4. Adjust `SyncStatusProvider` connectivity probe to avoid querying nonexistent collections; guard when Firestore isn’t configured.
5. Emit the `syncQueueUpdated` event (or remove the listener) so sync watchers stay in sync.
6. Fix the logout dialog jump: the modal showing “Signing out will remove any local-only data stored on this device.” should not shift to the header on first click—keep it anchored and close it after a single confirm/cancel action.
7. Re-test desktop/mobile logout flows covering idle, in-flight, timeout, and force sign-out cases.
8. Create `.tasks/feature/guest-user-admin.files15.md` summarizing modified files.
