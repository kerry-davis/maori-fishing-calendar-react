/home/pulsta/vscode/repo/maori-fishing-calendar-react
1. Fix the syntax errors in `src/test/authContextModalIntegration.test.ts` (e.g., missing closing parentheses on `expect` calls) and realign assertions with the new auth-context-only behaviour.
2. Update `src/test/test6Validation.test.ts` to interact with the actual mocked `auth` object (e.g., `const mockedAuth = vi.mocked(auth)`), eliminating invalid `vi.mocked('../services/firebase')` usage.
3. Ensure `useModalWithCleanup` no longer references any `localStorage` fallback in tests; adjust spies/mocks accordingly so expectations target the new code paths.
4. Re-run linting, TypeScript, and the relevant test suites to verify no compilation errors remain.
5. Create `.tasks/data_integrity_test7.files.md` summarizing all files touched during this sequence.
