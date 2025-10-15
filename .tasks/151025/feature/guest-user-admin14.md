1. /home/pulsta/vscode/repo/maori-fishing-calendar-react
2. .tasks/long_running_tooling.md
3. Recreate a clean sync-status provider that doesn’t couple to AuthContext (accept the active user ID as a prop or callback).
4. Expose sync state through AuthContext after the provider hierarchy is resolved so consumers can rely on a single hook.
5. Reimplement the sign-out confirmation dialog using the restored `ContextualConfirmation`, augmenting it with sync status, last-sync timestamp, and guarded sign-out behavior.
6. Update header/mobile logout flows to use the improved dialog and ensure menus close gracefully after sign-out.
7. Test the refreshed flow for immediate logout, active sync, timeout fallback, and “sign out anyway” override.
8. Create `.tasks/feature/guest-user-admin.files14.md` summarizing modified files.
