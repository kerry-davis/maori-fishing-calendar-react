1. /home/pulsta/vscode/repo/maori-fishing-calendar-react
2. .tasks/long_running_tooling.md
3. Audit calendar refresh listeners to ensure `loadTripsForMonth` reacts to auth and month changes after event registration; refactor with `useCallback` or dependency updates.
4. Remove the duplicate rendering of `OfflineIndicator`, `PWAInstallPrompt`, and `PWAUpdateNotification` from `App.tsx` to avoid double UI elements.
5. Rework logout cleanup so guest-mode data persists (avoid clearing IndexedDB on `secureLogoutWithCleanup`).
6. Create `.tasks/fix/log-indicator-refresh.files4.md` listing the updated files in short form.
