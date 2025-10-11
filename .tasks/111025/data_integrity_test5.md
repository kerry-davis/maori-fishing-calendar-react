/home/pulsta/vscode/repo/maori-fishing-calendar-react
1. Remove the unused `trackArtifact` import from `src/utils/clearUserContext.ts` and re-run TypeScript/lint to confirm no regressions.
2. Wrap every direct `localStorage`, `sessionStorage`, `window`, and `document` access in `fallbackBasicCleanup` (and other helpers) with `typeof window !== 'undefined'` guards so SSR/tests do not throw.
3. Refactor `useModalWithCleanup` to consume the actual auth context (or event payload UID) instead of `localStorage.getItem('lastActiveUser')`, ensuring modal authorization gates track the real user.
4. Replace the imaginary `window.firebaseAuthStateChange` hook in `useModalWithCleanup` with a real subscription (e.g., auth context listener or injected callback) and cover the case when no listener is available.
5. Extend the newly added validation tests to assert modal operations succeed when auth context reports a user and stay blocked when no user or mismatched UID is present.
