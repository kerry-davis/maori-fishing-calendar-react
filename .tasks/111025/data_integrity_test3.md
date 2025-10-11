# Data Integrity Remediation Tasks (Sequence 3)


1. directory is /home/pulsta/vscode/repo/maori-fishing-calendar-react/src/utils
2. Document the observed leakage paths by instrumenting login/logout flows and capturing all persistence artifacts that survive logout (Redux slices, storage keys, caches, IndexedDB records, in-memory listeners).
3. Refine `clearUserContext()` to guard every browser-specific API call (storage, caches, performance) and ensure it no-ops safely in non-browser/test contexts.
4. Strengthen `validateUserContext` and all Firestore mutations so operations hard-fail when `auth.currentUser?.uid` mismatches the payload owner, including queued/offline writes.
5. Add deterministic cleanup hooks to modal/state providers so they rehydrate from empty state immediately after logout, even if triggered via background auth changes.
6. Expand regression coverage (unit + Cypress multi-account scenario) to assert that post-logout storage checks return empty and that user2 never receives user1 data in UI or Firestore writes.
