1. /home/pulsta/vscode/repo/maori-fishing-calendar-react
2. .tasks/long_running_tooling.md
3. Audit the catch log (TripLogModal and related components) to identify where tide data/components are rendered.
4. Remove tide-related UI/state/hooks from the catch log while preserving the behaviour in the bite modal and landing page.
5. Run targeted tests or smoke checks for the catch log, bite modal, and landing page to confirm tides are only shown in the intended views.
6. Create or update `.tasks/feature/tide-data-integration.files24.md` with the concise list of files touched.
