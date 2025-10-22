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

Add new tests under `src/test/`. Prefer fast, deterministic tests; mock Firebase network where feasible.
