1. /home/pulsta/vscode/repo/maori-fishing-calendar-react
2. .tasks/long_running_tooling.md
3. Smoke-test the anchored logout modal across breakpoints to confirm it no longer shifts or needs double-click.
4. Fix the last-sync timestamp so it updates on logout/login cycles (currently stuck at 23/09/2025).
5. Monitor emitted sync events during logout to ensure queue counts remain accurate; adjust if drift reappears.
6. Re-run lint on authentication and sync files to verify no regressions.
7. Create `.tasks/feature/guest-user-admin.files17.md` summarizing modified files.
