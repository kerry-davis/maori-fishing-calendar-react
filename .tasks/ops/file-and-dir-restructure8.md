1) /home/pulsta/vscode/repo/maori-fishing-calendar-react
2) .tasks/long_running_tooling.md
3) Add a dedicated tests TS config for alias resolution: create tsconfig.tests.json with @app, @shared, @features paths; include src/**/*.test.* and src/**/__tests__/**/*.*
4) Link tests config: add ./tsconfig.tests.json to root tsconfig.json "references" so VS Code TS server loads it
5) React hooks fix: ensure no conditional hooks in shared hooks; update usePWARegister to call hooks unconditionally and gate behavior via variables
6) Replace arguments usage in BrowserAPISafe with explicit value params to satisfy lint/TS rules
7) Fix regex/no-useless-escape in firebaseDataService.sanitizeString; ensure proper escaping
8) Fix empty-object type in dataExportService (use Record<string, unknown> instead of {})
9) ESLint tuning: ignore tests/cypress/functions in lint baseline; relax no-explicit-any and no-unused-vars to warn during migration; keep react-refresh export rule off in providers/index
10) Verify PWA config policy: vite.config.ts devOptions.enabled=false; production config has no devOptions and uses default esbuild
11) Run: npm run lint && npm run test:run && npm run build; resolve any alias/typing regressions
12) IDE sanity check: reload TS server so tests pick up aliases; validate no TS2307 remains in Problems
13) Create .tasks/ops/file-and-dir-restructure.files8.md with a short list of the files changed in this task
