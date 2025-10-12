1. /home/pulsta/vscode/repo/maori-fishing-calendar-react
2. Examine `src/components/Layout/Header.tsx` and supporting auth utilities to map out how the new dropdown currently mixes full authentication flows into the header.
3. Refactor the dropdown so it delivers a lightweight identity summary plus a contextual action (“Sign in” when logged out, “Sign out” when logged in), delegating full auth forms to existing dedicated views.
4. Ensure the unauthenticated state offers a clear path when Firebase credentials are unavailable (e.g., disabled action with guidance) rather than presenting empty or broken controls.
5. Update dropdown state handling so that partially entered credentials are not wiped on incidental outside clicks; add explicit cancel/reset affordances if input clearing is required.
6. Revisit mobile parity to confirm dropdown behavior and messaging are consistent across breakpoints, including touch interactions.
7. Run targeted lint/tests or manual verification passes to validate the dropdown refactor and confirm there are no regressions in login/logout handling.
8. Create `.tasks/display-signed-in-user_4.files.md` listing, without commentary, every file touched while executing these tasks.
