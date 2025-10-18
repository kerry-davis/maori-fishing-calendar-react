1. /home/pulsta/vscode/repo/maori-fishing-calendar-react
2. .tasks/long_running_tooling.md
3. Replace local-date arithmetic in tide utilities with UTC-safe helpers (e.g. adjust addDays).
4. Verify all tide consumers use the updated UTC helper to avoid regressions.
5. Update tests to cover UTC addDays behaviour across DST boundaries.
6. Create file .tasks/feature/tide-data-integration.files4.md with a short list of files changed.
