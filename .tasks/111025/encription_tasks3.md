1. Update `asyncDecryptRegression.test.ts` to build encrypted fixtures via `encryptionService.encryptFields` (or a shared helper) instead of hard-coded `enc:v1:` strings so decrypt assertions exercise real cipher text.
2. Correct the typoed assertion (`expect(result.not...)`) to use Vitest chaining (`expect(result).not...`) and audit remaining expectations for similar mistakes.
3. Ensure mock decrypt helpers in the regression suite return deterministic plaintext so expectations are stable, adjusting assertions (e.g., expected field values) accordingly.
4. Run the Vitest suite (`npm run test` or equivalent) and verify all encryption-related tests pass.
