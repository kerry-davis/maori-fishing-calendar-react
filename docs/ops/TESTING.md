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

## Critical regressions to cover (data-loss prevention)

- Edit fish catch must NOT remove existing photos unless explicitly deleted:
  1) Create a catch with a photo. 2) Edit non-photo fields and save. 3) Verify photo still present. 4) Now delete photo via UI and save; verify removed.
- Photo replacement flow: when uploading a new photo during edit, verify `photoPath`/`encryptedMetadata` get set and old photo is not removed until replacement succeeds.
- Encrypted photo invariant: `photoUrl` may be empty; UI must render via decrypted blob or sign-in placeholder as appropriate.
- Gear rename maintenance: rename a gear item/type and ensure queued task completes, progress UI updates, and affected catches show new labels once processing finishes.
