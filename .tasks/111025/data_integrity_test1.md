# Data Integrity Remediation Tasks

1. Inventory every client-side persistence layer holding user-scoped data (Redux slices, React Query caches, local/sessionStorage keys, IndexedDB stores, service worker caches) and map how each ties to the authenticated UID.
2. Implement a centralized `clearUserState()` routine that flushes the mapped persistence layers and resets the Redux store before the logout promise resolves or the auth state changes.
3. Update all logout flows to await `clearUserState()`, unsubscribe Firebase listeners, cancel in-flight reads/mutations, and drop queued offline writes linked to the previous user ID.
4. Add defensive UID gating on Firestore writes, mutation queues, and cache hydration paths so stale artifacts cannot execute when the authenticated user changes.
5. Run targeted automated and manual tests (e.g., Cypress multi-user scenario) to confirm post-logout state is empty, then verify that subsequent logins only load data for the active UID with no cross-account leakage.
