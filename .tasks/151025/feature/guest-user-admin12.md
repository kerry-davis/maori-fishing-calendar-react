1. /home/pulsta/vscode/repo/maori-fishing-calendar-react
2. .tasks/long_running_tooling.md
3. Refactor sync status tracking into a shared context/service so `AuthContext` and sign-out UI consume consistent data without duplicating hooks.
4. Replace the header’s direct `ContextualConfirmation` usage with the new `SignOutConfirmation` component and ensure it listens to live sync updates instead of polling localStorage.
5. Fix `SignOutConfirmation` interval/timeout handling to clear timers when sync completes, allow explicit override, and surface real-time progress or “still syncing” messaging.
6. Guard `useSyncStatus` against missing Firebase instances, remove Firestore queries from the hook, and avoid dispatching events with stale closures.
7. Add targeted tests or manual QA steps covering: (a) immediately available sync state, (b) in-flight sync that eventually clears, (c) timeout fallback, and (d) force sign-out option.
8. Create `.tasks/feature/guest-user-admin.files12.md` summarizing modified files.
