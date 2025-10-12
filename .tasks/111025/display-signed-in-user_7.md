1. /home/pulsta/vscode/repo/maori-fishing-calendar-react
2. Review `src/components/Layout/Header.tsx` to confirm the account trigger’s ARIA attributes and focus-handling logic align with the current dropdown behavior.
3. Update the account trigger to advertise the proper popup type (`aria-haspopup="menu"`) or adjust the dropdown semantics so the announced role accurately reflects the interaction model.
4. Harden the `closeAuthDropdown` focus-restoration callback to guard against the trigger unmounting (e.g., null-check inside `requestAnimationFrame`) to avoid focus calls on a detached element.
5. Retest dropdown open/close flows across responsive breakpoints and keyboard/screen-reader scenarios to verify the ARIA changes and focus safeguards behave as expected.
6. Run targeted linting/tests to ensure no regressions from the accessibility refinements.
7. Create `.tasks/display-signed-in-user_7.files.md` listing, without commentary, every file touched while delivering these updates.
