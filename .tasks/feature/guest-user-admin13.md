1. /home/pulsta/vscode/repo/maori-fishing-calendar-react
2. .tasks/long_running_tooling.md
3. Remove the ad-hoc window hook usage and instead wrap `AuthProvider` inside a real `SyncStatusProvider`, eliminating the context dependency cycle.
4. Refactor `SyncStatusContext` so it no longer calls `useAuth()` directly; accept the current user via props or a callback to avoid mutual imports.
5. Update `useSyncStatus`/event dispatching to emit freshly computed values (no stale closures) and ensure `SignOutConfirmation` resets timers/progress on each attempt.
6. Adjust `Header` to rely solely on `SignOutConfirmation` for logout handling, removing unused imports and preventing duplicate sign-out calls.
7. Verify sign-out UX across immediate, in-flight, timeout, and force scenarios after restructuring.
8. Create `.tasks/feature/guest-user-admin.files13.md` summarizing modified files.
