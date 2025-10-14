1. /home/pulsta/vscode/repo/maori-fishing-calendar-react
2. .tasks/long_running_tooling.md
3. Rework `galleryModalNoPhoto.test.tsx` to render a single instance per scenario, using controlled DatabaseContext mocks.
4. Add specific assertions for both no-photo and with-photo cases (e.g., `queryByAltText` checks) after awaiting data load.
5. Ensure document cleanup between scenarios and restore original hooks.
6. Run the gallery test suite to confirm behavior.
7. Create `.tasks/feature/guest-user-admin.files10.md` summarizing modified files.
