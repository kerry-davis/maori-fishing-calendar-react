/home/pulsta/vscode/repo/maori-fishing-calendar-react
1. Reorder `useModalWithCleanup` so `getCurrentUser` (and other dependencies) are declared before `trackModalStateChange`, preventing runtime reference errors.
2. Refactor `useModalWithCleanup` to source the active UID exclusively from `getCurrentUser()` or event payloads (no `localStorage` fallback inside modal cleanup/authorization paths).
3. Add SSR-safe guards around every `window`, `document`, `localStorage`, and `sessionStorage` access in modal helpers and cleanup code.
4. Correct malformed expectations in `src/test/authContextModalIntegration.test.ts` and ensure the suite compiles.
5. Run/extend tests to confirm modal operations succeed with matching auth context, fail when unauthorized, and no SSR/runtime errors remain.
6. Create `.tasks/data_integrity_test6.files.md` summarizing all files touched by this sequence.
