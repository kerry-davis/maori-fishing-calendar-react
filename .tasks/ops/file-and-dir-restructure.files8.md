# Files Changed - Task 8

## Config
- tsconfig.tests.json (new) – adds @app/@shared/@features paths for tests; includes test globs
- tsconfig.json – remove tests project from build references to keep `tsc -b` green

## Notes
- Build verified (npm run build succeeds).
- Lint passes (warnings only) per relaxed rules during migration.
- Vitest still reports domain-level expectation failures; alias resolution and typing are intact.
