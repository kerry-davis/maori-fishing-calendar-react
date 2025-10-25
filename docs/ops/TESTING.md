# Testing Strategy

Coverage areas:

- Encryption: Deterministic key + migration helpers
- Data Service: ID mapping, merge logic, validation, idempotent import
- Error UX: Friendly Firebase error mapping
- Performance: Smoke test for image import / caching

Run tests:

```bash
npm run test:run
```

CI mode (mirrors pipeline):

```bash
# CI excludes certain flaky integration suites via vitest.config.ts
CI=1 npm run test:run
```

Notes:
- Full local runs (without CI=1) execute all tests. In CI, feature tests and a handful of long/flaky shared suites are skipped to keep the pipeline green.
- See vitest.config.ts → test.exclude for the current CI-only skip list.

Add new tests under `src/test/`. Prefer fast, deterministic tests; mock Firebase network where feasible.
