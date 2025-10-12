1. In `asyncDecryptRegression.test.ts`, limit the temporary `btoa/atob` overrides to the specific describe block—store originals, replace in `beforeEach`, and restore them in `afterEach`.
2. Replace the catch-all `atob` fallback with assertions that expect legitimate base64 strings; if malformed data is required, mock `crypto.subtle.decrypt` or the helper directly for that case.
3. Run Vitest to ensure the regression suite still passes and that other test suites aren’t affected by global base64 shims.
