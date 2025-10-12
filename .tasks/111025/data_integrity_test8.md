/home/pulsta/vscode/repo/maori-fishing-calendar-react
1. Rewrite `src/test/authContextModalIntegration.test.ts` scenarios so they reflect the current auth-context-only logic (remove assumptions about `localStorage` fallbacks and verify behaviour via provided auth user / Firebase auth).
2. Update `src/test/test6Validation.test.ts` to use a single `const mockedAuth = vi.mocked(auth);` and drop any `vi.mocked('../services/firebase')` string usage, ensuring SSR branches still pass.
3. Audit both test suites for residual expectations tied to `lastActiveUser` storage keys and replace them with assertions on the true auth sources/events.
4. Run lint, TypeScript, and the targeted Vitest suites to confirm the fixes and capture any remaining failures.
5. Create `.tasks/data_integrity_test8.files.md` summarizing all files touched during this sequence.
