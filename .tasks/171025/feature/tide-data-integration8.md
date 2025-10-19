1. /home/pulsta/vscode/repo/maori-fishing-calendar-react
2. .tasks/long_running_tooling.md
3. Correct harbour bounds orientation inside `HARBOURS` to ensure latitude/longitude comparisons match NZ geography.
4. Adjust `generateKawhiaTideTimes` to preserve fractional lunar-day progress and apply the 50-minute retardation without double division.
5. Implement per-harbour tide generation (or fallback) so expanded coverage reflects harbour-specific data.
6. Fix `getNZUtcOffset` DST boundary calculations to use true last-Sunday/first-Sunday dates.
7. Run stability regression tests and validate outputs for each harbour.
8. Create `.tasks/feature/tide-data-integration.files8.md` summarizing the files updated in this pass.
