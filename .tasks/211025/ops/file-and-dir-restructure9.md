1) /home/pulsta/vscode/repo/maori-fishing-calendar-react
2) .tasks/long_running_tooling.md
3) Triage tide tests: run vitest focused on tide suite; capture failures and map to code paths (tideService, provider factory, NIWA transforms).
4) Timezone/DST normalization: ensure NZ forecasts report correct utcOffsetSeconds (43200 winter, 46800 summer) consistently across providers or align tests accordingly.
5) Series completeness: guarantee 15‑minute series length (96 points) where applicable; fill/generate when upstream lacks density.
6) Extrema integrity: enforce H‑L‑H‑L pattern, ascending chronology, and constrain extrema to target‑day bounds; adjust sorting and clamping logic.
7) Error semantics: standardize TideError messages/types to match test expectations (e.g., NIWA proxy unavailable vs invalid response) and strip proxy metadata from outputs.
8) Coverage API: align checkTideCoverage results (availability and timezone display value) with tests for known harbours; update mocks as needed.
9) ESLint tightening (stabilization pass): raise no‑explicit‑any/no‑unused‑vars back to errors for src/app and src/shared (keep tests relaxed); keep providers’ react‑refresh rule disabled only where required.
10) Commands:
    - npm run lint
    - npm run test:run
    - npm run build
11) Iterate fixes until all tests pass and lint is clean (outside tests).
12) Update CI if needed to run vitest and lint on PRs for this branch.
13) Create .tasks/ops/file-and-dir-restructure.files9.md with a short list of files changed in this task.
