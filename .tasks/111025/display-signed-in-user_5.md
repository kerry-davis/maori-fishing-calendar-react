1. /home/pulsta/vscode/repo/maori-fishing-calendar-react
2. Review the current header dropdown implementation in `src/components/Layout/Header.tsx`, paying particular attention to the accessibility attributes on the account trigger and focus behavior when toggling.
3. Update the dropdown trigger to expose appropriate ARIA semantics (e.g., `aria-haspopup`, `aria-expanded`, keyboard activation) so assistive technologies correctly understand and control the menu.
4. Implement focus management so that opening the dropdown moves focus into the menu and closing it returns focus to the trigger; ensure the flow works for both mouse and keyboard users.
5. Adjust modal mounting logic so the login modal renders only when Firebase auth is configured and the modal is requested, keeping the DOM minimal when authentication is disabled.
6. Verify that dropdown interactions remain consistent across desktop and mobile breakpoints (including keyboard navigation and touch gestures) after the accessibility enhancements.
7. Run targeted accessibility checks, linting, and relevant automated tests to confirm the header adjustments introduce no regressions.
8. Create `.tasks/display-signed-in-user_5.files.md` enumerating, without extra commentary, every file touched while completing these tasks.
