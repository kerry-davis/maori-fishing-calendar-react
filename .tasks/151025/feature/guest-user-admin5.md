1. /home/pulsta/vscode/repo/maori-fishing-calendar-react
2. .tasks/long_running_tooling.md
3. Extend guest-mode handling to every write helper (`updateTrip`, `deleteTrip`, weather/fish CRUD, etc.) so they bypass `validateUserContext` before the guard runs.
4. Replace direct `validateUserContext` usage in those guest paths with either explicit `guest-*` tokens or standalone helper functions to keep the intent clear.
5. Adjust guest-mode tests/mocks (e.g., `guestModeTripCreation.test.ts`) to track created records so assertions reflect the mocked persistence layer.
6. Re-run the affected suites to validate guest write coverage and ensure no regressions.
7. Create `.tasks/feature/guest-user-admin.files5.md` listing modified files in short form.
