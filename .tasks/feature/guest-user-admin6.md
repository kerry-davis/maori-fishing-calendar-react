1. /home/pulsta/vscode/repo/maori-fishing-calendar-react
2. .tasks/long_running_tooling.md
3. Update `runGuestAwareWrite` so it bypasses `validateUserContext` entirely when `currentUserId` is null, ensuring guest writes don’t hit the guard.
4. Rework `guestModeTripCreation.test.ts` to track created records directly inside the mock factory returned by `vi.mock`, avoiding post-import mutation of frozen mocks.
5. Verify other guest-mode tests still pass and adjust any remaining guest write helpers that rely on the validator.
6. Re-run the relevant suites to confirm the fixes.
7. Create `.tasks/feature/guest-user-admin.files6.md` summarizing modified files.
