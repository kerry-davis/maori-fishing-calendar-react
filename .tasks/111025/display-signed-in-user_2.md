1. /home/pulsta/vscode/repo/maori-fishing-calendar-react
2. Audit `src/components/Layout/Header.tsx` to catalogue all transient diagnostic logging and the state toggling patterns currently used for the mobile menu and theme controls.
3. Refine the header component by removing or gating non-essential `console.log` calls, ensuring a clean production log surface without losing necessary debug insight.
4. Update the mobile menu toggling logic to use functional state updates and verify behavior through rapid interaction testing in both desktop and mobile viewports.
5. Revisit the user identity helpers so that display names render fully while long email addresses truncate gracefully, and ensure that a clear `'Guest'` label is returned when no authenticated user is present; rename helpers or split responsibilities to keep intent clear.
6. Improve the mobile menu show/hide styling by relying on Tailwind utility classes (rather than inline `display` overrides) to maintain smooth height and opacity transitions.
7. Execute applicable component and integration tests (including linting if required) to confirm the header changes introduce no regressions.
8. Create `.tasks/display-signed-in-user_2.files.md` listing, without additional commentary, every file touched while completing these tasks.
