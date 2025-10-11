1. /home/pulsta/vscode/repo/maori-fishing-calendar-react
2. Inspect `src/components/Layout/Header.tsx` to trace every code path that closes the account dropdown (click outside, ESC key, user actions) and document where focus currently ends up after closure.
3. Refactor dropdown closing logic so all paths funnel through a single `closeAuthDropdown` helper that reliably restores focus to the trigger, ensuring keyboard and screen-reader users keep their place.
4. Evaluate the current ARIA role assignments; decide whether to keep the `menu/menuitem` pattern with arrow-key navigation or simplify to button/list semantics, then implement the chosen model consistently with correct keyboard handling.
5. Validate that the updated focus restoration and interaction model work across desktop, mobile, and assistive technology scenarios (keyboard tabbing, screen readers, touch devices).
6. Re-run targeted accessibility checks, linting, and relevant automated tests to confirm the header refinements introduce no regressions.
7. Create `.tasks/display-signed-in-user_6.files.md` enumerating, without commentary, every file touched while completing these tasks.
