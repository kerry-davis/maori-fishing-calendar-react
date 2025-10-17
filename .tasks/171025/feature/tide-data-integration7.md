1. /home/pulsta/vscode/repo/maori-fishing-calendar-react
2. .tasks/long_running_tooling.md
3. Update `MetOceanTideProvider.supportsLocation` to use the harbour definitions map and confirm expanded coverage logic.
4. Correct `getLunarDay` so it returns the actual days since the reference new moon, not the fractional cycle count.
5. Replace the random tide-height jitter in `generateKawhiaTideTimes` with deterministic calculations derived from the harmonic model.
6. Synchronize the generated extrema with the harmonic series and ensure the UTC offset reflects real timezone rules.
7. Add tests or validation steps to confirm the corrected tide outputs remain stable across multiple runs.
