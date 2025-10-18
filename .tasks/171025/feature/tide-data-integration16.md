1. /home/pulsta/vscode/repo/maori-fishing-calendar-react
2. .tasks/long_running_tooling.md
3. Reduce NIWA tide logging (location bounds, UTC→NZ conversion) to keep production console output minimal while retaining critical diagnostics.
4. Add proxy-level tests validating sanitized error responses in `api/niwa-tides.ts` (e.g., non-JSON body, authentication failure, parse errors).
5. Document the LAT datum change for consumers (release notes or README section) so downstream integrations know heights are LAT-based.
6. Create or update `.tasks/feature/tide-data-integration.files16.md` with the concise list of files touched by these follow-ups.
