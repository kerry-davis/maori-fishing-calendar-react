1. /home/pulsta/vscode/repo/maori-fishing-calendar-react
2. Inspect `src/components/Layout/Header.tsx` focusing on the conditional rendering around the user identity badge in both desktop and mobile sections to understand why the `'Guest'` label is not currently shown when unauthenticated.
3. Refactor the header JSX so the identity container renders regardless of authentication state, delegating the badge copy entirely to a helper that returns either the signed-in user details or `'Guest'`, and confirm the helper implementation aligns with that responsibility.
4. Rework the sign-in affordance so the existing login icon opens a dropdown panel rather than a modal, embedding the current authentication controls within that dropdown for an inline experience.
5. Adjust the dropdown content to surface the active user identity (or `'Guest'` when unauthenticated) alongside the correct sign-in or sign-out action, verifying labels and icons reflect the session state.
6. Review the mobile menu transition block to identify how `hidden`/`block` classes interact with height and opacity animations, documenting the current behavior in responsive dev tools.
7. Update the mobile menu toggle styling to keep the panel mounted while animating height and opacity (removing conflicting `hidden`/`block` toggles), and test via rapid open/close interactions to verify smooth animations.
8. Run targeted component-level or integration tests plus linting as needed to validate the header refactor and ensure no regressions introduced by the rendering or authentication changes.
9. Create `.tasks/display-signed-in-user_3.files.md` enumerating, without extra commentary, every file touched while completing these tasks.
