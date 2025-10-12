# Data Integrity Remediation Tasks (Sequence 2)

1. Reproduce the contamination scenario with scripted login/logout flows for user1 and user2 to capture current persistence behaviour.
2. Catalog every client-side persistence mechanism (Redux slices, caches, storage, IndexedDB, service worker, queued writes) and annotate which entries hold user1 artifacts post-logout.
3. Build a consolidated `clearUserContext()` utility that purges the catalogued stores, aborts listeners, and resets in-memory state before `signOut` resolves.
4. Wire `clearUserContext()` into all logout triggers, ensuring it runs before navigation/auth refresh, and gate any Firestore write/mutation logic by the active UID.
5. Implement automated regression tests (E2E + unit) verifying that logging out empties persistence, that user2 sees only their data, and that stale writes tied to user1 are rejected.
