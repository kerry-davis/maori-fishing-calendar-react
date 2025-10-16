1. /home/pulsta/vscode/repo/maori-fishing-calendar-react
2. .tasks/long_running_tooling.md
3. Refactor `firebaseDataService.ts` to use the new logging helpers (replace console calls, ensure critical errors use PROD_* helpers).
4. Apply the same logging refactor to `databaseService.ts` and `browserZipImportService.ts`, confirming no test expectations break.
5. Update any related tests or mocks to account for the new logging imports, and spot-check production builds for clean console output.
6. Create or update `.tasks/feature/tide-data-integration.files20.md` with the concise list of files touched.
