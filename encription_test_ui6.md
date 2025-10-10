1. In `handleIndexError`, default the prior collection state before spreading (e.g., fall back to `{ processed: 0, updated: 0, done: false }`) so `prev[collection]` being undefined doesn’t throw.
2. Restore polling dependencies in `useEncryptionMigrationStatus`—include `user` and `lastTrigger` (or switch to a ref-based restart) so the interval resets when auth changes or `start()` is invoked.
3. Re-run the migration flow after creating the Firestore index to confirm the error pill clears and polling continues to update totals correctly.
